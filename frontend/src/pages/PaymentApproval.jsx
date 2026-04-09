import { useEffect, useMemo, useState } from "react";
import { getData, putData } from "../services/api";
import { showError, showSuccess } from "../utils/toast";

const cardStyle = {
  background: "rgba(255,255,255,0.92)",
  borderRadius: 24,
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  outline: "none",
  fontSize: 15,
  background: "#fff",
  boxSizing: "border-box",
};

const buttonBase = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

function isPdf(url) {
  return String(url || "").toLowerCase().endsWith(".pdf");
}

export default function PaymentApproval() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [remarkMap, setRemarkMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadPayments();
    }
  }, [isAdmin]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await getData("/billing/payments/pending");
      setPayments(Array.isArray(res) ? res : []);
    } catch (error) {
      console.error("Failed to load payments", error);

      if (error?.response?.status === 403) {
        showError("Only admin can access payment approval");
        return;
      }

      showError(error?.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    try {
      await putData(`/billing/payments/${paymentId}/approve`, {
        admin_remark: remarkMap[paymentId] || "",
      });
      showSuccess("Payment approved successfully");
      await loadPayments();
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.message || "Failed to approve payment");
    }
  };

  const handleReject = async (paymentId) => {
    try {
      await putData(`/billing/payments/${paymentId}/reject`, {
        admin_remark: remarkMap[paymentId] || "",
      });
      showSuccess("Payment rejected successfully");
      await loadPayments();
    } catch (error) {
      console.error(error);
      showError(error?.response?.data?.message || "Failed to reject payment");
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      const text =
        `${item.user_name || ""} ${item.user_email || ""} ${item.receipt_no || ""} ${item.status || ""} ${item.bill?.period || ""}`
          .toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [payments, search]);

  if (!isAdmin) {
    return (
      <div style={{ ...cardStyle, padding: 28 }}>
        <h2 style={{ marginTop: 0, color: "#0f172a" }}>Payment Approval</h2>
        <p style={{ color: "#64748b", marginBottom: 0 }}>
          Only admin can access this module.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ ...cardStyle, padding: 28 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
          Payment Approval
        </h2>
        <p style={{ color: "#64748b", marginTop: 10, marginBottom: 0 }}>
          Review payment submissions and approve or reject user payments.
        </p>
      </div>

      <div style={{ ...cardStyle, padding: 22, display: "grid", gap: 16 }}>
        <input
          style={inputStyle}
          placeholder="Search by user, email, receipt, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div style={{ padding: 20, color: "#64748b" }}>Loading payments...</div>
        ) : !filteredPayments.length ? (
          <div style={{ padding: 20, color: "#64748b" }}>No payments found.</div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {filteredPayments.map((item) => {
              const proofUrl = item.proof_url
                ? `http://127.0.0.1:5000${item.proof_url}`
                : null;

              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #e5eaf2",
                    borderRadius: 18,
                    padding: 18,
                    background: "#fff",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>{item.user_name}</strong>
                    <div style={{ color: "#64748b" }}>{item.user_email}</div>
                    <div style={{ color: "#334155" }}>
                      Bill Period: <strong>{item.bill?.period || "-"}</strong>
                    </div>
                    <div style={{ color: "#334155" }}>
                      Amount: <strong>₹ {Number(item.bill?.total_amount || 0).toFixed(2)}</strong>
                    </div>
                    <div style={{ color: "#334155" }}>
                      Receipt No: <strong>{item.receipt_no || "-"}</strong>
                    </div>
                  </div>

                  {proofUrl && (
                    <div>
                      {isPdf(proofUrl) ? (
                        <a href={proofUrl} target="_blank" rel="noreferrer">
                          Open uploaded PDF proof
                        </a>
                      ) : (
                        <img
                          src={proofUrl}
                          alt="Payment Proof"
                          style={{
                            width: 260,
                            maxWidth: "100%",
                            borderRadius: 14,
                            border: "1px solid #e5e7eb",
                          }}
                        />
                      )}
                    </div>
                  )}

                  <textarea
                    style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                    placeholder="Enter admin remark..."
                    value={remarkMap[item.id] || ""}
                    onChange={(e) =>
                      setRemarkMap((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      style={{
                        ...buttonBase,
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "#fff",
                      }}
                      onClick={() => handleApprove(item.id)}
                      type="button"
                    >
                      Approve
                    </button>

                    <button
                      style={{
                        ...buttonBase,
                        background: "linear-gradient(135deg, #ef4444, #dc2626)",
                        color: "#fff",
                      }}
                      onClick={() => handleReject(item.id)}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}