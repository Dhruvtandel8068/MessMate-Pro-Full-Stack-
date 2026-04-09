import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
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

      const res = await loginUser(formData);

      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));

      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-badge">Smart Hostel & Mess Operations</div>
          <h1 className="auth-hero-title">Manage meals, billing, complaints and users in one place.</h1>
          <p className="auth-hero-text">
            MessMate Pro helps admins and students handle daily mess operations
            with a modern, centralized, and real-world workflow.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span className="auth-feature-dot" />
              Dashboard insights for expenses, inventory, bills and complaints
            </div>
            <div className="auth-feature">
              <span className="auth-feature-dot" />
              Role-based access for admin and student users
            </div>
            <div className="auth-feature">
              <span className="auth-feature-dot" />
              Easy attendance, menu planning and operational tracking
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

          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">
            Sign in to continue to your smart mess management dashboard.
          </p>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-wrap">
              <input
                className="auth-input"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-wrap">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
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

            <button className="auth-button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="auth-footer">
            Don’t have an account?{" "}
            <Link className="auth-link" to="/register">
              Register
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}