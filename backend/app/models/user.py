from app.utils.db import db, bcrypt


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user", nullable=False)
    contact = db.Column(db.String(30), nullable=True)
    room_no = db.Column(db.String(30), nullable=True)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    password_changed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        try:
            return bcrypt.check_password_hash(self.password_hash, password)
        except Exception as e:
            print("PASSWORD CHECK ERROR:", str(e))
            return False

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
            "contact": self.contact,
            "room_no": self.room_no,
            "must_change_password": self.must_change_password,
            "created_at": str(self.created_at) if self.created_at else None,
        }