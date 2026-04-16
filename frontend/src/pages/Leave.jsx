import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const formatDate = (date) => {
  if (!date) return "-";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

const formatDateTime = (date) => {
  if (!date) return "-";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default function Leave() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [remarks, setRemarks] = useState({});

  const stats = useMemo(() => {
    const pending = leaves.filter((l) => l.status === "Pending").length;
    const approved = leaves.filter((l) => l.status === "Approved").length;
    const rejected = leaves.filter((l) => l.status === "Rejected").length;
    return { pending, approved, rejected, total: leaves.length };
  }, [leaves]);

  useEffect(() => {
    fetchLeaves();
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/leave/");
      setLeaves(res.data.leaves || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to fetch leave data");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateLeaveForm = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);

    if (!formData.start_date || !formData.end_date || !formData.reason.trim()) {
      setError("All fields are required");
      return false;
    }

    if (startDate < today) {
      setError("Start date cannot be in the past");
      return false;
    }

    if (endDate < startDate) {
      setError("End date cannot be before start date");
      return false;
    }

    return true;
  };

  const handleApply = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!validateLeaveForm()) return;

    try {
      setSubmitting(true);

      await api.post("/leave/", {
        ...formData,
        reason: formData.reason.trim(),
      });

      setMessage("✅ Leave request submitted successfully");
      setFormData({
        start_date: "",
        end_date: "",
        reason: "",
      });

      await fetchLeaves();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (leaveId) => {
    setError("");
    setMessage("");

    if (!remarks[leaveId] || !remarks[leaveId].trim()) {
      alert("Please enter remark");
      return;
    }

    try {
      setActionLoadingId(leaveId);

      await api.put(`/leave/${leaveId}/approve`, {
        admin_remark: remarks[leaveId].trim(),
      });

      setMessage("✅ Leave approved successfully");
      await fetchLeaves();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to approve leave");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (leaveId) => {
    setError("");
    setMessage("");

    if (!remarks[leaveId] || !remarks[leaveId].trim()) {
      alert("Please enter remark");
      return;
    }

    try {
      setActionLoadingId(leaveId);

      await api.put(`/leave/${leaveId}/reject`, {
        admin_remark: remarks[leaveId].trim(),
      });

      setMessage("✅ Leave rejected successfully");
      await fetchLeaves();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reject leave");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (leaveId) => {
    const ok = window.confirm("Are you sure you want to delete this leave request?");
    if (!ok) return;

    try {
      setActionLoadingId(leaveId);
      setError("");
      setMessage("");

      await api.delete(`/leave/${leaveId}`);

      setMessage("✅ Leave request deleted successfully");
      await fetchLeaves();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete leave");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusClass = (status) => {
    if (status === "Approved") return "status-badge approved";
    if (status === "Rejected") return "status-badge rejected";
    return "status-badge pending";
  };

  return (
    <div className="attendance-style-page">
      <section className="glass-card">
        <h2 className="attendance-style-title">Leave Management</h2>
        <p className="attendance-style-subtitle">
          {isAdmin
            ? "Review and manage all leave requests."
            : "Apply for leave and track your request status."}
        </p>
      </section>

      <section className="attendance-style-stats-grid">
        <div className="attendance-style-stat-card">
          <h3>Total</h3>
          <p>{stats.total}</p>
        </div>
        <div className="attendance-style-stat-card">
          <h3>Pending</h3>
          <p>{stats.pending}</p>
        </div>
        <div className="attendance-style-stat-card">
          <h3>Approved</h3>
          <p>{stats.approved}</p>
        </div>
        <div className="attendance-style-stat-card">
          <h3>Rejected</h3>
          <p>{stats.rejected}</p>
        </div>
      </section>

      {message && <div className="attendance-alert success-alert">{message}</div>}
      {error && <div className="attendance-alert error-alert">{error}</div>}

      {!isAdmin && (
        <section className="attendance-style-card">
          <h3 className="attendance-style-card-title">Apply for Leave</h3>

          <form onSubmit={handleApply} className="attendance-style-form">
            <div className="attendance-style-two-col">
              <div className="attendance-style-field">
                <label>Start Date (DD/MM/YYYY)</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
                {formData.start_date && (
                  <small className="selected-date-text">
                    Selected: {formatDate(formData.start_date)}
                  </small>
                )}
              </div>

              <div className="attendance-style-field">
                <label>End Date (DD/MM/YYYY)</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date || new Date().toISOString().split("T")[0]}
                  required
                />
                {formData.end_date && (
                  <small className="selected-date-text">
                    Selected: {formatDate(formData.end_date)}
                  </small>
                )}
              </div>
            </div>

            <div className="attendance-style-field">
              <label>Reason</label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                placeholder="Enter your leave reason"
                rows="4"
                required
              />
            </div>

            <button type="submit" className="attendance-style-primary-btn" disabled={submitting}>
              {submitting ? "Submitting..." : "Apply Leave"}
            </button>
          </form>
        </section>
      )}

      <section className="attendance-style-card">
        <div className="attendance-style-table-head">
          <h3 className="attendance-style-card-title">
            {isAdmin ? "All Leave Requests" : "My Leave Requests"}
          </h3>
          <button className="attendance-style-secondary-btn" onClick={fetchLeaves} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p className="attendance-empty-text">Loading leave data...</p>
        ) : leaves.length === 0 ? (
          <p className="attendance-empty-text">No leave requests found.</p>
        ) : (
          <div className="attendance-style-table-wrap">
            <table className="attendance-style-table">
              <thead>
                <tr>
                  {isAdmin && <th>User</th>}
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Admin Remark</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    {isAdmin && <td>{leave.user_name || "-"}</td>}
                    <td>{formatDate(leave.start_date)}</td>
                    <td>{formatDate(leave.end_date)}</td>
                    <td>{leave.reason || "-"}</td>
                    <td>
                      <span className={getStatusClass(leave.status)}>{leave.status}</span>
                    </td>
                    <td>
                      {isAdmin && leave.status === "Pending" ? (
                        <textarea
                          rows="2"
                          placeholder="Add remark"
                          value={remarks[leave.id] || ""}
                          onChange={(e) =>
                            setRemarks((prev) => ({
                              ...prev,
                              [leave.id]: e.target.value,
                            }))
                          }
                          className="attendance-style-remark-box"
                        />
                      ) : (
                        leave.admin_remark || "-"
                      )}
                    </td>
                    <td>{formatDateTime(leave.created_at)}</td>
                    <td>
                      <div className="attendance-style-action-row">
                        {isAdmin && leave.status === "Pending" && (
                          <>
                            <button
                              className="approve-btn"
                              onClick={() => handleApprove(leave.id)}
                              disabled={actionLoadingId === leave.id}
                            >
                              {actionLoadingId === leave.id ? "Please wait..." : "Approve"}
                            </button>

                            <button
                              className="reject-btn"
                              onClick={() => handleReject(leave.id)}
                              disabled={actionLoadingId === leave.id}
                            >
                              {actionLoadingId === leave.id ? "Please wait..." : "Reject"}
                            </button>
                          </>
                        )}

                        {!isAdmin && leave.status === "Pending" && (
                          <button
                            className="reject-btn"
                            onClick={() => handleDelete(leave.id)}
                            disabled={actionLoadingId === leave.id}
                          >
                            {actionLoadingId === leave.id ? "Deleting..." : "Delete"}
                          </button>
                        )}

                        {!isAdmin && leave.status !== "Pending" && (
                          <span className="attendance-no-action">No action</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>{`
        .attendance-style-page {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .attendance-style-section-header {
          background: #ffffff;
          border-radius: 24px;
          padding: 22px 20px;
        }

        .attendance-style-title {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          line-height: 1.2;
          color: #0f172a;
        }

        .attendance-style-subtitle {
          margin: 10px 0 0;
          font-size: 15px;
          line-height: 1.5;
          color: #64748b;
        }

        .attendance-style-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .attendance-style-stat-card {
          background: #ffffff;
          border-radius: 18px;
          padding: 18px 16px;
          border: 1px solid #edf1f7;
        }

        .attendance-style-stat-card h3 {
          margin: 0 0 12px;
          font-size: 15px;
          font-weight: 600;
          color: #5b667a;
        }

        .attendance-style-stat-card p {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .attendance-style-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 18px;
        }

        .attendance-style-card-title {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .attendance-style-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .attendance-style-two-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .attendance-style-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .attendance-style-field label {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .attendance-style-field input,
        .attendance-style-field textarea,
        .attendance-style-remark-box {
          width: 100%;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 15px;
          outline: none;
          background: #fff;
        }

        .attendance-style-primary-btn {
          height: 48px;
          border: none;
          border-radius: 16px;
          background: #3b5fe2;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .attendance-style-secondary-btn {
          border: none;
          background: #eef2ff;
          color: #4c51bf;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .attendance-style-table-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .attendance-style-table-wrap {
          overflow-x: auto;
        }

        .attendance-style-table {
          width: 100%;
          border-collapse: collapse;
        }

        .attendance-style-table th,
        .attendance-style-table td {
          padding: 16px 10px;
          text-align: left;
          border-bottom: 1px solid #edf1f7;
          font-size: 15px;
          color: #0f172a;
          vertical-align: middle;
        }

        .attendance-style-table th {
          font-size: 14px;
          font-weight: 700;
          color: #5b667a;
          background: #f8fafc;
        }

        .attendance-style-action-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .approve-btn {
          border: none;
          background: #16a34a;
          color: white;
          border-radius: 12px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .reject-btn {
          border: none;
          background: #ef4444;
          color: white;
          border-radius: 12px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.approved {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.rejected {
          background: #fee2e2;
          color: #991b1b;
        }

        .attendance-alert {
          padding: 14px 16px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
        }

        .success-alert {
          background: #dcfce7;
          color: #166534;
        }

        .error-alert {
          background: #fee2e2;
          color: #991b1b;
        }

        .attendance-empty-text,
        .attendance-no-action,
        .selected-date-text {
          color: #64748b;
          font-size: 14px;
        }

        @media (max-width: 1100px) {
          .attendance-style-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .attendance-style-two-col,
          .attendance-style-stats-grid {
            grid-template-columns: 1fr;
          }

          .attendance-style-table-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }
          
      `}</style>
    </div>
  );
}