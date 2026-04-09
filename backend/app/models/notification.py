from app.utils.db import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True
    )

    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)

    # role_target can be:
    # "admin" -> all admins
    # "user"  -> all users
    # None    -> only specific user if user_id is set
    role_target = db.Column(db.String(20), nullable=True)

    notification_type = db.Column(db.String(50), nullable=False, default="general")
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    action_url = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    user = db.relationship("User", backref="notifications")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "message": self.message,
            "role_target": self.role_target,
            "notification_type": self.notification_type,
            "is_read": bool(self.is_read),
            "action_url": self.action_url,
            "created_at": str(self.created_at) if self.created_at else None,
        }