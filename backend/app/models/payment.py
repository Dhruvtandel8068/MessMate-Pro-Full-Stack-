from app.utils.db import db


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(
        db.Integer,
        db.ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False
    )
    mode = db.Column(db.String(30), nullable=False, default="UPI")
    proof_filename = db.Column(db.String(255), nullable=True)
    receipt_no = db.Column(db.String(120), nullable=True)
    note = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="Pending")
    admin_remark = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    # ── Razorpay fields ────────────────────────────────────────────────────────
    # razorpay_order_id   → ID of the order we create before showing the popup
    # razorpay_payment_id → ID Razorpay gives after user pays (e.g. pay_XXXXXX)
    # razorpay_signature  → HMAC-SHA256 we verify to confirm payment is genuine
    razorpay_order_id   = db.Column(db.String(100), nullable=True)
    razorpay_payment_id = db.Column(db.String(100), nullable=True)
    razorpay_signature  = db.Column(db.String(255), nullable=True)

    bill = db.relationship("Bill", back_populates="payments")

    def to_dict(self):
        return {
            "id": self.id,
            "bill_id": self.bill_id,
            "mode": self.mode,
            "proof_filename": self.proof_filename,
            "proof_url": f"/api/uploads/{self.proof_filename}" if self.proof_filename else None,
            "receipt_no": self.receipt_no,
            "note": self.note,
            "status": self.status,
            "admin_remark": self.admin_remark,
            "razorpay_order_id": self.razorpay_order_id,
            "razorpay_payment_id": self.razorpay_payment_id,
            "created_at": str(self.created_at) if self.created_at else None,
        }