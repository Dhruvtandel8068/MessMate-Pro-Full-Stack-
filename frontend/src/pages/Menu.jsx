import { useEffect, useMemo, useState } from "react";
import { getData, postData, putData, deleteData } from "../services/api";
import { formatDate } from "../utils/format";

export default function Menu() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("all");

  const [form, setForm] = useState({
    meal_date: new Date().toISOString().slice(0, 10),
    meal_type: "breakfast",
    item_name: "",
    description: "",
    price: "30",
    is_special: false,
    cutoff_time: "09:00",
  });

  useEffect(() => {
    loadItems();
  }, [viewMode]);

  const loadItems = async () => {
    const endpoint = viewMode === "weekly" ? "/menu/weekly" : "/menu/";
    const res = await getData(endpoint);
    setItems(res || []);
  };

  const getDefaultsByMealType = (mealType) => {
    if (mealType === "breakfast") {
      return { price: "30", cutoff_time: "09:00" };
    }
    if (mealType === "lunch") {
      return { price: "60", cutoff_time: "13:00" };
    }
    return { price: "50", cutoff_time: "21:00" };
  };

  const resetForm = () => {
    setForm({
      meal_date: new Date().toISOString().slice(0, 10),
      meal_type: "breakfast",
      item_name: "",
      description: "",
      price: "30",
      is_special: false,
      cutoff_time: "09:00",
    });
    setEditingId(null);
  };

  const submitForm = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      price: Number(form.price || 0),
      is_special: !!form.is_special,
    };

    if (editingId) {
      await putData(`/menu/${editingId}`, payload);
    } else {
      await postData("/menu/", payload);
    }

    resetForm();
    loadItems();
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setForm({
      meal_date: row.meal_date,
      meal_type: row.meal_type,
      item_name: row.item_name,
      description: row.description || "",
      price: row.price != null ? String(row.price) : "",
      is_special: !!row.is_special,
      cutoff_time: row.cutoff_time || "",
    });
  };

  const handleDelete = async (id) => {
    await deleteData(`/menu/${id}`);
    loadItems();
  };

  const handleMealTypeChange = (value) => {
    const defaults = getDefaultsByMealType(value);

    setForm((prev) => ({
      ...prev,
      meal_type: value,
      price: editingId ? prev.price : defaults.price,
      cutoff_time: editingId ? prev.cutoff_time : defaults.cutoff_time,
    }));
  };

  const filteredItems = useMemo(() => {
    return items.filter((row) =>
      `${row.item_name} ${row.meal_type} ${row.description || ""} ${row.meal_date} ${row.price} ${row.cutoff_time}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [items, search]);

  const specialMealsCount = items.filter((i) => i.is_special).length;

  return (
    <div className="page-grid">
      <section className="glass-card">
        <h2 className="page-title">Menu Management</h2>
        <p className="page-subtitle">
          Manage weekly menu, special meals, meal prices, and attendance cutoff timings.
        </p>
      </section>

      <section className="content-two">
        {isAdmin && (
          <form className="glass-card form-grid" onSubmit={submitForm}>
            <h3 className="section-title">
              {editingId ? "Update Meal Item" : "Create Meal Item"}
            </h3>

            <div className="form-row">
              <input
                className="input"
                type="date"
                value={form.meal_date}
                onChange={(e) => setForm({ ...form, meal_date: e.target.value })}
              />

              <select
                className="select"
                value={form.meal_type}
                onChange={(e) => handleMealTypeChange(e.target.value)}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>

            <input
              className="input"
              placeholder="Meal item name"
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            />

            <textarea
              className="textarea"
              placeholder="Description, weekly notes, festival notes..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <div className="form-row">
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Meal price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />

              <input
                className="input"
                type="time"
                value={form.cutoff_time}
                onChange={(e) => setForm({ ...form, cutoff_time: e.target.value })}
              />
            </div>

            <label className="checkbox-card">
              <input
                type="checkbox"
                checked={form.is_special}
                onChange={(e) =>
                  setForm({ ...form, is_special: e.target.checked })
                }
              />
              Mark as Special Meal
            </label>

            <div className="button-group">
              <button className="button button-primary" type="submit">
                {editingId ? "Update Menu" : "Add Menu"}
              </button>

              {editingId && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        <section className="glass-card form-grid">
          <h3 className="section-title">Quick Insights</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Menu Items</div>
              <div className="stat-value">{items.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Special Meals</div>
              <div className="stat-value">{specialMealsCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">View Mode</div>
              <div className="stat-value" style={{ fontSize: "1.1rem" }}>
                {viewMode === "weekly" ? "Weekly Menu" : "All Menu"}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="glass-card">
        <div
          className="search-row"
          style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
        >
          <input
            className="input"
            placeholder="Search by item, type, date, price..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            style={{ maxWidth: "220px" }}
          >
            <option value="all">All Menu</option>
            <option value="weekly">Weekly Menu</option>
          </select>
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">
          {viewMode === "weekly" ? "Weekly Meal List" : "Meal List"}
        </h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th>Description</th>
                <th>Price</th>
                <th>Special</th>
                <th>Cutoff Time</th>
                {isAdmin && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.meal_date)}</td>
                  <td>
                    <span className="badge badge-info">{row.meal_type}</span>
                  </td>
                  <td>
                    <strong>{row.item_name}</strong>
                  </td>
                  <td>{row.description || "-"}</td>
                  <td>₹{Number(row.price || 0).toFixed(2)}</td>
                  <td>
                    {row.is_special ? (
                      <span className="badge badge-warning">Special</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{row.cutoff_time || "-"}</td>
                  {isAdmin && (
                    <td>
                      <div className="button-group">
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => handleEdit(row)}
                        >
                          Edit
                        </button>
                        <button
                          className="button button-danger"
                          type="button"
                          onClick={() => handleDelete(row.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!filteredItems.length && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7}>
                    <div className="empty-state">No menu items found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}