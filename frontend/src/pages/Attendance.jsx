import { useEffect, useMemo, useState } from "react";
import { getData, postData } from "../services/api";
import { formatDate } from "../utils/format";

export default function Attendance() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [cutoffs, setCutoffs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [form, setForm] = useState({
    user_ids: [],
    date: new Date().toISOString().slice(0, 10),
    breakfast: false,
    lunch: false,
    dinner: false,
  });

  const [existingAttendance, setExistingAttendance] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadCutoffs(form.date);
    }
  }, [form.date, isAdmin]);

  useEffect(() => {
    if (isAdmin && form.user_ids.length && form.date) {
      checkExistingAttendance(form.user_ids, form.date);
    } else {
      setExistingAttendance([]);
    }
  }, [form.user_ids, form.date, isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      const attendance = await getData("/attendance");
      setRows(attendance || []);

      if (isAdmin) {
        const usersRes = await getData("/users");
        const normalUsers = (usersRes || []).filter((u) => u.role === "user");
        setUsers(normalUsers);
      }
    } catch (error) {
      console.error("Failed to load attendance data", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCutoffs = async (selectedDate) => {
    try {
      const data = await getData(`/attendance/cutoffs?date=${selectedDate}`);
      setCutoffs(data);
    } catch (error) {
      console.error("Failed to load cutoffs", error);
    }
  };

  const checkExistingAttendance = async (userIds, selectedDate) => {
    try {
      setCheckingExisting(true);

      const query = userIds.map((id) => `user_ids=${id}`).join("&");
      const data = await getData(`/attendance/check-multiple?date=${selectedDate}&${query}`);

      setExistingAttendance(data?.records || []);
    } catch (error) {
      console.error("Failed to check existing attendance", error);
      setExistingAttendance([]);
    } finally {
      setCheckingExisting(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setForm((prev) => {
      const alreadySelected = prev.user_ids.includes(String(userId));

      return {
        ...prev,
        user_ids: alreadySelected
          ? prev.user_ids.filter((id) => id !== String(userId))
          : [...prev.user_ids, String(userId)],
      };
    });
  };

  const selectAllUsers = () => {
    setForm((prev) => ({
      ...prev,
      user_ids: users.map((u) => String(u.id)),
    }));
  };

  const clearAllUsers = () => {
    setForm((prev) => ({
      ...prev,
      user_ids: [],
    }));
    setExistingAttendance([]);
  };

  const getSelectedUsersLabel = () => {
    if (form.user_ids.length === 0) return "Select users";
    if (form.user_ids.length === users.length) return "All users selected";
    if (form.user_ids.length === 1) {
      const found = users.find((u) => String(u.id) === form.user_ids[0]);
      return found?.full_name || "1 user selected";
    }
    return `${form.user_ids.length} users selected`;
  };

  const getUserAttendanceStatus = (userId) => {
    return (
      existingAttendance.find((item) => String(item.user_id) === String(userId)) || {
        user_id: userId,
        breakfast: false,
        lunch: false,
        dinner: false,
      }
    );
  };

  const saveAttendance = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      alert("Only admin can mark attendance");
      return;
    }

    if (!form.user_ids.length) {
      alert("Please select at least one user");
      return;
    }

    if (!form.breakfast && !form.lunch && !form.dinner) {
      alert("Please select at least one meal");
      return;
    }

    const payload = {
      user_ids: form.user_ids,
      date: form.date,
      breakfast: form.breakfast,
      lunch: form.lunch,
      dinner: form.dinner,
    };

    try {
      await postData("/attendance/bulk", payload);

      await loadData();
      await loadCutoffs(form.date);
      await checkExistingAttendance(form.user_ids, form.date);

      setForm((prev) => ({
        ...prev,
        breakfast: false,
        lunch: false,
        dinner: false,
      }));

      alert("Attendance saved successfully");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to save attendance");
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      `${row.user_name} ${row.date}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [rows, search]);

  if (loading) {
    return (
      <div className="page-grid">
        <section className="glass-card">
          <h2 className="page-title">Attendance Management</h2>
          <p className="page-subtitle">Loading attendance data...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="glass-card">
        <h2 className="page-title">Attendance Management</h2>
        <p className="page-subtitle">
          {isAdmin
            ? "Admin can mark breakfast, lunch, and dinner attendance for one user, multiple users, or all users."
            : "View your attendance history. Only admin can mark attendance."}
        </p>
      </section>

      <section className="content-two">
        {isAdmin ? (
          <form className="glass-card form-grid" onSubmit={saveAttendance}>
            <h3 className="section-title">Mark Attendance</h3>

            <div className="multi-select-wrapper" style={{ position: "relative" }}>
              <button
                type="button"
                className="input"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => setShowUserDropdown((prev) => !prev)}
              >
                <span>{getSelectedUsersLabel()}</span>
                <span>{showUserDropdown ? "▲" : "▼"}</span>
              </button>

              {showUserDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #dbe3f0",
                    borderRadius: "14px",
                    padding: "12px",
                    zIndex: 20,
                    maxHeight: "280px",
                    overflowY: "auto",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={selectAllUsers}
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      className="button"
                      onClick={clearAllUsers}
                    >
                      Clear All
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: "8px" }}>
                    {users.map((u) => (
                      <label
                        key={u.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          background: form.user_ids.includes(String(u.id))
                            ? "#eef4ff"
                            : "#f8fafc",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.user_ids.includes(String(u.id))}
                          onChange={() => toggleUserSelection(u.id)}
                        />
                        <span>{u.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Breakfast Cutoff</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>
                  {cutoffs?.breakfast || "09:00"}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Lunch Cutoff</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>
                  {cutoffs?.lunch || "13:00"}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Dinner Cutoff</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>
                  {cutoffs?.dinner || "21:00"}
                </div>
              </div>
            </div>

            {checkingExisting ? (
              <div className="empty-state">Checking existing attendance...</div>
            ) : (
              <div className="glass-card" style={{ padding: "16px" }}>
                <h4 className="section-title" style={{ marginBottom: "12px" }}>
                  Selected Users Status
                </h4>

                {!form.user_ids.length ? (
                  <div className="empty-state">No users selected.</div>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {form.user_ids.map((userId) => {
                      const selectedUser = users.find((u) => String(u.id) === String(userId));
                      const status = getUserAttendanceStatus(userId);

                      return (
                        <div
                          key={userId}
                          style={{
                            padding: "12px",
                            borderRadius: "12px",
                            background: "#f8fafc",
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          <strong>{selectedUser?.full_name || "User"}</strong>
                          <div className="muted">Breakfast: {status.breakfast ? "Yes" : "No"}</div>
                          <div className="muted">Lunch: {status.lunch ? "Yes" : "No"}</div>
                          <div className="muted">Dinner: {status.dinner ? "Yes" : "No"}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="checkbox-row">
              <label className="checkbox-card">
                <input
                  type="checkbox"
                  checked={form.breakfast}
                  onChange={(e) => setForm({ ...form, breakfast: e.target.checked })}
                />
                Breakfast
              </label>

              <label className="checkbox-card">
                <input
                  type="checkbox"
                  checked={form.lunch}
                  onChange={(e) => setForm({ ...form, lunch: e.target.checked })}
                />
                Lunch
              </label>

              <label className="checkbox-card">
                <input
                  type="checkbox"
                  checked={form.dinner}
                  onChange={(e) => setForm({ ...form, dinner: e.target.checked })}
                />
                Dinner
              </label>
            </div>

            <button className="button button-primary" type="submit">
              Save Attendance
            </button>
          </form>
        ) : (
          <section className="glass-card">
            <h3 className="section-title">Your Access</h3>
            <div className="empty-state">
              You can only view your own attendance. Attendance can be marked only by admin.
            </div>
          </section>
        )}

        <section className="glass-card">
          <h3 className="section-title">Quick Overview</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">{isAdmin ? "Total Records" : "Your Records"}</div>
              <div className="stat-value">{rows.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Today</div>
              <div className="stat-value" style={{ fontSize: "1.15rem" }}>
                {formatDate(new Date())}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="glass-card">
        <div className="search-row">
          <input
            className="input"
            placeholder={isAdmin ? "Search by student name or date..." : "Search by date..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">
          {isAdmin ? "Attendance History" : "My Attendance History"}
        </h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Date</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Dinner</th>
                <th>Meal Count</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.user_name}</strong>
                  </td>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.breakfast ? "Yes" : "No"}</td>
                  <td>{row.lunch ? "Yes" : "No"}</td>
                  <td>{row.dinner ? "Yes" : "No"}</td>
                  <td>
                    <span className="badge badge-info">{row.meal_count}</span>
                  </td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">No attendance records found.</div>
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