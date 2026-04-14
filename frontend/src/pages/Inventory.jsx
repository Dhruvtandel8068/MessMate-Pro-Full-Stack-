import { useEffect, useMemo, useState } from "react";
import { getData, postData, putData, deleteData } from "../services/api";

const CATEGORY_UNIT_MAP = {
  Groceries: "Nos",
  Vegetables: "Kgs",
  Dairy: "Litres",
  Cleaning: "Nos",
  Gas: "Cylinder",
  Utensils: "Nos",
  Other: "Nos",
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    category: "Groceries",
    name: "",
    unit: CATEGORY_UNIT_MAP["Groceries"],
    qty: "",
    low_limit: 5,
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await getData("/inventory/");
      setItems(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("Failed to load inventory", error);
      alert(error?.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      category: "Groceries",
      name: "",
      unit: CATEGORY_UNIT_MAP["Groceries"],
      qty: "",
      low_limit: 5,
    });
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setForm((prev) => ({
      ...prev,
      category,
      unit: CATEGORY_UNIT_MAP[category] || "Nos",
    }));
  };

  const validateForm = () => {
    const name = form.name.trim();
    const qty = Number(form.qty);
    const lowLimit = Number(form.low_limit);

    if (!form.category) {
      alert("Please select category");
      return false;
    }

    if (!name) {
      alert("Please enter item name");
      return false;
    }

    if (Number.isNaN(qty) || qty <= 0) {
      alert("Please enter valid quantity");
      return false;
    }

    if (Number.isNaN(lowLimit) || lowLimit < 0) {
      alert("Please enter valid low stock limit");
      return false;
    }

    return true;
  };

  const submitItem = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        category: form.category,
        name: form.name.trim(),
        unit: form.unit,
        qty: Number(form.qty),
        low_limit: Number(form.low_limit),
      };

      if (editingId) {
        await putData(`/inventory/${editingId}`, payload);
        alert("Inventory item updated successfully");
      } else {
        await postData("/inventory/", payload);
        alert("Inventory item added successfully");
      }

      resetForm();
      await loadItems();
    } catch (error) {
      console.error("Failed to save inventory item", error);
      alert(error?.response?.data?.message || "Failed to save inventory item");
    } finally {
      setSaving(false);
    }
  };

  const editItem = (item) => {
    setEditingId(item.id);
    setForm({
      category: item.category || "Groceries",
      name: item.name || "",
      unit: item.unit || CATEGORY_UNIT_MAP[item.category] || "Nos",
      qty: item.qty ?? "",
      low_limit: item.low_limit ?? 5,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeItem = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this item?");
    if (!ok) return;

    try {
      await deleteData(`/inventory/${id}`);
      await loadItems();
    } catch (error) {
      console.error("Failed to delete inventory item", error);
      alert(error?.response?.data?.message || "Failed to delete inventory item");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = `${item.category} ${item.name} ${item.qty} ${item.low_limit} ${item.unit || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());

      const isLow = Number(item.qty) <= Number(item.low_limit);

      const matchesStock =
        stockFilter === "all"
          ? true
          : stockFilter === "low"
          ? isLow
          : !isLow;

      return matchesSearch && matchesStock;
    });
  }, [items, search, stockFilter]);

  const totalItems = items.length;
  const lowStockCount = items.filter(
    (item) => Number(item.qty) <= Number(item.low_limit)
  ).length;
  const healthyStockCount = items.filter(
    (item) => Number(item.qty) > Number(item.low_limit)
  ).length;

  const getQtyPlaceholder = () => `Quantity (${form.unit})`;
  const getLowLimitPlaceholder = () => `Low stock limit (${form.unit})`;

  return (
    <div className="page-grid">
      <section className="glass-card">
        <div className="hero-strip">
          <div>
            <h2 className="page-title">Inventory Management</h2>
            <p className="page-subtitle">
              Track mess stock, manage categories, monitor quantity levels, and
              identify low-stock items quickly.
            </p>
          </div>

          <div className="hero-kpis">
            <div className="kpi-pill">Total Items: {totalItems}</div>
            <div className="kpi-pill">Low Stock: {lowStockCount}</div>
            <div className="kpi-pill">Healthy Stock: {healthyStockCount}</div>
          </div>
        </div>
      </section>

      <section className="content-two">
        <form className="glass-card form-grid" onSubmit={submitItem}>
          <h3 className="section-title">
            {editingId ? "Update Inventory Item" : "Add Inventory Item"}
          </h3>

          <div className="form-row">
            <select
              className="select"
              value={form.category}
              onChange={handleCategoryChange}
            >
              <option value="Groceries">Groceries</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Dairy">Dairy</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Gas">Gas</option>
              <option value="Utensils">Utensils</option>
              <option value="Other">Other</option>
            </select>

            <input
              className="input"
              placeholder="Item name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <input
              className="input"
              type="number"
              placeholder={getQtyPlaceholder()}
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              required
              min="0"
              step="0.01"
            />

            <input
              className="input"
              type="number"
              placeholder={getLowLimitPlaceholder()}
              value={form.low_limit}
              onChange={(e) => setForm({ ...form, low_limit: e.target.value })}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="button-group">
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving
                ? editingId
                  ? "Updating..."
                  : "Adding..."
                : editingId
                ? "Update Item"
                : "Add Item"}
            </button>

            <button
              className="button button-secondary"
              type="button"
              onClick={resetForm}
              disabled={saving}
            >
              Reset
            </button>
          </div>
        </form>

        <section className="glass-card">
          <h3 className="section-title">Quick Insights</h3>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Inventory Items</div>
              <div className="stat-value">{totalItems}</div>
              <div className="stat-trend">Tracked products</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Low Stock Alerts</div>
              <div className="stat-value">{lowStockCount}</div>
              <div className="stat-trend">Needs refill</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Healthy Stock</div>
              <div className="stat-value">{healthyStockCount}</div>
              <div className="stat-trend">Stable items</div>
            </div>
          </div>
        </section>
      </section>

      <section className="glass-card">
        <div className="search-row">
          <input
            className="input"
            placeholder="Search by category, item name, quantity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            <option value="all">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="healthy">Healthy Stock</option>
          </select>
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">Inventory List</h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Low Limit</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">Loading inventory...</div>
                  </td>
                </tr>
              ) : filteredItems.length ? (
                filteredItems.map((item) => {
                  const isLow = Number(item.qty) <= Number(item.low_limit);

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.category}</strong>
                      </td>
                      <td>{item.name}</td>
                      <td>
                        {item.qty} {item.unit || ""}
                      </td>
                      <td>
                        {item.low_limit} {item.unit || ""}
                      </td>
                      <td>{item.unit || "-"}</td>
                      <td>
                        <span
                          className={`badge ${
                            isLow ? "badge-danger" : "badge-success"
                          }`}
                        >
                          {isLow ? "Low Stock" : "Healthy"}
                        </span>
                      </td>
                      <td>
                        <div className="button-group">
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => editItem(item)}
                          >
                            Edit
                          </button>

                          <button
                            className="button button-danger"
                            type="button"
                            onClick={() => removeItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">No inventory items found.</div>
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