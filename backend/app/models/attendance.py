from app.utils.db import db


class Attendance(db.Model):
    __tablename__ = "attendance"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    breakfast = db.Column(db.Boolean, default=False)
    lunch = db.Column(db.Boolean, default=False)
    dinner = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint("user_id", "date", name="uq_user_date"),
    )