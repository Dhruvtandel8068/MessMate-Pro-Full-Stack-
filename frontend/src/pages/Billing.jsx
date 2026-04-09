import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import api from "../services/api";

export default function Billing() {
  const [bills, setBills] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentFile, setPaymentFile] = useState({});
  const [paymentNote, setPaymentNote] = useState({});
  const [generating, setGenerating] = useState(false);

  // NEW: track which bill's Razorpay popup is opening
  const [razorpayLoadingId, setRazorpayLoadingId] = useState(null);

  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [generateMonth, setGenerateMonth] = useState(currentMonth);
  const [generateYear, setGenerateYear] = useState(currentYear);
  const [perMealCost, setPerMealCost] = useState(100);
  const [billingType, setBillingType] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("");

  const UPI_ID = "dhruvtandel8068@okaxis";
  const PAYEE_NAME = "MessMate Pro";

  // ─── Data loaders ──────────────────────────────────────────────────────────

  const loadBills = async () => {
    try {
      const res = await api.get("/billing/");
      setBills(res.data || []);
    } catch (error) {
      console.error("Error loading bills:", error);
      alert("Failed to load bills");
    }
  };

  const loadPendingPayments = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/billing/payments/pending");
      setPendingPayments(res.data || []);
    } catch (error) {
      console.error("Error loading pending payments:", error);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/billing/users-list");
      setUsers(res.data || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadBills(), loadPendingPayments(), loadUsers()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Admin: generate bills ─────────────────────────────────────────────────

  const handleGenerateBills = async () => {
    try {
      if (billingType === "single" && !selectedUserId) {
        alert("Please select a user");
        return;
      }

      setGenerating(true);

      const payload = {
        month: Number(generateMonth),
        year: Number(generateYear),
        per_meal_cost: Number(perMealCost),
        billing_type: billingType,
      };

      if (billingType === "single") {
        payload.user_id = Number(selectedUserId);
      }

      const res = await api.post("/billing/generate", payload);
      alert(res.data.message || "Bills generated successfully");
      loadData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to generate bills");
    } finally {
      setGenerating(false);
    }
  };

  // ─── PDF download ──────────────────────────────────────────────────────────

  const handleDownloadPdf = async (billId) => {
    try {
      const response = await api.get(`/billing/${billId}/download-pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `bill_${billId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert("Failed to download PDF");
    }
  };

  // ─── Manual UPI / QR proof upload (existing flow) ─────────────────────────

  const handleFileChange = (billId, file) => {
    setPaymentFile((prev) => ({ ...prev, [billId]: file }));
  };

  const handleNoteChange = (billId, note) => {
    setPaymentNote((prev) => ({ ...prev, [billId]: note }));
  };

  const openQrModal = (bill) => {
    setSelectedBill(bill);
    setShowQrModal(true);
  };

  const closeQrModal = () => {
    setShowQrModal(false);
    setSelectedBill(null);
  };

  const buildUpiLink = (bill) => {
    const amount = Number(bill?.total_amount || 0).toFixed(2);
    const note = `Mess Bill ${bill?.period || ""}`;
    return `upi://pay?pa=${encodeURIComponent(
      UPI_ID
    )}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${encodeURIComponent(
      amount
    )}&cu=INR&tn=${encodeURIComponent(note)}`;
  };

  const handleOpenUpiApp = () => {
    if (!selectedBill) return;
    window.location.href = buildUpiLink(selectedBill);
  };

  const handlePaymentSubmit = async (billId) => {
    try {
      const formData = new FormData();

      if (paymentFile[billId]) {
        formData.append("proof", paymentFile[billId]);
      }

      formData.append("note", paymentNote[billId] || "");
      formData.append("mode", "UPI");

      await api.post(`/billing/${billId}/pay`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Payment proof submitted successfully. Waiting for admin approval.");
      setPaymentFile((prev) => ({ ...prev, [billId]: null }));
      setPaymentNote((prev) => ({ ...prev, [billId]: "" }));
      closeQrModal();
      loadData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Payment submission failed");
    }
  };

  // ─── NEW: Razorpay online payment ──────────────────────────────────────────

  const handleRazorpayPayment = async (bill) => {
    // Check Razorpay script loaded (added in index.html)
    if (typeof window.Razorpay === "undefined") {
      alert(
        "Razorpay failed to load. Please check your internet connection and refresh the page."
      );
      return;
    }

    setRazorpayLoadingId(bill.id);

    try {
      // STEP 1 — create order on our backend
      const res = await api.post(`/billing/${bill.id}/razorpay-order`);
      const { order_id, amount, currency, key_id, period, total_amount } = res.data;

      // STEP 2 — open Razorpay checkout popup
      const options = {
        key: key_id,
        amount: amount,         // in paise
        currency: currency,
        name: "Mess Operations",
        description: `Mess Bill — ${period}`,
        order_id: order_id,

        // STEP 3 — runs automatically after user pays inside the popup
        handler: async function (response) {
          try {
            // Send the 3 Razorpay IDs to our backend for signature verification
            await api.post(`/billing/${bill.id}/razorpay-verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            alert(
              `✅ Payment successful!\n` +
              `Amount: ₹${Number(total_amount).toFixed(2)} for ${period}\n` +
              `Payment ID: ${response.razorpay_payment_id}\n\n` +
              `Your bill is now marked as Paid.`
            );

            loadData(); // refresh bills list
          } catch (err) {
            console.error("Verification error:", err);
            alert(
              (err?.response?.data?.message || "Payment verification failed.") +
              `\n\nPlease contact admin with your Payment ID: ${response.razorpay_payment_id}`
            );
          } finally {
            setRazorpayLoadingId(null);
          }
        },

        // Pre-fill user details in the popup
        prefill: {
          name: user?.full_name || "",
          email: user?.email || "",
          contact: user?.contact || "",
        },

        notes: {
          bill_id: String(bill.id),
          period: period,
        },

        theme: {
          color: "#2563eb",
        },

        modal: {
          // Called when user closes the popup without paying
          ondismiss: function () {
            setRazorpayLoadingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      // Called if user's payment fails inside the popup (e.g. wrong OTP)
      rzp.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);
        alert(
          `Payment failed.\nReason: ${response.error.description}\n\n` +
          `You can try again or use the manual UPI option.`
        );
        setRazorpayLoadingId(null);
      });

      rzp.open();
    } catch (err) {
      console.error("Razorpay init error:", err);
      alert(
        err?.response?.data?.message ||
        "Could not initiate payment. Please try again."
      );
      setRazorpayLoadingId(null);
    }
  };

  // ─── Admin: approve / reject manual payments ───────────────────────────────

  const approvePayment = async (paymentId) => {
    try {
      await api.put(`/billing/payments/${paymentId}/approve`, {
        admin_remark: "Payment approved",
      });
      alert("Payment approved successfully");
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to approve payment");
    }
  };

  const rejectPayment = async (paymentId) => {
    const reason = prompt("Enter rejection reason:") || "Invalid payment proof";
    try {
      await api.put(`/billing/payments/${paymentId}/reject`, {
        admin_remark: reason,
      });
      alert("Payment rejected successfully");
      loadData();
    } catch (error) {
      console.error(error);
      alert("Failed to reject payment");
    }
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalBills = bills.length;
    const paidBills = bills.filter((b) => b.status === "Paid").length;
    const unpaidBills = bills.filter((b) => b.status === "Unpaid").length;
    const pendingBills = bills.filter(
      (b) => b.status === "Pending Approval"
    ).length;
    return { totalBills, paidBills, unpaidBills, pendingBills };
  }, [bills]);

  if (loading) {
    return <div style={styles.loading}>Loading billing data...</div>;
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Billing Management</h2>
          <p style={styles.subtitle}>
            Manage bills, download PDF statements, and review payments.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <h3>Total Bills</h3>
          <p>{stats.totalBills}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Paid</h3>
          <p style={{ color: "#16a34a" }}>{stats.paidBills}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Unpaid</h3>
          <p style={{ color: "#dc2626" }}>{stats.unpaidBills}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Pending Approval</h3>
          <p style={{ color: "#d97706" }}>{stats.pendingBills}</p>
        </div>
      </div>

      {/* Admin: generate bills */}
      {isAdmin && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Generate Monthly Bills</h3>

          <div style={styles.generateGrid}>
            <select
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              style={styles.input}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={generateYear}
              onChange={(e) => setGenerateYear(e.target.value)}
              style={styles.input}
              placeholder="Year"
            />

            <input
              type="number"
              value={perMealCost}
              onChange={(e) => setPerMealCost(e.target.value)}
              style={styles.input}
              placeholder="Per meal cost"
            />

            <select
              value={billingType}
              onChange={(e) => {
                setBillingType(e.target.value);
                if (e.target.value === "all") setSelectedUserId("");
              }}
              style={styles.input}
            >
              <option value="all">All Users</option>
              <option value="single">Single User</option>
            </select>

            {billingType === "single" && (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={styles.input}
              >
                <option value="">Select User</option>
                {users.map((userItem) => (
                  <option key={userItem.id} value={userItem.id}>
                    {userItem.full_name} ({userItem.email})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleGenerateBills}
              disabled={generating}
              style={styles.primaryBtn}
            >
              {generating ? "Generating..." : "Generate Bills"}
            </button>
          </div>
        </div>
      )}

      {/* Bills table */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Bills</h3>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {isAdmin && <th style={styles.thLeft}>User</th>}
                <th style={styles.thLeft}>Period</th>
                <th style={styles.thCenter}>Meals</th>
                <th style={styles.thCenter}>Per Meal</th>
                <th style={styles.thCenter}>Total</th>
                <th style={styles.thCenter}>Status</th>
                <th style={styles.thCenter}>PDF</th>
                {!isAdmin && <th style={styles.thCenter}>Payment</th>}
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 8} style={styles.emptyCell}>
                    No bills found
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id}>
                    {isAdmin && (
                      <td style={styles.tdLeft}>{bill.user_name}</td>
                    )}
                    <td style={styles.tdLeft}>{bill.period}</td>
                    <td style={styles.tdCenter}>{bill.total_meals}</td>
                    <td style={styles.tdCenter}>
                      ₹{Number(bill.per_meal_cost || 0).toFixed(2)}
                    </td>
                    <td style={styles.tdCenter}>
                      <strong>
                        ₹{Number(bill.total_amount || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td style={styles.tdCenter}>
                      <div style={styles.centerBox}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(bill.status === "Paid"
                              ? styles.paid
                              : bill.status === "Pending Approval"
                              ? styles.pending
                              : styles.unpaid),
                          }}
                        >
                          {bill.status}
                        </span>
                      </div>
                    </td>
                    <td style={styles.tdCenter}>
                      <div style={styles.centerBox}>
                        <button
                          onClick={() => handleDownloadPdf(bill.id)}
                          style={styles.secondaryBtn}
                        >
                          Download PDF
                        </button>
                      </div>
                    </td>

                    {/* Payment column — regular users only */}
                    {!isAdmin && (
                      <td style={styles.tdCenter}>
                        {bill.status === "Unpaid" ? (
                          <div style={styles.payBtnGroup}>
                            {/*
                              Option 1 — Pay online via Razorpay
                              Instant, auto-approved, no admin action needed
                            */}
                            <button
                              onClick={() => handleRazorpayPayment(bill)}
                              disabled={razorpayLoadingId === bill.id}
                              style={styles.razorpayBtn}
                              title="Pay instantly online — no admin approval needed"
                            >
                              {razorpayLoadingId === bill.id
                                ? "Opening..."
                                : `Pay Online ₹${Number(bill.total_amount).toFixed(0)}`}
                            </button>

                            {/*
                              Option 2 — Manual UPI proof upload (existing flow)
                              User scans QR, uploads screenshot, admin approves
                            */}
                            <button
                              onClick={() => openQrModal(bill)}
                              style={styles.secondaryBtn}
                              title="Pay via UPI and upload proof for admin approval"
                            >
                              Pay via UPI
                            </button>
                          </div>
                        ) : bill.status === "Pending Approval" ? (
                          <span style={styles.pendingText}>
                            Awaiting admin approval
                          </span>
                        ) : (
                          <span style={styles.paidText}>✓ Paid</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin: manual payment approval queue */}
      {isAdmin && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            Pending Payment Approvals
            {pendingPayments.length > 0 && (
              <span style={styles.countBadge}>{pendingPayments.length}</span>
            )}
          </h3>

          {pendingPayments.length === 0 ? (
            <p style={styles.muted}>No pending payments</p>
          ) : (
            <div style={styles.pendingGrid}>
              {pendingPayments.map((payment) => (
                <div key={payment.id} style={styles.pendingCard}>
                  <h4 style={{ marginBottom: 8 }}>{payment.user_name}</h4>
                  <p>
                    <strong>Email:</strong> {payment.user_email}
                  </p>
                  <p>
                    <strong>Period:</strong> {payment.bill?.period || "-"}
                  </p>
                  <p>
                    <strong>Amount:</strong> ₹
                    {Number(payment.bill?.total_amount || 0).toFixed(2)}
                  </p>
                  <p>
                    <strong>Note:</strong> {payment.note || "-"}
                  </p>

                  {payment.proof_url && (
                    <a
                      href={payment.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.link}
                    >
                      View Payment Proof →
                    </a>
                  )}

                  <div style={styles.actionRow}>
                    <button
                      onClick={() => approvePayment(payment.id)}
                      style={styles.successBtn}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectPayment(payment.id)}
                      style={styles.dangerBtn}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual UPI payment modal — unchanged from original */}
      {showQrModal && selectedBill && (
        <div style={styles.modalOverlay} onClick={closeQrModal}>
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>
                Pay Bill — {selectedBill.period}
              </h3>
              <button onClick={closeQrModal} style={styles.closeBtn}>
                ×
              </button>
            </div>

            <p style={styles.modalText}>
              Scan this QR code to pay to your UPI ID. After paying, upload
              the screenshot below for admin approval.
            </p>

            <div style={styles.qrWrap}>
              <QRCode
                value={buildUpiLink(selectedBill)}
                size={220}
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>

            <div style={styles.amountBox}>
              <span>Total Amount:</span>
              <strong>
                ₹{Number(selectedBill.total_amount || 0).toFixed(2)}
              </strong>
            </div>

            <button
              onClick={handleOpenUpiApp}
              style={{
                ...styles.secondaryBtn,
                width: "100%",
                marginBottom: "12px",
              }}
            >
              Open UPI App
            </button>

            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 6px" }}>
              Upload payment screenshot:
            </p>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                handleFileChange(selectedBill.id, e.target.files?.[0] || null)
              }
              style={styles.fileInput}
            />

            <input
              type="text"
              placeholder="Payment note / UPI reference"
              value={paymentNote[selectedBill.id] || ""}
              onChange={(e) =>
                handleNoteChange(selectedBill.id, e.target.value)
              }
              style={{
                ...styles.input,
                width: "100%",
                boxSizing: "border-box",
                marginBottom: "12px",
              }}
            />

            <button
              onClick={() => handlePaymentSubmit(selectedBill.id)}
              style={{ ...styles.primaryBtn, width: "100%" }}
            >
              Submit Payment Proof
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    padding: "24px",
    background: "#f8fbff",
    minHeight: "100vh",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: "6px",
    color: "#64748b",
  },
  loading: {
    padding: "30px",
    fontSize: "18px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
  },
  card: {
    background: "#fff",
    borderRadius: "18px",
    padding: "20px",
    marginBottom: "20px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: "16px",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  countBadge: {
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "13px",
    fontWeight: "600",
  },
  generateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    alignItems: "center",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    minWidth: "140px",
    outline: "none",
  },
  primaryBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: "600",
  },
  // NEW: Razorpay button — bolder label to signal "online payment"
  razorpayBtn: {
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
    width: "100%",
  },
  secondaryBtn: {
    background: "#e0f2fe",
    color: "#075985",
    border: "none",
    borderRadius: "10px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: "600",
  },
  successBtn: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
  },
  dangerBtn: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    cursor: "pointer",
  },
  // NEW: two-button stack for the payment column
  payBtnGroup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "6px",
    minWidth: "150px",
  },
  pendingText: {
    color: "#d97706",
    fontSize: "13px",
  },
  paidText: {
    color: "#16a34a",
    fontSize: "13px",
    fontWeight: "600",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  thLeft: {
    textAlign: "left",
    padding: "12px 16px",
    color: "#0f172a",
    fontWeight: "700",
  },
  thCenter: {
    textAlign: "center",
    padding: "12px 16px",
    color: "#0f172a",
    fontWeight: "700",
  },
  tdLeft: {
    textAlign: "left",
    padding: "10px 16px",
    verticalAlign: "middle",
    color: "#0f172a",
  },
  tdCenter: {
    textAlign: "center",
    padding: "10px 16px",
    verticalAlign: "middle",
    color: "#0f172a",
  },
  centerBox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCell: {
    textAlign: "center",
    padding: "20px",
    color: "#64748b",
  },
  badge: {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "52px",
  },
  paid: {
    background: "#dcfce7",
    color: "#166534",
  },
  unpaid: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  pending: {
    background: "#fef3c7",
    color: "#92400e",
  },
  fileInput: {
    fontSize: "13px",
    marginBottom: "12px",
    display: "block",
  },
  muted: {
    color: "#64748b",
  },
  pendingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  pendingCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "16px",
    background: "#f8fafc",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    display: "inline-block",
    marginTop: "8px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: "16px",
  },
  modalCard: {
    background: "#ffffff",
    width: "100%",
    maxWidth: "460px",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  closeBtn: {
    border: "none",
    background: "transparent",
    fontSize: "28px",
    cursor: "pointer",
    color: "#334155",
    lineHeight: 1,
  },
  modalText: {
    color: "#64748b",
    marginBottom: "16px",
  },
  qrWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f8fafc",
    borderRadius: "18px",
    padding: "16px",
    marginBottom: "16px",
  },
  amountBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    padding: "12px 14px",
    marginBottom: "14px",
    color: "#1e3a8a",
  },
};