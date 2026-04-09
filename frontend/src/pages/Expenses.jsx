import { useEffect, useMemo, useState } from "react";
import {
  deleteData,
  getData,
  postData,
  putData,
} from "../services/api";
import { showError, showSuccess } from "../utils/toast";
import { formatDate } from "../utils/format";

export default function Expenses() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ grand_total: 0, categories: [] });

  const [form, setForm] = useState({
    title: "",
    category_id: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });

  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [monthFilter, yearFilter]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (monthFilter) params.set("month", monthFilter);
    if (yearFilter) params.set("year", yearFilter);
    if (categoryFilter !== "all") params.set("category_id", categoryFilter);
    return params.toString();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const query = buildQuery();

      const [expRes, catRes, sumRes] = await Promise.all([
        getData(`/expenses/${query ? `?${query}` : ""}`),
        getData("/expenses/categories"),
        getData(`/expenses/summary${query ? `?${query}` : ""}`),
      ]);

      setExpenses(Array.isArray(expRes) ? expRes : []);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setSummary(sumRes || { grand_total: 0, categories: [] });
    } catch (error) {
      console.error("Failed to load expenses", error);
      showError(error?.response?.data?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: "",
      category_id: "",
      amount: "",
      expense_date: new Date().toISOString().slice(0, 10),
    });
    setEditingExpense(null);
  };

  const submitExpense = async (e) => {
    e.preventDefault();

    if (!form.title || !form.category_id || !form.amount || !form.expense_date) {
      showError("Please fill all fields.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        category_id: Number(form.category_id),
        amount: Number(form.amount),
      };

      if (editingExpense) {
        await putData(`/expenses/${editingExpense.id}`, payload);
        showSuccess("Expense updated successfully");
      } else {
        await postData("/expenses/", payload);
        showSuccess("Expense added successfully");
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error("Failed to save expense", error);
      showError(error?.response?.data?.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingExpense(item);
    setForm({
      title: item.title || "",
      category_id: item.category_id || "",
      amount: item.amount || "",
      expense_date: item.expense_date || new Date().toISOString().slice(0, 10),
    });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this expense?");
    if (!ok) return;

    try {
      await deleteData(`/expenses/${id}`);
      showSuccess("Expense deleted successfully");
      await loadData();
    } catch (error) {
      console.error("Failed to delete expense", error);
      showError(error?.response?.data?.message || "Failed to delete expense");
    }
  };

  const exportExpenses = () => {
    const query = buildQuery();
    window.open(
      `http://127.0.0.1:5000/api/expenses/export${query ? `?${query}` : ""}`,
      "_blank"
    );
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const matchesSearch = `${item.title} ${item.category_name || ""} ${item.amount || ""} ${item.expense_date || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesSearch;
    });
  }, [expenses, search]);

  const total = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const avgExpense = filteredExpenses.length
    ? total / filteredExpenses.length
    : 0;

  return (
    <div className="page-grid">
      <section className="glass-card">
        <div className="hero-strip">
          <div>
            <h2 className="page-title">Expense Management</h2>
            <p className="page-subtitle">
              Track mess expenses, filter by month, edit records, view category
              summary, and export reports.
            </p>
          </div>

          <div className="hero-kpis">
            <div className="kpi-pill">Records: {filteredExpenses.length}</div>
            <div className="kpi-pill">Total: ₹ {total.toFixed(2)}</div>
            <div className="kpi-pill">Average: ₹ {avgExpense.toFixed(2)}</div>
          </div>
        </div>
      </section>

      <section className="content-two">
        <div className="glass-card form-grid">
          <h3 className="section-title">
            {editingExpense ? "Edit Expense" : "Add Expense"}
          </h3>

          {isAdmin ? (
            <form className="form-grid" onSubmit={submitExpense}>
              <input
                className="input"
                placeholder="Expense title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <div className="form-row">
                <select
                  className="select"
                  value={form.category_id}
                  onChange={(e) =>
                    setForm({ ...form, category_id: e.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  className="input"
                  type="number"
                  placeholder="Amount"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <input
                className="input"
                type="date"
                value={form.expense_date}
                onChange={(e) =>
                  setForm({ ...form, expense_date: e.target.value })
                }
              />

              <div className="button-group">
                <button className="button button-primary" type="submit" disabled={saving}>
                  {saving
                    ? editingExpense
                      ? "Updating..."
                      : "Adding..."
                    : editingExpense
                    ? "Update Expense"
                    : "Add Expense"}
                </button>

                {editingExpense && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={resetForm}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="empty-state">Only admin can manage expenses.</div>
          )}
        </div>

        <div className="glass-card">
          <h3 className="section-title">Category Summary Cards</h3>

          {summary?.categories?.length ? (
            <div className="stats-grid">
              {summary.categories.map((item, index) => (
                <div key={index} className="stat-card">
                  <div className="stat-label">{item.category_name}</div>
                  <div className="stat-value">
                    ₹ {Number(item.total_amount || 0).toFixed(2)}
                  </div>
                  <div className="stat-trend">{item.item_count || 0} item(s)</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No category summary available.</div>
          )}
        </div>
      </section>

      <section className="glass-card">
        <div className="search-row">
          <input
            className="input"
            placeholder="Search by title, category, amount..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ maxWidth: 160 }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                Month {month}
              </option>
            ))}
          </select>

          <input
            className="input"
            type="number"
            placeholder="Year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ maxWidth: 140 }}
          />

          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            className="button button-secondary"
            type="button"
            onClick={exportExpenses}
          >
            Export Expense Report
          </button>
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">Expense Records</h3>

        {loading ? (
          <div className="empty-state">Loading expenses...</div>
        ) : filteredExpenses.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {filteredExpenses.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>{item.category_name || "-"}</td>
                    <td>₹ {Number(item.amount || 0).toFixed(2)}</td>
                    <td>{formatDate(item.expense_date)}</td>
                    {isAdmin && (
                      <td>
                        <div className="button-group">
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="button button-danger"
                            type="button"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No expense records found.</div>
        )}
      </section>
    </div>
  );
}