from app.utils.db import db


class Bill(db.Model):
    __tablename__ = "bills"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    month = db.Column(db.Integer, nullable=True)
    year = db.Column(db.Integer, nullable=True)
    period = db.Column(db.String(30), nullable=True)

    bill_type = db.Column(db.String(20), nullable=False, default="monthly")

    total_meals = db.Column(db.Integer, nullable=True, default=0)
    per_meal_cost = db.Column(db.Float, nullable=True, default=0)
    total_amount = db.Column(db.Float, nullable=False, default=0)

    # Unpaid, Pending Approval, Paid
    status = db.Column(db.String(20), nullable=False, default="Unpaid")

    created_at = db.Column(db.DateTime, server_default=db.func.now())

    user = db.relationship("User", backref="bills")

    payments = db.relationship(
        "Payment",
        back_populates="bill",
        cascade="all, delete-orphan",
        lazy=True,
        order_by="Payment.created_at.desc()"
    )

    def latest_payment(self):
        if not self.payments:
            return None
        return self.payments[0]

    def to_dict(self):
        latest_payment = self.latest_payment()

        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else "-",
            "user_email": self.user.email if self.user else "-",
            "month": self.month,
            "year": self.year,
            "period": self.period,
            "bill_type": self.bill_type,
            "total_meals": int(self.total_meals or 0),
            "per_meal_cost": float(self.per_meal_cost or 0),
            "total_amount": float(self.total_amount or 0),
            "status": self.status,
            "created_at": str(self.created_at) if self.created_at else None,
            "latest_payment": latest_payment.to_dict() if latest_payment else None,
            "payment_count": len(self.payments) if self.payments else 0,
        }