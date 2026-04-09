import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    contact: "",
    room_no: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      await registerUser(formData);
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-badge">Create Your Smart Account</div>
          <h1 className="auth-hero-title">Start using a more modern mess management experience.</h1>
          <p className="auth-hero-text">
            Register to access attendance, menu updates, billing information,
            notifications, and a cleaner student/admin workflow.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span className="auth-feature-dot" />
              View meals, notifications and billing from one account
            </div>
            <div className="auth-feature">
              <span className="auth-feature-dot" />
              Submit complaints and track operational updates easily
            </div>
            <div className="auth-feature">
              <span className="auth-feature-dot" />
              Built for a real-world hostel and mess administration system
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="auth-logo-mark" />
            <span>MessMate Pro</span>
          </div>

          <h2 className="auth-title">Create account</h2>
          <p className="auth-subtitle">
            Register your profile to get started with the platform.
          </p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              className="auth-input"
              type="text"
              name="full_name"
              placeholder="Full name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />

            <input
              className="auth-input"
              type="email"
              name="email"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <div className="input-wrap">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="auth-form-row">
              <input
                className="auth-input"
                type="text"
                name="contact"
                placeholder="Contact number"
                value={formData.contact}
                onChange={handleChange}
              />

              <input
                className="auth-input"
                type="text"
                name="room_no"
                placeholder="Room number"
                value={formData.room_no}
                onChange={handleChange}
              />
            </div>

            <button className="auth-button" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Register"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?{" "}
            <Link className="auth-link" to="/login">
              Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}