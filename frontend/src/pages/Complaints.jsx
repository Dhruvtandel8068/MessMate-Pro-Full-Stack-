import { useEffect, useMemo, useState } from "react";
import {
  deleteData,
  getData,
  postData,
  putData,
} from "../services/api";
import { showError, showSuccess } from "../utils/toast";
import { formatDateTime } from "../utils/format";

const complaintTypes = ["Food", "Cleaning", "Service", "Staff", "Other"];
const priorities = ["Low", "Medium", "High", "Urgent"];
const adminStatuses = ["Open", "In Progress", "Resolved", "Rejected"];

function getPriorityBadge(priority) {
  const p = String(priority || "").toLowerCase();

  if (p === "urgent") return "badge badge-danger";
  if (p === "high") return "badge badge-warning";
  if (p === "medium") return "badge badge-info";
  return "badge badge-success";
}

function getStatusBadge(status) {
  const s = String(status || "").toLowerCase();

  if (s === "resolved") return "badge badge-success";
  if (s === "in progress") return "badge badge-warning";
  if (s === "rejected") return "badge badge-danger";
  return "badge badge-info";
}

export default function Complaints() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [form, setForm] = useState({
    complaint_type: "Food",
    message: "",
    priority: "Medium",
  });

  const [adminEditId, setAdminEditId] = useState(null);
  const [adminForm, setAdminForm] = useState({
    status: "Open",
    priority: "Medium",
    admin_remark: "",
  });

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    try {
      setLoading(true);
      const res = await getData("/complaints/");
      setComplaints(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("Failed to load complaints", error);
      showError(error?.response?.data?.message || "Failed to load complaints");
    } finally {
      setLoading(false);
    }
  };

  const submitComplaint = async (e) => {
    e.preventDefault();

    if (!form.complaint_type || !form.message.trim()) {
      showError("Please fill all fields");
      return;
    }

    try {
      setSaving(true);

      await postData("/complaints/", {
        complaint_type: form.complaint_type,
        message: form.message.trim(),
        priority: form.priority,
      });

      showSuccess("Complaint submitted successfully");
      setForm({
        complaint_type: "Food",
        message: "",
        priority: "Medium",
      });
      await loadComplaints();
    } catch (error) {
      console.error("Failed to submit complaint", error);
      showError(error?.response?.data?.message || "Failed to submit complaint");
    } finally {
      setSaving(false);
    }
  };

  const startAdminEdit = (item) => {
    setAdminEditId(item.id);
    setAdminForm({
      status: item.status || "Open",
      priority: item.priority || "Medium",
      admin_remark: item.admin_remark || "",
    });
  };

  const saveAdminUpdate = async (id) => {
    try {
      await putData(`/complaints/${id}`, adminForm);
      showSuccess("Complaint updated successfully");
      setAdminEditId(null);
      await loadComplaints();
    } catch (error) {
      console.error("Failed to update complaint", error);
      showError(error?.response?.data?.message || "Failed to update complaint");
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this complaint?");
    if (!ok) return;

    try {
      await deleteData(`/complaints/${id}`);
      showSuccess("Complaint deleted successfully");
      await loadComplaints();
    } catch (error) {
      console.error("Failed to delete complaint", error);
      showError(error?.response?.data?.message || "Failed to delete complaint");
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      const text =
        `${item.user_name || ""} ${item.complaint_type || ""} ${item.message || ""} ${item.status || ""} ${item.priority || ""}`
          .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all"
          ? true
          : String(item.status || "").toLowerCase() === statusFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "all"
          ? true
          : String(item.priority || "").toLowerCase() === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [complaints, search, statusFilter, priorityFilter]);

  const openCount = complaints.filter((c) => c.status === "Open").length;
  const inProgressCount = complaints.filter(
    (c) => c.status === "In Progress"
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved").length;

  return (
    <div className="page-grid">
      <section className="glass-card">
        <div className="hero-strip">
          <div>
            <h2 className="page-title">Complaint Management</h2>
            <p className="page-subtitle">
              Raise, track, update, resolve, and review complaint history with
              priority and timeline.
            </p>
          </div>

          <div className="hero-kpis">
            <div className="kpi-pill">Open: {openCount}</div>
            <div className="kpi-pill">In Progress: {inProgressCount}</div>
            <div className="kpi-pill">Resolved: {resolvedCount}</div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Open Complaints</div>
          <div className="stat-value">{openCount}</div>
          <div className="stat-trend">Waiting for action</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{inProgressCount}</div>
          <div className="stat-trend">Under review</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{resolvedCount}</div>
          <div className="stat-trend">Successfully closed</div>
        </div>
      </section>

      {!isAdmin && (
        <section className="glass-card">
          <form className="form-grid" onSubmit={submitComplaint}>
            <h3 className="section-title">Raise Complaint</h3>

            <div className="form-row">
              <select
                className="select"
                value={form.complaint_type}
                onChange={(e) =>
                  setForm({ ...form, complaint_type: e.target.value })
                }
              >
                {complaintTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              className="textarea"
              placeholder="Describe your complaint clearly..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />

            <div className="button-group">
              <button className="button button-primary" type="submit" disabled={saving}>
                {saving ? "Submitting..." : "Submit Complaint"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="glass-card">
        <div className="search-row">
          <input
            className="input"
            placeholder="Search by user, type, message, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            <option value="all">All Status</option>
            {adminStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ maxWidth: 180 }}
          >
            <option value="all">All Priority</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">Complaint List</h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Message</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Timeline / Remark</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">Loading complaints...</div>
                  </td>
                </tr>
              ) : filteredComplaints.length ? (
                filteredComplaints.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.user_name || "Student"}</strong>
                    </td>

                    <td>{item.complaint_type}</td>

                    <td style={{ maxWidth: 260 }}>
                      <div style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                        {item.message}
                      </div>
                    </td>

                    <td>
                      <span className={getPriorityBadge(item.priority)}>
                        {item.priority || "Medium"}
                      </span>
                    </td>

                    <td>
                      <span className={getStatusBadge(item.status)}>
                        {item.status}
                      </span>
                    </td>

                    <td>{formatDateTime(item.created_at)}</td>

                    <td style={{ minWidth: 220 }}>
                      <div className="list-stack">
                        <div className="muted">
                          Created: {formatDateTime(item.created_at)}
                        </div>
                        <div className="muted">
                          Updated: {formatDateTime(item.updated_at)}
                        </div>
                        <div className="muted">
                          Resolved: {formatDateTime(item.resolved_at)}
                        </div>
                        <div>
                          <strong>Remark:</strong> {item.admin_remark || "-"}
                        </div>
                      </div>
                    </td>

                    <td style={{ minWidth: 260 }}>
                      {isAdmin ? (
                        adminEditId === item.id ? (
                          <div className="form-grid">
                            <select
                              className="select"
                              value={adminForm.status}
                              onChange={(e) =>
                                setAdminForm({
                                  ...adminForm,
                                  status: e.target.value,
                                })
                              }
                            >
                              {adminStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>

                            <select
                              className="select"
                              value={adminForm.priority}
                              onChange={(e) =>
                                setAdminForm({
                                  ...adminForm,
                                  priority: e.target.value,
                                })
                              }
                            >
                              {priorities.map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>

                            <textarea
                              className="textarea"
                              placeholder="Admin remark..."
                              value={adminForm.admin_remark}
                              onChange={(e) =>
                                setAdminForm({
                                  ...adminForm,
                                  admin_remark: e.target.value,
                                })
                              }
                            />

                            <div className="button-group">
                              <button
                                className="button button-primary"
                                type="button"
                                onClick={() => saveAdminUpdate(item.id)}
                              >
                                Save
                              </button>

                              <button
                                className="button button-secondary"
                                type="button"
                                onClick={() => setAdminEditId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="button-group">
                            <button
                              className="button button-secondary"
                              type="button"
                              onClick={() => startAdminEdit(item)}
                            >
                              Update
                            </button>

                            <button
                              className="button button-danger"
                              type="button"
                              onClick={() => handleDelete(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="button-group">
                          <span className="muted">Waiting for admin</span>
                          <button
                            className="button button-danger"
                            type="button"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">No complaints found.</div>
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