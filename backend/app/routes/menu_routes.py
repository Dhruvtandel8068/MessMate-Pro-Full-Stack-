from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt

from app.models.menu import MenuItem
from app.utils.db import db

menu_bp = Blueprint("menu_bp", __name__)


def is_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"


def item_to_dict(item):
    return {
        "id": item.id,
        "meal_date": str(item.meal_date),
        "meal_type": item.meal_type,
        "item_name": item.item_name,
        "description": item.description or "",
        "price": float(item.price or 0),
        "is_special": bool(item.is_special),
        "cutoff_time": item.cutoff_time.strftime("%H:%M") if item.cutoff_time else "",
    }


@menu_bp.route("/", methods=["GET"])
@jwt_required()
def get_menu_items():
    try:
        meal_date = request.args.get("meal_date")
        meal_type = request.args.get("meal_type", "").strip().lower()

        query = MenuItem.query

        if meal_date:
            selected_date = datetime.strptime(meal_date, "%Y-%m-%d").date()
            query = query.filter(MenuItem.meal_date == selected_date)

        if meal_type:
            query = query.filter(MenuItem.meal_type == meal_type)

        items = query.order_by(MenuItem.meal_date.desc(), MenuItem.id.desc()).all()
        return jsonify([item_to_dict(item) for item in items]), 200

    except Exception as e:
        print("GET MENU ERROR:", e)
        return jsonify({"message": str(e)}), 500


@menu_bp.route("/weekly", methods=["GET"])
@jwt_required()
def get_weekly_menu():
    try:
        start_date = request.args.get("start_date")

        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        else:
            start = datetime.today().date()

        end = start.fromordinal(start.toordinal() + 6)

        items = (
            MenuItem.query
            .filter(MenuItem.meal_date >= start, MenuItem.meal_date <= end)
            .order_by(MenuItem.meal_date.asc(), MenuItem.meal_type.asc())
            .all()
        )

        return jsonify([item_to_dict(item) for item in items]), 200

    except Exception as e:
        print("GET WEEKLY MENU ERROR:", e)
        return jsonify({"message": str(e)}), 500


@menu_bp.route("/", methods=["POST"])
@jwt_required()
def create_menu_item():
    if not is_admin():
        return jsonify({"message": "Unauthorized"}), 403

    try:
        data = request.get_json()

        meal_date = datetime.strptime(data.get("meal_date"), "%Y-%m-%d").date()
        meal_type = data.get("meal_type", "").strip().lower()
        item_name = data.get("item_name", "").strip()
        description = (data.get("description") or "").strip()
        price = float(data.get("price") or 0)
        is_special = bool(data.get("is_special", False))

        cutoff_time = None
        cutoff_time_str = (data.get("cutoff_time") or "").strip()
        if cutoff_time_str:
            cutoff_time = datetime.strptime(cutoff_time_str, "%H:%M").time()

        if meal_type not in ["breakfast", "lunch", "dinner"]:
            return jsonify({"message": "Meal type must be breakfast, lunch, or dinner"}), 400

        if not item_name:
            return jsonify({"message": "Item name is required"}), 400

        item = MenuItem(
            meal_date=meal_date,
            meal_type=meal_type,
            item_name=item_name,
            description=description,
            price=price,
            is_special=is_special,
            cutoff_time=cutoff_time,
        )

        db.session.add(item)
        db.session.commit()

        return jsonify({"message": "Meal added successfully", "item": item_to_dict(item)}), 201

    except Exception as e:
        print("CREATE MENU ERROR:", e)
        return jsonify({"message": str(e)}), 500


@menu_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def update_menu_item(item_id):
    if not is_admin():
        return jsonify({"message": "Unauthorized"}), 403

    try:
        item = MenuItem.query.get_or_404(item_id)
        data = request.get_json()

        if data.get("meal_date"):
            item.meal_date = datetime.strptime(data.get("meal_date"), "%Y-%m-%d").date()

        if data.get("meal_type"):
            meal_type = data.get("meal_type").strip().lower()
            if meal_type not in ["breakfast", "lunch", "dinner"]:
                return jsonify({"message": "Meal type must be breakfast, lunch, or dinner"}), 400
            item.meal_type = meal_type

        if data.get("item_name") is not None:
            item.item_name = data.get("item_name").strip()

        if data.get("description") is not None:
            item.description = data.get("description").strip()

        if data.get("price") is not None:
            item.price = float(data.get("price") or 0)

        if data.get("is_special") is not None:
            item.is_special = bool(data.get("is_special"))

        if data.get("cutoff_time") is not None:
            cutoff_time_str = (data.get("cutoff_time") or "").strip()
            item.cutoff_time = (
                datetime.strptime(cutoff_time_str, "%H:%M").time()
                if cutoff_time_str else None
            )

        db.session.commit()
        return jsonify({"message": "Meal updated successfully", "item": item_to_dict(item)}), 200

    except Exception as e:
        print("UPDATE MENU ERROR:", e)
        return jsonify({"message": str(e)}), 500


@menu_bp.route("/<int:item_id>", methods=["DELETE"])
@jwt_required()
def delete_menu_item(item_id):
    if not is_admin():
        return jsonify({"message": "Unauthorized"}), 403

    try:
        item = MenuItem.query.get_or_404(item_id)
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Meal deleted successfully"}), 200

    except Exception as e:
        print("DELETE MENU ERROR:", e)
        return jsonify({"message": str(e)}), 500