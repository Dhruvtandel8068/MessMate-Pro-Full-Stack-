import { useEffect, useMemo, useState } from "react";
import {
  deleteData,
  getData,
  postData,
  putData,
} from "../services/api";
import { showError, showSuccess } from "../utils/toast";
import { formatDateTime } from "../utils/format";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "user",
    contact: "",
    room_no: "",
  });

  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await getData("/users");
      setUsers(Array.isArray(res) ? res : []);
    } catch (error) {
      showError("Failed to load users");
    }
  };

  const resetForm = () => {
    setForm({
      full_name: "",
      email: "",
      password: "",
      role: "user",
      contact: "",
      room_no: "",
    });
    setEditingUser(null);
  };

  const submitUser = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        await putData(`/users/${editingUser.id}`, form);
        showSuccess("User updated");
      } else {
        await postData("/users", form);
        showSuccess("User created");
      }

      resetForm();
      loadUsers();
    } catch (error) {
      showError(error?.response?.data?.message || "Error saving user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "user",
      contact: user.contact || "",
      room_no: user.room_no || "",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete user?")) return;

    try {
      await deleteData(`/users/${id}`);
      showSuccess("User deleted");
      loadUsers();
    } catch (error) {
      showError("Failed to delete user");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        `${u.full_name} ${u.email} ${u.contact || ""} ${u.room_no || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" ? true : u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const userCount = users.filter((u) => u.role === "user").length;

  return (
    <div className="page-grid">
      <section className="glass-card">
        <h2 className="page-title">User Management</h2>
        <p className="page-subtitle">
          Create, edit, delete, and filter admin and user accounts.
        </p>

        <div className="hero-kpis">
          <div className="kpi-pill">Total: {totalUsers}</div>
          <div className="kpi-pill">Users: {userCount}</div>
          <div className="kpi-pill">Admins: {adminCount}</div>
        </div>
      </section>

      <section className="glass-card">
        <div className="search-row">
          <input
            className="input"
            placeholder="Search by name, email, contact, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ maxWidth: 160 }}
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </section>

      <section className="content-two">
        {/* USERS LIST - LEFT SIDE */}
        <div className="glass-card">
          <h3 className="section-title">Users Directory</h3>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Room</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-info">{u.role}</span>
                    </td>
                    <td>{u.contact || "-"}</td>
                    <td>{u.room_no || "-"}</td>
                    <td>{formatDateTime(u.created_at)}</td>
                    <td>
                      <div className="button-group">
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => handleEdit(u)}
                        >
                          Edit
                        </button>

                        <button
                          className="button button-danger"
                          type="button"
                          onClick={() => handleDelete(u.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredUsers.length && (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state">No users found.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* CREATE / EDIT USER - RIGHT SIDE */}
        <div className="glass-card form-grid">
          <h3 className="section-title">
            {editingUser ? "Edit User" : "Create User"}
          </h3>

          <form
            onSubmit={submitUser}
            className="form-grid"
            autoComplete="off"
          >
            <input
              className="input"
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />

            <select
              className="select"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value })
              }
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>

            <input
              className="input"
              placeholder="Contact"
              value={form.contact}
              onChange={(e) =>
                setForm({ ...form, contact: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="Room No"
              value={form.room_no}
              onChange={(e) =>
                setForm({ ...form, room_no: e.target.value })
              }
            />

            <div className="button-group">
              <button className="button button-primary" type="submit">
                {editingUser ? "Update User" : "Create User"}
              </button>

              {editingUser && (
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
        </div>
      </section>
    </div>
  );
}