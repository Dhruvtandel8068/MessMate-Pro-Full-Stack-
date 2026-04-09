from app.utils.db import db


class MenuItem(db.Model):
    __tablename__ = "menu_items"

    id = db.Column(db.Integer, primary_key=True)
    meal_date = db.Column(db.Date, nullable=False)
    meal_type = db.Column(db.String(20), nullable=False)  # breakfast / lunch / dinner
    item_name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.String(255), nullable=True)

    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    is_special = db.Column(db.Boolean, default=False)
    cutoff_time = db.Column(db.Time, nullable=True)

    created_at = db.Column(db.DateTime, server_default=db.func.now())