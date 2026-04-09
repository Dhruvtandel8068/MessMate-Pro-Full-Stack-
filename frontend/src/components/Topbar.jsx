import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/menu": "Meal Menu",
  "/attendance": "Attendance",
  "/billing": "Billing",
  "/payment-approval": "Payment Approval",
  "/complaints": "Complaints",
  "/notifications": "Notifications",
  "/profile": "Profile Settings",
  "/change-password": "Change Password",
  "/expenses": "Expenses",
  "/reports": "Reports",
  "/inventory": "Inventory",
  "/users": "Users",
};

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const syncUser = () => {
      try {
        setUser(JSON.parse(localStorage.getItem("user") || "null"));
      } catch {
        setUser(null);
      }
    };

    syncUser();
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const currentTitle = pageTitles[location.pathname] || "Dashboard";
  const displayName = user?.full_name || user?.email || "User";
  const role = user?.role || "user";
  const firstLetter = displayName.charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <div>
        <h1>{currentTitle}</h1>
        <p>
          Welcome back, <strong>{displayName}</strong>
          <span className="role-chip">{role}</span>
        </p>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-action-btn"
          title="Notifications"
          onClick={() => navigate("/notifications")}
        >
          <span className="icon-symbol">🔔</span>
          <span className="notification-dot" />
        </button>

        <button
          type="button"
          className="theme-toggle-btn"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          onClick={() => setIsDarkMode((prev) => !prev)}
        >
          {isDarkMode ? "☀️ Light" : "🌙 Dark"}
        </button>

        <div className="topbar-right" ref={dropdownRef}>
          <button
            type="button"
            className="profile-dropdown-trigger"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <div className="avatar">{firstLetter}</div>

            <div className="profile-meta">
              <span className="profile-name">{displayName}</span>
              <span className="profile-role">{role}</span>
            </div>

            <span className="profile-caret">{menuOpen ? "▲" : "▼"}</span>
          </button>

          {menuOpen && (
            <div className="profile-dropdown-menu">
              <button
                type="button"
                className="profile-dropdown-item"
                onClick={() => {
                  navigate("/profile");
                  setMenuOpen(false);
                }}
              >
                My Profile
              </button>

              <button
                type="button"
                className="profile-dropdown-item"
                onClick={() => {
                  navigate("/change-password");
                  setMenuOpen(false);
                }}
              >
                Change Password
              </button>

              <button
                type="button"
                className="profile-dropdown-item logout-item"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}