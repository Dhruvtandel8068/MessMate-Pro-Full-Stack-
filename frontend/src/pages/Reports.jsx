import { useEffect, useState } from "react";
import { getData } from "../services/api";
import { formatDate } from "../utils/format";

export default function Reports() {
  const [summary, setSummary] = useState({});
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentComplaints, setRecentComplaints] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await getData("/reports/summary");

    setSummary(res || {});
    setRecentExpenses(res?.recent_expenses || []);
    setRecentComplaints(res?.recent_complaints || []);
  };

  return (
    <div className="page-grid">
      <section className="glass-card">
        <h2 className="page-title">Reports</h2>
        <p className="page-subtitle">
          View system summary and export reports.
        </p>
      </section>

      {/* SUMMARY */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{summary.total_users || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Expense</div>
          <div className="stat-value">
            ₹ {Number(summary.total_expense || 0).toFixed(2)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Meals</div>
          <div className="stat-value">{summary.total_attendance || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Meals Today</div>
          <div className="stat-value">{summary.meals_today || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Pending Complaints</div>
          <div className="stat-value">
            {summary.pending_complaints || 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Unpaid Bills</div>
          <div className="stat-value">{summary.unpaid_bills || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-value">{summary.low_stock_items || 0}</div>
        </div>
      </section>

      {/* RECENT DATA */}
      <section className="content-two">
        {/* Recent Expenses */}
        <div className="glass-card">
          <h3 className="section-title">Recent Expenses</h3>

          {recentExpenses.length ? (
            <div className="list-stack">
              {recentExpenses.map((item, index) => (
                <div key={index} className="list-item">
                  <div>
                    <strong>{item.title}</strong>

                    {/* ✅ FIXED DATE FORMAT */}
                    <div className="muted">
                      {formatDate(item.expense_date)}
                    </div>
                  </div>

                  <div>
                    <span className="badge badge-info">
                      ₹ {Number(item.amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No expenses available.</div>
          )}
        </div>

        {/* Recent Complaints */}
        <div className="glass-card">
          <h3 className="section-title">Recent Complaints</h3>

          {recentComplaints.length ? (
            <div className="list-stack">
              {recentComplaints.map((item) => (
                <div key={item.id} className="list-item">
                  <div>
                    <strong>{item.type}</strong>
                    <div className="muted">{item.message}</div>
                  </div>

                  <div>
                    <span className="badge badge-info">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No complaints available.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}