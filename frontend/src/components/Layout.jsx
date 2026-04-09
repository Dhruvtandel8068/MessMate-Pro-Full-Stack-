import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

export default function Layout() {
  const navigate = useNavigate();
  const [user, setUser] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(storedUser);

    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark";
    setDarkMode(isDark);
    document.body.classList.toggle("dark-mode", isDark);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", sidebarOpen);
  }, [sidebarOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.body.classList.toggle("dark-mode", next);
  };

  const displayName = user?.full_name || "User";
  const displayRole = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "User";

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <button
              className="button button-secondary mobile-menu-btn"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              ☰ Menu
            </button>

            <div>
              <h1 className="topbar-title">Mess Operations Dashboard</h1>
              <p className="topbar-subtitle">
                Welcome back, {displayName} ({displayRole})
              </p>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="theme-toggle" onClick={toggleTheme} type="button">
              {darkMode ? "☀ Light" : "🌙 Dark"}
            </button>

            <div className="avatar-chip">
              <span className="avatar-dot" />
              <span>{displayRole} Online</span>
            </div>

            <button className="button button-dark" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}