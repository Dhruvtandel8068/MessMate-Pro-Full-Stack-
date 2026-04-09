from app.utils.db import db


class Complaint(db.Model):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    complaint_type = db.Column(db.String(50), nullable=False)
    message = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), nullable=False, default="Medium")
    status = db.Column(db.String(20), nullable=False, default="Open")
    admin_remark = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=db.func.now()
    )
    resolved_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref="complaints")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "complaint_type": self.complaint_type,
            "message": self.message,
            "priority": self.priority,
            "status": self.status,
            "admin_remark": self.admin_remark,
            "created_at": str(self.created_at) if self.created_at else None,
            "updated_at": str(self.updated_at) if self.updated_at else None,
            "resolved_at": str(self.resolved_at) if self.resolved_at else None,
        }