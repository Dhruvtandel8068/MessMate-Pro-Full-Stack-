import { useState } from "react";
import { putData } from "../services/api";
import { showSuccess, showError } from "../utils/toast";

export default function ChangePassword() {
  const [form, setForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.old_password || !form.new_password || !form.confirm_password) {
      showError("Please fill all fields");
      return;
    }

    if (form.new_password !== form.confirm_password) {
      showError("New password and confirm password do not match");
      return;
    }

    try {
      setSaving(true);

      const res = await putData("/auth/change-password", form);
      showSuccess(res?.message || "Password changed successfully");

      setForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error) {
      console.error("Failed to change password", error);
      showError(
        error?.response?.data?.message || "Failed to change password"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="glass-card">
        <div className="hero-strip">
          <div>
            <h2 className="page-title">Change Password</h2>
            <p className="page-subtitle">
              Keep your account secure by updating your password regularly.
            </p>
          </div>
          <div className="hero-kpis">
            <div className="kpi-pill">Security Settings</div>
          </div>
        </div>
      </section>

      <section className="content-two">
        <form className="glass-card form-grid" onSubmit={handleSubmit}>
          <h3 className="section-title">Update Your Password</h3>

          <input
            className="input"
            type="password"
            placeholder="Enter old password"
            value={form.old_password}
            onChange={(e) =>
              setForm({ ...form, old_password: e.target.value })
            }
          />

          <input
            className="input"
            type="password"
            placeholder="Enter new password"
            value={form.new_password}
            onChange={(e) =>
              setForm({ ...form, new_password: e.target.value })
            }
          />

          <input
            className="input"
            type="password"
            placeholder="Confirm new password"
            value={form.confirm_password}
            onChange={(e) =>
              setForm({ ...form, confirm_password: e.target.value })
            }
          />

          <div className="button-group">
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>

        <section className="glass-card">
          <h3 className="section-title">Password Tips</h3>

          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <strong>Use a strong password</strong>
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                Include uppercase, lowercase, numbers, and symbols.
              </p>
            </div>

            <div>
              <strong>Do not reuse old passwords</strong>
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                Choose a fresh password that you do not use elsewhere.
              </p>
            </div>

            <div>
              <strong>Keep it private</strong>
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                Never share your password with anyone.
              </p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}