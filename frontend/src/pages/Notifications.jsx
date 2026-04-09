import { useEffect, useMemo, useState } from "react";
import {
  getData,
  postData,
  putData,
  deleteData,
} from "../services/api";
import { showError, showSuccess } from "../utils/toast";
import { formatDateTime } from "../utils/format";

export default function Notifications() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState("all");

  const [form, setForm] = useState({
    title: "",
    message: "",
    target_type: "all",
    user_id: "",
    action_url: "",
    notification_type: "general",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [notificationRes, usersRes] = await Promise.all([
        getData("/notifications/"),
        isAdmin ? getData("/users") : Promise.resolve([]),
      ]);

      setNotifications(Array.isArray(notificationRes) ? notificationRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
    } catch (error) {
      console.error("Failed to load notifications", error);
      showError(error?.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      showError("Title and message are required");
      return;
    }

    if (form.target_type === "single" && !form.user_id) {
      showError("Please select a user");
      return;
    }

    try {
      setSending(true);

      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        target_type: form.target_type,
        action_url: form.action_url.trim(),
        notification_type: form.notification_type,
      };

      if (form.target_type === "single") {
        payload.user_id = Number(form.user_id);
      }

      await postData("/notifications/", payload);

      showSuccess("Notification sent successfully");
      setForm({
        title: "",
        message: "",
        target_type: "all",
        user_id: "",
        action_url: "",
        notification_type: "general",
      });
      await loadData();
    } catch (error) {
      console.error("Failed to send notification", error);
      showError(error?.response?.data?.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await putData(`/notifications/${id}/read`, {});
      showSuccess("Notification marked as read");
      await loadData();
    } catch (error) {
      console.error("Failed to mark as read", error);
      showError(error?.response?.data?.message || "Failed to mark notification as read");
    }
  };

  const removeNotification = async (id) => {
    const ok = window.confirm("Delete this notification?");
    if (!ok) return;

    try {
      await deleteData(`/notifications/${id}`);
      showSuccess("Notification deleted successfully");
      await loadData();
    } catch (error) {
      console.error("Failed to delete notification", error);
      showError(error?.response?.data?.message || "Failed to delete notification");
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const text =
        `${item.title || ""} ${item.message || ""} ${item.target_type || ""} ${item.notification_type || ""}`
          .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      const matchesTarget =
        targetFilter === "all"
          ? true
          : String(item.target_type || "").toLowerCase() === targetFilter.toLowerCase();

      return matchesSearch && matchesTarget;
    });
  }, [notifications, search, targetFilter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readCount = notifications.filter((n) => n.is_read).length;

  return (
    <div className="page-grid">
      <section className="glass-card">
        <div className="hero-strip">
          <div>
            <h2 className="page-title">Notifications</h2>
            <p className="page-subtitle">
              Send, manage, and track user notifications for expenses, bills, complaints, and system updates.
            </p>
          </div>

          <div className="hero-kpis">
            <div className="kpi-pill">Unread: {unreadCount}</div>
            <div className="kpi-pill">Read: {readCount}</div>
            <div className="kpi-pill">Role: {isAdmin ? "Admin" : "User"}</div>
          </div>
        </div>
      </section>

      <section className="content-two">
        {isAdmin ? (
          <form className="glass-card form-grid" onSubmit={sendNotification}>
            <h3 className="section-title">Send Notification</h3>

            <input
              className="input"
              placeholder="Notification title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <textarea
              className="textarea"
              placeholder="Notification message..."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />

            <div className="form-row">
              <select
                className="select"
                value={form.target_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_type: e.target.value,
                    user_id: e.target.value === "single" ? form.user_id : "",
                  })
                }
              >
                <option value="all">All Users</option>
                <option value="admin">Admin Only</option>
                <option value="user">Users Only</option>
                <option value="single">Single User</option>
              </select>

              {form.target_type === "single" ? (
                <select
                  className="select"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                >
                  <option value="">Select user</option>
                  {users
                    .filter((u) => u.role === "user")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                </select>
              ) : (
                <select
                  className="select"
                  value={form.notification_type}
                  onChange={(e) =>
                    setForm({ ...form, notification_type: e.target.value })
                  }
                >
                  <option value="general">General</option>
                  <option value="expense_created">Expense Created</option>
                  <option value="payment_submitted">Payment Submitted</option>
                  <option value="payment_approved">Payment Approved</option>
                  <option value="complaint_reply">Complaint Reply</option>
                  <option value="bill_generated">Bill Generated</option>
                </select>
              )}
            </div>

            <input
              className="input"
              placeholder="Action URL (optional), eg: /billing"
              value={form.action_url}
              onChange={(e) => setForm({ ...form, action_url: e.target.value })}
            />

            <div className="button-group">
              <button
                className="button button-primary"
                type="submit"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send Notification"}
              </button>
            </div>
          </form>
        ) : (
          <section className="glass-card">
            <h3 className="section-title">Your Notifications</h3>
            <div className="empty-state">
              View all personal notifications related to your account activity here.
            </div>
          </section>
        )}

        <section className="glass-card form-grid">
          <h3 className="section-title">Quick Insights</h3>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Notifications</div>
              <div className="stat-value">{notifications.length}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Unread</div>
              <div className="stat-value">{unreadCount}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Read</div>
              <div className="stat-value">{readCount}</div>
            </div>
          </div>
        </section>
      </section>

      <section className="glass-card">
        <div className="search-row">
          <input
            className="input"
            placeholder="Search by title, message, target..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="all">All Targets</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="single">Single User</option>
          </select>
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">Notification Center</h3>

        {loading ? (
          <div className="empty-state">Loading notifications...</div>
        ) : !filteredNotifications.length ? (
          <div className="empty-state">No notifications found.</div>
        ) : (
          <div className="list-stack">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                className="list-item"
                style={{
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", marginBottom: 8 }}>
                    {item.title}
                  </strong>

                  <div className="muted" style={{ marginBottom: 8 }}>
                    {item.message}
                  </div>

                  {/* Main date change here */}
                  <div className="muted" style={{ marginBottom: 6 }}>
                    {formatDateTime(item.created_at)}
                  </div>

                  {item.action_url && (
                    <div className="muted" style={{ marginBottom: 10 }}>
                      Action: {item.action_url}
                    </div>
                  )}

                  <div className="button-group">
                    {!item.is_read && (
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => markAsRead(item.id)}
                      >
                        Mark Read
                      </button>
                    )}

                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => removeNotification(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    alignItems: "flex-end",
                    minWidth: 120,
                  }}
                >
                  <span className="badge badge-info">
                    {item.target_type || "user"}
                  </span>

                  <span
                    className={`badge ${
                      item.is_read ? "badge-success" : "badge-warning"
                    }`}
                  >
                    {item.is_read ? "Read" : "Unread"}
                  </span>

                  <span className="badge badge-info">
                    {item.notification_type || "general"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}