from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt

from app.models.inventory import Inventory
from app.utils.db import db

inventory_bp = Blueprint("inventory_bp", __name__)


def is_admin():
    return get_jwt().get("role") == "admin"


@inventory_bp.route("/", methods=["GET"])
@jwt_required()
def list_inventory():
    rows = Inventory.query.order_by(Inventory.created_at.desc()).all()
    return jsonify([row.to_dict() for row in rows])


@inventory_bp.route("/", methods=["POST"])
@jwt_required()
def create_inventory():
    if not is_admin():
        return jsonify({"message": "Only admin can add inventory"}), 403

    data = request.get_json() or {}
    row = Inventory(
        category=(data.get("category") or "General").strip(),
        name=(data.get("name") or "").strip(),
        qty=float(data.get("qty") or 0),
        low_limit=float(data.get("low_limit") or 5),
    )
    if not row.name:
        return jsonify({"message": "Item name is required"}), 400

    db.session.add(row)
    db.session.commit()
    return jsonify({"message": "Inventory item created", "item": row.to_dict()}), 201


@inventory_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def update_inventory(item_id):
    if not is_admin():
        return jsonify({"message": "Only admin can update inventory"}), 403

    row = Inventory.query.get_or_404(item_id)
    data = request.get_json() or {}
    row.category = (data.get("category") or row.category).strip()
    row.name = (data.get("name") or row.name).strip()
    row.qty = float(data.get("qty") if data.get("qty") is not None else row.qty)
    row.low_limit = float(data.get("low_limit") if data.get("low_limit") is not None else row.low_limit)
    db.session.commit()
    return jsonify({"message": "Inventory item updated", "item": row.to_dict()})


@inventory_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_inventory(item_id):
    if not is_admin():
        return jsonify({"message": "Only admin can delete inventory"}), 403

    row = Inventory.query.get_or_404(item_id)
    db.session.delete(row)
    db.session.commit()
    return jsonify({"message": "Inventory item deleted"})