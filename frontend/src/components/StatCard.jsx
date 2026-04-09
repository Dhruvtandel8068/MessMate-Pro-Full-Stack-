import { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import { getData } from "../services/api";

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [summary, setSummary] = useState({
    total_users: 0,
    total_admins: 0,
    total_menu_items: 0,
    total_attendance_rows: 0,
    total_expense: 0,
  });

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const data = await getData("/reports/summary");
      setSummary(data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="dashboard-wrap">
      <div className="hero-card">
        <div>
          <span className="hero-badge">Mess Management System</span>
          <h2>{isAdmin ? "Admin Dashboard" : "User Dashboard"}</h2>
          <p>
            Manage attendance, menu, billing, users, expenses and reports from one
            modern control panel.
          </p>
        </div>
      </div>

      <div className="grid-cards">
        <StatCard
          title="Total Users"
          value={summary.total_users}
          subtitle="Registered system users"
          icon="👥"
        />
        <StatCard
          title="Admins"
          value={summary.total_admins}
          subtitle="Users with admin access"
          icon="🛡️"
        />
        <StatCard
          title="Menu Items"
          value={summary.total_menu_items}
          subtitle="Food items created"
          icon="🍽️"
        />
        <StatCard
          title="Attendance Rows"
          value={summary.total_attendance_rows}
          subtitle="Tracked attendance entries"
          icon="📅"
        />
      </div>

      <div className="dashboard-grid-2">
        <div className="section-card">
          <div className="section-head">
            <h3>System Overview</h3>
          </div>
          <div className="overview-list">
            <div className="overview-item">
              <span>Total Expense</span>
              <strong>₹ {summary.total_expense}</strong>
            </div>
            <div className="overview-item">
              <span>Current Role</span>
              <strong>{user?.role || "user"}</strong>
            </div>
            <div className="overview-item">
              <span>Logged in as</span>
              <strong>{user?.email || "-"}</strong>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-head">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <div className="quick-action-card">
              <h4>Add Attendance</h4>
              <p>Track daily breakfast, lunch and dinner attendance.</p>
            </div>
            <div className="quick-action-card">
              <h4>Manage Menu</h4>
              <p>Create and update meals for students and staff.</p>
            </div>
            <div className="quick-action-card">
              <h4>Track Expenses</h4>
              <p>Record daily mess spending and cost breakdown.</p>
            </div>
            <div className="quick-action-card">
              <h4>View Reports</h4>
              <p>Check summary numbers and operational insights.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}