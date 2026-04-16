from datetime import datetime
from app.utils.db import db, bcrypt


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(20), default="user", nullable=False)
    contact = db.Column(db.String(30), nullable=True, unique=True)
    room_no = db.Column(db.String(30), nullable=True)

    auth_provider = db.Column(db.String(30), default="email", nullable=False)
    google_id = db.Column(db.String(255), unique=True, nullable=True)

    phone_otp_hash = db.Column(db.String(255), nullable=True)
    phone_otp_expires_at = db.Column(db.DateTime, nullable=True)
    phone_verified = db.Column(db.Boolean, default=False, nullable=False)

    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    password_changed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        if not self.password_hash:
            return False
        try:
            return bcrypt.check_password_hash(self.password_hash, password)
        except Exception as e:
            print("PASSWORD CHECK ERROR:", str(e))
            return False

    def set_phone_otp(self, otp):
        self.phone_otp_hash = bcrypt.generate_password_hash(str(otp)).decode("utf-8")
        self.phone_otp_expires_at = datetime.utcnow()

    def check_phone_otp(self, otp):
        if not self.phone_otp_hash:
            return False
        try:
            return bcrypt.check_password_hash(self.phone_otp_hash, str(otp))
        except Exception as e:
            print("OTP CHECK ERROR:", str(e))
            return False

    def clear_phone_otp(self):
        self.phone_otp_hash = None
        self.phone_otp_expires_at = None

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
            "contact": self.contact,
            "room_no": self.room_no,
            "auth_provider": self.auth_provider,
            "google_id": self.google_id,
            "phone_verified": self.phone_verified,
            "must_change_password": self.must_change_password,
            "created_at": str(self.created_at) if self.created_at else None,
        }