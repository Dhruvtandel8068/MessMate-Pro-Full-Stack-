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

      const res = await api.post(`/billing/${billId}/pay`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert(res?.data?.message || "Payment proof submitted successfully");
      setPaymentFile((prev) => ({ ...prev, [billId]: null }));
      setPaymentNote((prev) => ({ ...prev, [billId]: "" }));
      closeQrModal();
      loadData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Payment submission failed");
    }
  };

  const handleRazorpayPayment = async (bill) => {
    if (typeof window.Razorpay === "undefined") {
      alert(
        "Razorpay failed to load. Please check your internet connection and refresh the page."
      );
      return;
    }

    setRazorpayLoadingId(bill.id);

    try {
      const res = await api.post(`/billing/${bill.id}/razorpay-order`);
      const { order_id, amount, currency, key_id, period } = res.data;

      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: "Mess Operations",
        description: `Mess Bill — ${period}`,
        order_id: order_id,
        handler: async function (response) {
          try {
            const verifyRes = await api.post(`/billing/${bill.id}/razorpay-verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            alert(
              verifyRes?.data?.message ||
                "Payment submitted successfully and is waiting for admin approval"
            );

            loadData();
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
          ondismiss: function () {
            setRazorpayLoadingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);

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

  const approvePayment = async (paymentId) => {
    try {
      const res = await api.put(`/billing/payments/${paymentId}/approve`, {
        admin_remark: "Payment approved",
      });
      alert(res?.data?.message || "Payment approved successfully");
      loadData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to approve payment");
    }
  };

  const rejectPayment = async (paymentId) => {
    const reason = prompt("Enter rejection reason:") || "Invalid payment proof";
    try {
      const res = await api.put(`/billing/payments/${paymentId}/reject`, {
        admin_remark: reason,
      });
      alert(res?.data?.message || "Payment rejected successfully");
      loadData();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Failed to reject payment");
    }
  };

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
    return <div className="attendance-style-loading">Loading billing data...</div>;
  }

  return (
    <div className="attendance-style-page">
      <section className="attendance-style-section-header">
        <h2 className="attendance-style-title">Billing Management</h2>
        <p className="attendance-style-subtitle">
          Manage bills, download PDF statements, and review payments.
        </p>
      </section>

      <section className="attendance-style-stats-grid">
        <div className="attendance-style-stat-card">
          <h3>Total Bills</h3>
          <p>{stats.totalBills}</p>
        </div>
        <div className="attendance-style-stat-card">
          <h3>Paid</h3>
          <p className="stat-green">{stats.paidBills}</p>
        </div>
        <div className="attendance-style-stat-card">
          <h3>Unpaid</h3>
          <p className="stat-red">{stats.unpaidBills}</p>
        </div>
        <div className="attendance-style-stat-card">
          <h3>Pending Approval</h3>
          <p className="stat-orange">{stats.pendingBills}</p>
        </div>
      </section>

      {isAdmin && (
        <section className="attendance-style-card">
          <h3 className="attendance-style-card-title">Generate Monthly Bills</h3>

          <div className="attendance-style-generate-grid">
            <select
              value={generateMonth}
              onChange={(e) => setGenerateMonth(e.target.value)}
              className="attendance-style-input"
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
              className="attendance-style-input"
              placeholder="Year"
            />

            <input
              type="number"
              value={perMealCost}
              onChange={(e) => setPerMealCost(e.target.value)}
              className="attendance-style-input"
              placeholder="Per meal cost"
            />

            <select
              value={billingType}
              onChange={(e) => {
                setBillingType(e.target.value);
                if (e.target.value === "all") setSelectedUserId("");
              }}
              className="attendance-style-input"
            >
              <option value="all">All Users</option>
              <option value="single">Single User</option>
            </select>

            {billingType === "single" && (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="attendance-style-input"
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
              className="attendance-style-primary-btn"
            >
              {generating ? "Generating..." : "Generate Bills"}
            </button>
          </div>
        </section>
      )}

      <section className="attendance-style-card">
        <h3 className="attendance-style-card-title">Bills</h3>

        <div className="attendance-style-table-wrap">
          <table className="attendance-style-table">
            <thead>
              <tr>
                {isAdmin && <th>User</th>}
                <th>Period</th>
                <th>Meals</th>
                <th>Per Meal</th>
                <th>Total</th>
                <th>Status</th>
                <th>PDF</th>
                {!isAdmin && <th>Payment</th>}
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 8} className="attendance-empty-cell">
                    No bills found
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id}>
                    {isAdmin && <td>{bill.user_name}</td>}
                    <td>{bill.period}</td>
                    <td>{bill.total_meals}</td>
                    <td>₹{Number(bill.per_meal_cost || 0).toFixed(2)}</td>
                    <td>
                      <strong>₹{Number(bill.total_amount || 0).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          bill.status === "Paid"
                            ? "approved"
                            : bill.status === "Pending Approval"
                            ? "pending"
                            : "rejected"
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDownloadPdf(bill.id)}
                        className="attendance-style-secondary-btn"
                      >
                        Download PDF
                      </button>
                    </td>

                    {!isAdmin && (
                      <td>
                        {bill.status === "Unpaid" ? (
                          <div className="billing-pay-btn-group">
                            <button
                              onClick={() => handleRazorpayPayment(bill)}
                              disabled={razorpayLoadingId === bill.id}
                              className="billing-razorpay-btn"
                              title="Pay online and send it for admin approval"
                            >
                              {razorpayLoadingId === bill.id
                                ? "Opening..."
                                : `Pay Online ₹${Number(bill.total_amount).toFixed(0)}`}
                            </button>

                            <button
                              onClick={() => openQrModal(bill)}
                              className="attendance-style-secondary-btn"
                              title="Pay via UPI and upload proof for admin approval"
                            >
                              Pay via UPI
                            </button>
                          </div>
                        ) : bill.status === "Pending Approval" ? (
                          <span className="billing-pending-text">
                            Awaiting admin approval
                          </span>
                        ) : (
                          <span className="billing-paid-text">✓ Paid</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className="attendance-style-card">
          <h3 className="attendance-style-card-title">
            Pending Payment Approvals
            {pendingPayments.length > 0 && (
              <span className="billing-count-badge">{pendingPayments.length}</span>
            )}
          </h3>

          {pendingPayments.length === 0 ? (
            <p className="attendance-muted">No pending payments</p>
          ) : (
            <div className="billing-pending-grid">
              {pendingPayments.map((payment) => (
                <div key={payment.id} className="billing-pending-card">
                  <h4 className="billing-pending-user">{payment.user_name}</h4>
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
                    <strong>Mode:</strong> {payment.mode || "-"}
                  </p>
                  <p>
                    <strong>Receipt No:</strong> {payment.receipt_no || "-"}
                  </p>
                  <p>
                    <strong>Note:</strong> {payment.note || "-"}
                  </p>

                  {payment.proof_url && (
                    <a
                      href={payment.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="billing-link"
                    >
                      View Payment Proof →
                    </a>
                  )}

                  <div className="billing-action-row">
                    <button
                      onClick={() => approvePayment(payment.id)}
                      className="billing-success-btn"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectPayment(payment.id)}
                      className="billing-danger-btn"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showQrModal && selectedBill && (
        <div className="billing-modal-overlay" onClick={closeQrModal}>
          <div
            className="billing-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="billing-modal-header">
              <h3 className="billing-modal-title">Pay Bill — {selectedBill.period}</h3>
              <button onClick={closeQrModal} className="billing-close-btn">
                ×
              </button>
            </div>

            <p className="billing-modal-text">
              Scan this QR code to pay to your UPI ID. After paying, upload the screenshot below for admin approval.
            </p>

            <div className="billing-qr-wrap">
              <QRCode
                value={buildUpiLink(selectedBill)}
                size={220}
                bgColor="#ffffff"
                fgColor="#111827"
              />
            </div>

            <div className="billing-amount-box">
              <span>Total Amount:</span>
              <strong>₹{Number(selectedBill.total_amount || 0).toFixed(2)}</strong>
            </div>

            <button
              onClick={handleOpenUpiApp}
              className="attendance-style-secondary-btn billing-full-width-btn"
            >
              Open UPI App
            </button>

            <p className="billing-upload-label">Upload payment screenshot:</p>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                handleFileChange(selectedBill.id, e.target.files?.[0] || null)
              }
              className="billing-file-input"
            />

            <input
              type="text"
              placeholder="Payment note / UPI reference"
              value={paymentNote[selectedBill.id] || ""}
              onChange={(e) => handleNoteChange(selectedBill.id, e.target.value)}
              className="attendance-style-input billing-modal-input"
            />

            <button
              onClick={() => handlePaymentSubmit(selectedBill.id)}
              className="attendance-style-primary-btn billing-full-width-btn"
            >
              Submit Payment Proof
            </button>
          </div>
        </div>
      )}

      <style>{`
        .attendance-style-page {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .attendance-style-loading {
          padding: 30px;
          font-size: 18px;
        }

        .attendance-style-section-header {
          background: #ffffff;
          border-radius: 24px;
          padding: 22px 20px;
        }

        .attendance-style-title {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          line-height: 1.2;
          color: #0f172a;
        }

        .attendance-style-subtitle {
          margin: 10px 0 0;
          font-size: 15px;
          line-height: 1.5;
          color: #64748b;
        }

        .attendance-style-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .attendance-style-stat-card {
          background: #ffffff;
          border-radius: 18px;
          padding: 18px 16px;
          border: 1px solid #edf1f7;
        }

        .attendance-style-stat-card h3 {
          margin: 0 0 12px;
          font-size: 15px;
          font-weight: 600;
          color: #5b667a;
        }

        .attendance-style-stat-card p {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
        }

        .stat-green {
          color: #16a34a !important;
        }

        .stat-red {
          color: #dc2626 !important;
        }

        .stat-orange {
          color: #d97706 !important;
        }

        .attendance-style-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 18px;
        }

        .attendance-style-card-title {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .attendance-style-generate-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          align-items: center;
        }

        .attendance-style-input {
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #dbe3ef;
          min-width: 140px;
          outline: none;
          font-size: 15px;
          background: #fff;
        }

        .attendance-style-primary-btn {
          height: 48px;
          border: none;
          border-radius: 16px;
          background: #3b5fe2;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .attendance-style-secondary-btn {
          border: none;
          background: #eef2ff;
          color: #4c51bf;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .attendance-style-table-wrap {
          overflow-x: auto;
        }

        .attendance-style-table {
          width: 100%;
          border-collapse: collapse;
        }

        .attendance-style-table th,
        .attendance-style-table td {
          padding: 16px 10px;
          text-align: left;
          border-bottom: 1px solid #edf1f7;
          font-size: 15px;
          color: #0f172a;
          vertical-align: middle;
        }

        .attendance-style-table th {
          font-size: 14px;
          font-weight: 700;
          color: #5b667a;
          background: #f8fafc;
        }

        .attendance-empty-cell {
          text-align: center;
          padding: 20px;
          color: #64748b !important;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.approved {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.rejected {
          background: #fee2e2;
          color: #991b1b;
        }

        .billing-pay-btn-group {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 6px;
          min-width: 150px;
        }

        .billing-razorpay-btn {
          background: #1d4ed8;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          width: 100%;
        }

        .billing-pending-text {
          color: #d97706;
          font-size: 13px;
        }

        .billing-paid-text {
          color: #16a34a;
          font-size: 13px;
          font-weight: 600;
        }

        .billing-count-badge {
          background: #fef3c7;
          color: #92400e;
          border-radius: 999px;
          padding: 2px 10px;
          font-size: 13px;
          font-weight: 600;
        }

        .attendance-muted {
          color: #64748b;
          font-size: 14px;
        }

        .billing-pending-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .billing-pending-card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          background: #f8fafc;
        }

        .billing-pending-user {
          margin: 0 0 8px;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }

        .billing-link {
          color: #2563eb;
          text-decoration: none;
          display: inline-block;
          margin-top: 8px;
        }

        .billing-action-row {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .billing-success-btn {
          background: #16a34a;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
        }

        .billing-danger-btn {
          background: #dc2626;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
        }

        .billing-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          padding: 16px;
        }

        .billing-modal-card {
          background: #ffffff;
          width: 100%;
          max-width: 460px;
          border-radius: 22px;
          padding: 22px;
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
        }

        .billing-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .billing-modal-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }

        .billing-close-btn {
          border: none;
          background: transparent;
          font-size: 28px;
          cursor: pointer;
          color: #334155;
          line-height: 1;
        }

        .billing-modal-text {
          color: #64748b;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .billing-qr-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #f8fafc;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .billing-amount-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 14px;
          padding: 12px 14px;
          margin-bottom: 14px;
          color: #1e3a8a;
        }

        .billing-full-width-btn {
          width: 100%;
          margin-bottom: 12px;
        }

        .billing-upload-label {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 6px;
        }

        .billing-file-input {
          font-size: 13px;
          margin-bottom: 12px;
          display: block;
        }

        .billing-modal-input {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 12px;
        }

        @media (max-width: 1100px) {
          .attendance-style-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .attendance-style-stats-grid {
            grid-template-columns: 1fr;
          }

          .attendance-style-generate-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}