import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import Menu from "../pages/Menu";
import Attendance from "../pages/Attendance";
import Billing from "../pages/Billing";
import PaymentApproval from "../pages/PaymentApproval";
import Complaints from "../pages/Complaints";
import Notifications from "../pages/Notifications";
import Profile from "../pages/Profile";
import Expenses from "../pages/Expenses";
import Reports from "../pages/Reports";
import Inventory from "../pages/Inventory";
import Users from "../pages/Users";
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import ChangePassword from "../pages/ChangePassword";

export default function AppRoutes() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
      />

      <Route
        path="/login"
        element={token ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      <Route
        path="/register"
        element={token ? <Navigate to="/dashboard" replace /> : <Register />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/users" element={<Users />} />
          {user?.role === "admin" && (
            <Route path="/payment-approval" element={<PaymentApproval />} />
          )}
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={token ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}