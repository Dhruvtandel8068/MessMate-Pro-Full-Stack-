import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  return (
    <header className="top-navbar">
      <div className="top-navbar-inner">
        <div className="top-navbar-brand">
          <h1>MessMate Pro</h1>
          <p>{isAdmin ? "Admin Control Panel" : "User Panel"}</p>
        </div>

        <nav className="top-navbar-links">
          <NavLink to="/dashboard" className="top-nav-link">
            Dashboard
          </NavLink>

          <NavLink to="/menu" className="top-nav-link">
            Menu
          </NavLink>

          <NavLink to="/attendance" className="top-nav-link">
            Attendance
          </NavLink>

          <NavLink to="/billing" className="top-nav-link">
            Billing
          </NavLink>

          <NavLink to="/complaints" className="top-nav-link">
            Complaints
          </NavLink>

          <NavLink to="/notifications" className="top-nav-link">
            Notifications
          </NavLink>

          {isAdmin && (
            <>
              <NavLink to="/expenses" className="top-nav-link">
                Expenses
              </NavLink>

              <NavLink to="/reports" className="top-nav-link">
                Reports
              </NavLink>

              <NavLink to="/inventory" className="top-nav-link">
                Inventory
              </NavLink>

              <NavLink to="/users" className="top-nav-link">
                Users
              </NavLink>

              <NavLink to="/payment-approval" className="top-nav-link">
                Payment Approval
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}