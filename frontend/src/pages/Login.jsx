import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  loginUser,
  googleLogin,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../services/authService";

export default function Login() {
  const navigate = useNavigate();

  const [activeForm, setActiveForm] = useState("email"); // email | phone

  const [emailForm, setEmailForm] = useState({
    email: "",
    password: "",
  });

  const [phoneForm, setPhoneForm] = useState({
    full_name: "",
    phone: "",
    otp: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");

  useEffect(() => {
    const loadGoogleScript = () => {
      if (document.getElementById("google-client-script")) return;

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.id = "google-client-script";
      document.body.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    const renderGoogleButton = () => {
      const target = document.getElementById("googleHiddenBtn");

      if (!window.google || !googleClientId || !target) return;

      target.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
      });

      window.google.accounts.id.renderButton(target, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: 360,
      });
    };

    const timer = setInterval(() => {
      if (
        window.google &&
        googleClientId &&
        document.getElementById("googleHiddenBtn")
      ) {
        renderGoogleButton();
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [activeForm]);

  const saveAuthAndRedirect = (res) => {
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    navigate("/dashboard");
  };

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const handleEmailChange = (e) => {
    setEmailForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePhoneChange = (e) => {
    setPhoneForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      resetMessages();

      const res = await loginUser(emailForm);
      saveAuthAndRedirect(res);
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    try {
      setLoading(true);
      resetMessages();

      const res = await googleLogin({
        credential: response.credential,
      });

      saveAuthAndRedirect(res);
    } catch (err) {
      setError(err?.response?.data?.message || "Google login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      resetMessages();
      setDevOtp("");

      const res = await sendPhoneOtp({
        full_name: phoneForm.full_name,
        phone: phoneForm.phone,
      });

      setOtpSent(true);
      setMessage(res.message || "OTP sent successfully");

      if (res.dev_mode && res.otp) {
        setDevOtp(res.otp);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      resetMessages();

      const res = await verifyPhoneOtp({
        full_name: phoneForm.full_name,
        phone: phoneForm.phone,
        otp: phoneForm.otp,
      });

      saveAuthAndRedirect(res);
    } catch (err) {
      setError(err?.response?.data?.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const openPhoneForm = () => {
    resetMessages();
    setActiveForm("phone");
    setOtpSent(false);
    setDevOtp("");
    setPhoneForm({
      full_name: "",
      phone: "",
      otp: "",
    });
  };

  const openEmailForm = () => {
    resetMessages();
    setActiveForm("email");
    setOtpSent(false);
    setDevOtp("");
  };

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-badge">Smart Hostel & Mess Operations</div>

          <h1 className="auth-hero-title">
            Manage meals, billing,
            <br />
            complaints and users in
            <br />
            one place.
          </h1>

          <p className="auth-hero-text">
            MessMate Pro helps admins and students manage daily mess operations
            with a simple, modern, and real-world workflow.
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
        <div className="auth-card auth-card-bms">
          <div className="auth-logo">
            <span className="auth-logo-mark" />
            <span>MessMate Pro</span>
          </div>

          <h2 className="auth-title center-title">Get Started</h2>
          <p className="auth-subtitle">
            Sign in to continue managing your mess operations smoothly.
          </p>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          {activeForm === "email" && (
            <>
              <form className="auth-form auth-main-form" onSubmit={handleEmailSubmit}>
                <div className="input-wrap">
                  <input
                    className="auth-input"
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={emailForm.email}
                    onChange={handleEmailChange}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="input-wrap">
                  <input
                    className="auth-input"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    value={emailForm.password}
                    onChange={handleEmailChange}
                    required
                    autoComplete="current-password"
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
                  {loading ? "Signing in..." : "Login with Email"}
                </button>
              </form>

              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <div className="auth-direct-options auth-direct-options-below">
                <div className="google-custom-wrapper">
                  <button
                    type="button"
                    className="auth-option-btn google-custom-visual"
                    disabled={loading}
                  >
                    <span className="auth-option-icon">
                      <img
                        src="https://developers.google.com/identity/images/g-logo.png"
                        alt="Google"
                        style={{ width: "18px", height: "18px", display: "block" }}
                      />
                    </span>
                    Continue with Google
                  </button>

                  {!import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                    <div className="auth-error google-config-error">
                      VITE_GOOGLE_CLIENT_ID is missing in frontend .env
                    </div>
                  ) : (
                    <div id="googleHiddenBtn" className="google-hidden-btn" />
                  )}
                </div>

                <button
                  type="button"
                  className="auth-option-btn"
                  onClick={openPhoneForm}
                >
                  <span className="auth-option-icon">📱</span>
                  Continue with Mobile Number
                </button>
              </div>
            </>
          )}

          {activeForm === "phone" && (
            <div className="auth-phone-section">
              <div className="auth-phone-header">
                <h3 className="auth-phone-title">Login with Mobile Number</h3>
                <p className="auth-phone-text">
                  Enter your details and verify with OTP to continue.
                </p>
              </div>

              <form
                className="auth-form auth-expand-section"
                onSubmit={handleVerifyOtp}
              >
                <div className="input-wrap">
                  <input
                    className="auth-input"
                    type="text"
                    name="full_name"
                    placeholder="Enter your full name"
                    value={phoneForm.full_name}
                    onChange={handlePhoneChange}
                    required
                  />
                </div>

                <div className="input-wrap phone-input-wrap">
                  <span className="phone-prefix">+91</span>
                  <input
                    className="auth-input phone-input"
                    type="tel"
                    name="phone"
                    placeholder="Enter phone number"
                    value={phoneForm.phone}
                    onChange={handlePhoneChange}
                    required
                  />
                </div>

                {!otpSent ? (
                  <>
                    <button
                      className="auth-button"
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                    >
                      {loading ? "Sending OTP..." : "Send OTP"}
                    </button>

                    <button
                      type="button"
                      className="auth-switch-btn"
                      onClick={openEmailForm}
                    >
                      Back to Email Login
                    </button>
                  </>
                ) : (
                  <>
                    <div className="input-wrap">
                      <input
                        className="auth-input"
                        type="text"
                        name="otp"
                        placeholder="Enter OTP"
                        value={phoneForm.otp}
                        onChange={handlePhoneChange}
                        required
                      />
                    </div>

                    {devOtp && (
                      <div className="auth-dev-otp">
                        Dev OTP: <strong>{devOtp}</strong>
                      </div>
                    )}

                    <button
                      className="auth-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? "Verifying..." : "Login with Phone"}
                    </button>

                    <button
                      type="button"
                      className="auth-switch-btn"
                      onClick={openEmailForm}
                    >
                      Back to Email Login
                    </button>
                  </>
                )}
              </form>
            </div>
          )}

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