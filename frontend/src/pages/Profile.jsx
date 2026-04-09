import { useEffect, useState } from "react";
import { getData, putData } from "../services/api";
import { showSuccess, showError } from "../utils/toast";

export default function Profile() {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    id: storedUser?.id || "",
    full_name: storedUser?.full_name || "",
    email: storedUser?.email || "",
    role: storedUser?.role || "user",
    contact: storedUser?.contact || "",
    room_no: storedUser?.room_no || "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      if (!storedUser?.id) return;

      const users = await getData("/users");
      const currentUser = users.find((u) => Number(u.id) === Number(storedUser.id));

      if (currentUser) {
        const updatedProfile = {
          id: currentUser.id,
          full_name: currentUser.full_name || "",
          email: currentUser.email || "",
          role: currentUser.role || "user",
          contact: currentUser.contact || "",
          room_no: currentUser.room_no || "",
        };

        setProfile(updatedProfile);
        localStorage.setItem("user", JSON.stringify(updatedProfile));
      }
    } catch (error) {
      console.error("Failed to load profile", error);
    }
  };

  const handleChange = (e) => {
    setProfile((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const payload = {
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        contact: profile.contact,
        room_no: profile.room_no,
      };

      await putData(`/users/${profile.id}`, payload);

      localStorage.setItem("user", JSON.stringify(profile));
      showSuccess("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update profile", error);
      showError(error?.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const firstLetter = (profile?.full_name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="page-grid">
      <section className="glass-card">
        <div className="profile-hero">
          <div className="profile-hero-left">
            <div className="profile-avatar-large">{firstLetter}</div>

            <div>
              <h2 className="page-title">My Profile</h2>
              <p className="page-subtitle">
                Manage your personal information and keep your account details up to date.
              </p>

              <div className="profile-badges">
                <span className="kpi-pill">Role: {profile.role}</span>
                <span className="kpi-pill">Account: Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content-two">
        <section className="glass-card">
          <h3 className="section-title">Account Overview</h3>

          <div className="list-stack">
            <div className="list-item">
              <div>
                <strong>Full Name</strong>
                <div className="muted">{profile.full_name || "-"}</div>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Email Address</strong>
                <div className="muted">{profile.email || "-"}</div>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Role</strong>
                <div className="muted profile-role-text">{profile.role || "-"}</div>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Contact Number</strong>
                <div className="muted">{profile.contact || "-"}</div>
              </div>
            </div>

            <div className="list-item">
              <div>
                <strong>Room Number</strong>
                <div className="muted">{profile.room_no || "-"}</div>
              </div>
            </div>
          </div>
        </section>

        <form className="glass-card form-grid" onSubmit={handleUpdate}>
          <h3 className="section-title">Edit Profile</h3>

          <input
            className="input"
            type="text"
            name="full_name"
            placeholder="Full name"
            value={profile.full_name}
            onChange={handleChange}
            required
          />

          <input
            className="input"
            type="email"
            name="email"
            placeholder="Email"
            value={profile.email}
            readOnly
          />

          <div className="form-row">
            <input
              className="input"
              type="text"
              name="contact"
              placeholder="Contact number"
              value={profile.contact}
              onChange={handleChange}
            />

            <input
              className="input"
              type="text"
              name="room_no"
              placeholder="Room number"
              value={profile.room_no}
              onChange={handleChange}
            />
          </div>

          <input
            className="input"
            type="text"
            name="role"
            value={profile.role}
            readOnly
          />

          <div className="button-group">
            <button className="button button-primary" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}