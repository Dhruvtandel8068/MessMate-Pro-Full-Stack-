import { useState } from "react";
import api from "../services/api";
import qrImage from "../assets/payment-qr.jpeg";

export default function PaymentQrModal({ bill, onClose, onSuccess }) {
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!bill) return null;

  const handleSubmit = async () => {
    try {
      if (!paymentFile) {
        alert("Please upload payment proof");
        return;
      }

      setSubmitting(true);

      const formData = new FormData();
      formData.append("proof", paymentFile);
      formData.append("note", paymentNote || "Paid via QR payment");
      formData.append("mode", "UPI");
      formData.append("receipt_no", receiptNo || "");

      await api.post(`/billing/${bill.id}/pay`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("Payment submitted successfully");
      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || "Payment submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Scan & Pay</h2>
            <p style={styles.subtitle}>
              Scan this QR using PhonePe, Google Pay or Paytm and submit the payment proof.
            </p>
          </div>

          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.leftCard}>
            <div style={styles.qrWrap}>
              <img src={qrImage} alt="Payment QR" style={styles.qrImage} />
            </div>

            <div style={styles.infoBox}>
              <p><strong>Bill Period:</strong> {bill.period}</p>
              <p><strong>Total Meals:</strong> {bill.total_meals}</p>
              <p><strong>Per Meal Cost:</strong> ₹{Number(bill.per_meal_cost || 0).toFixed(2)}</p>
              <p><strong>Total Amount:</strong> ₹{Number(bill.total_amount || 0).toFixed(2)}</p>
              <p><strong>Payment Mode:</strong> UPI QR</p>
            </div>
          </div>

          <div style={styles.rightCard}>
            <h3 style={styles.sectionTitle}>Submit Payment Proof</h3>

            <label style={styles.label}>Receipt / Transaction No</label>
            <input
              type="text"
              placeholder="Enter UPI transaction id"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label}>Payment Note</label>
            <input
              type="text"
              placeholder="Ex: Paid via PhonePe"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label}>Upload Screenshot / PDF Proof</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setPaymentFile(e.target.files?.[0] || null)}
              style={styles.fileInput}
            />

            <div style={styles.buttonRow}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={styles.primaryBtn}
              >
                {submitting ? "Submitting..." : "Submit Payment"}
              </button>

              <button onClick={onClose} style={styles.secondaryBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: "20px",
  },
  modal: {
    width: "100%",
    maxWidth: "980px",
    background: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 24px 70px rgba(15,23,42,0.25)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 24px 16px",
    borderBottom: "1px solid #e2e8f0",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    color: "#0f172a",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#64748b",
  },
  closeBtn: {
    background: "#eef2ff",
    color: "#1e3a8a",
    border: "none",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: "700",
  },
  body: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    padding: "24px",
  },
  leftCard: {
    background: "#f8fbff",
    borderRadius: "20px",
    padding: "20px",
    border: "1px solid #e2e8f0",
  },
  rightCard: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    border: "1px solid #e2e8f0",
  },
  qrWrap: {
    background: "#ffffff",
    borderRadius: "18px",
    padding: "16px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  qrImage: {
    width: "100%",
    maxWidth: "320px",
    borderRadius: "14px",
  },
  infoBox: {
    marginTop: "18px",
    color: "#334155",
    lineHeight: 1.9,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "16px",
    color: "#0f172a",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    marginTop: "12px",
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  fileInput: {
    width: "100%",
    padding: "10px 0",
    fontSize: "14px",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "22px",
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: "700",
  },
  secondaryBtn: {
    background: "#e2e8f0",
    color: "#0f172a",
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: "700",
  },
};