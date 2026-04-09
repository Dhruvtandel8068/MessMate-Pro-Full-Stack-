from app.utils.db import db


class Inventory(db.Model):
    __tablename__ = "inventory"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    qty = db.Column(db.Float, default=0)
    low_limit = db.Column(db.Float, default=5)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "name": self.name,
            "qty": self.qty,
            "low_limit": self.low_limit,
            "low": self.qty <= self.low_limit,
            "created_at": str(self.created_at) if self.created_at else None,
        }