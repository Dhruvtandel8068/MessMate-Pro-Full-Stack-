from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from werkzeug.security import generate_password_hash
from sqlalchemy import or_

from app.models.user import User
from app.models.attendance import Attendance
from app.utils.db import db

user_bp = Blueprint("user_bp", __name__)


def is_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"


def user_to_dict(user):
    data = user.to_dict() if hasattr(user, "to_dict") else {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "contact": getattr(user, "contact", None),
        "room_no": getattr(user, "room_no", None),
        "created_at": str(getattr(user, "created_at", None)) if getattr(user, "created_at", None) else None,
    }
    data["role_badge"] = "Admin" if data.get("role") == "admin" else "User"
    data["created_date_formatted"] = (
        str(getattr(user, "created_at"))
        if getattr(user, "created_at", None)
        else None
    )
    return data


def attendance_to_dict(row):
    user = User.query.get(row.user_id)
    meal_count = int(bool(row.breakfast)) + int(bool(row.lunch)) + int(bool(row.dinner))

    return {
        "id": row.id,
        "user_id": row.user_id,
        "user_name": user.full_name if user else "-",
        "date": str(row.date),
        "breakfast": bool(row.breakfast),
        "lunch": bool(row.lunch),
        "dinner": bool(row.dinner),
        "meal_count": meal_count,
        "created_at": str(row.created_at) if row.created_at else None,
    }


@user_bp.route("/users", methods=["GET"])
@jwt_required()
def get_users():
    if not is_admin():
        return jsonify({"message": "Only admin can view users"}), 403

    search = (request.args.get("search") or "").strip()
    role = (request.args.get("role") or "").strip().lower()

    query = User.query

    if role in ["admin", "user"]:
        query = query.filter(User.role == role)

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                User.full_name.ilike(like),
                User.email.ilike(like),
                User.contact.ilike(like),
                User.room_no.ilike(like),
            )
        )

    users = query.order_by(User.created_at.desc()).all()
    return jsonify([user_to_dict(u) for u in users]), 200


@user_bp.route("/users", methods=["POST"])
@jwt_required()
def create_user():
    if not is_admin():
        return jsonify({"message": "Only admin can create users"}), 403

    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "user").strip().lower()
    contact = (data.get("contact") or "").strip()
    room_no = (data.get("room_no") or "").strip()

    if not full_name or not email or not password:
        return jsonify({"message": "Name, email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already exists"}), 409

    user = User(
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        role="admin" if role == "admin" else "user",
        contact=contact or None,
        room_no=room_no or None,
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User created successfully", "user": user_to_dict(user)}), 201


@user_bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    if not is_admin():
        return jsonify({"message": "Only admin can update users"}), 403

    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    email = (data.get("email") or user.email).strip().lower()
    existing_user = User.query.filter(User.email == email, User.id != user.id).first()
    if existing_user:
        return jsonify({"message": "Email already in use"}), 409

    user.full_name = (data.get("full_name") or user.full_name).strip()
    user.email = email
    user.role = "admin" if (data.get("role") or user.role) == "admin" else "user"
    user.contact = (data.get("contact") or user.contact or "").strip() or None
    user.room_no = (data.get("room_no") or user.room_no or "").strip() or None

    password = data.get("password") or ""
    if password:
        user.password_hash = generate_password_hash(password)

    db.session.commit()
    return jsonify({"message": "User updated successfully", "user": user_to_dict(user)}), 200


@user_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    if not is_admin():
        return jsonify({"message": "Only admin can delete users"}), 403

    current_user_id = int(get_jwt_identity())
    if current_user_id == user_id:
        return jsonify({"message": "You cannot delete your own account"}), 400

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted successfully"}), 200


@user_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    return jsonify(user_to_dict(user)), 200


@user_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_me():
    user = User.query.get_or_404(int(get_jwt_identity()))
    data = request.get_json() or {}

    full_name = (data.get("full_name") or user.full_name).strip()
    contact = (data.get("contact") or user.contact or "").strip()
    room_no = (data.get("room_no") or user.room_no or "").strip()

    if not full_name:
        return jsonify({"message": "Full name is required"}), 400

    user.full_name = full_name
    user.contact = contact or None
    user.room_no = room_no or None

    password = (data.get("password") or "").strip()
    if password:
        user.password_hash = generate_password_hash(password)

    db.session.commit()
    return jsonify({"message": "Profile updated successfully", "user": user_to_dict(user)}), 200


@user_bp.route("/attendance", methods=["GET"])
@jwt_required()
def get_attendance():
    user_id = int(get_jwt_identity())
    month = request.args.get("month")
    year = request.args.get("year")

    query = Attendance.query
    if not is_admin():
        query = query.filter_by(user_id=user_id)

    if month:
        query = query.filter(db.extract("month", Attendance.date) == int(month))
    if year:
        query = query.filter(db.extract("year", Attendance.date) == int(year))

    rows = query.order_by(Attendance.date.desc()).all()
    return jsonify([attendance_to_dict(r) for r in rows]), 200


@user_bp.route("/attendance/check", methods=["GET"])
@jwt_required()
def check_attendance():
    user_id = request.args.get("user_id")
    date_value = request.args.get("date")

    if not date_value:
        return jsonify({"message": "date is required"}), 400

    if is_admin():
        if not user_id:
            return jsonify({"message": "user_id is required for admin"}), 400
        user_id = int(user_id)
    else:
        user_id = int(get_jwt_identity())

    row = Attendance.query.filter_by(user_id=user_id, date=date_value).first()

    if not row:
        return jsonify({
            "exists": False,
            "attendance": None
        }), 200

    return jsonify({
        "exists": True,
        "attendance": attendance_to_dict(row)
    }), 200


@user_bp.route("/attendance", methods=["POST"])
@jwt_required()
def create_or_update_attendance():
    data = request.get_json() or {}
    date_value = data.get("date")
    user_id = data.get("user_id")

    new_breakfast = bool(data.get("breakfast"))
    new_lunch = bool(data.get("lunch"))
    new_dinner = bool(data.get("dinner"))

    if is_admin():
        if not user_id:
            return jsonify({"message": "user_id is required for admin"}), 400
        user_id = int(user_id)
    else:
        user_id = int(get_jwt_identity())

    if not date_value:
        return jsonify({"message": "date is required"}), 400

    if not new_breakfast and not new_lunch and not new_dinner:
        return jsonify({"message": "Select at least one meal"}), 400

    row = Attendance.query.filter_by(user_id=user_id, date=date_value).first()

    if not row:
        row = Attendance(
            user_id=user_id,
            date=date_value,
            breakfast=new_breakfast,
            lunch=new_lunch,
            dinner=new_dinner,
        )
        db.session.add(row)
        db.session.commit()
        return jsonify({
            "message": "Attendance created successfully",
            "attendance": attendance_to_dict(row)
        }), 201

    already_breakfast = bool(row.breakfast)
    already_lunch = bool(row.lunch)
    already_dinner = bool(row.dinner)

    if (new_breakfast and already_breakfast) or (new_lunch and already_lunch) or (new_dinner and already_dinner):
        return jsonify({
            "message": "Selected meal attendance already marked",
            "attendance": attendance_to_dict(row)
        }), 409

    row.breakfast = already_breakfast or new_breakfast
    row.lunch = already_lunch or new_lunch
    row.dinner = already_dinner or new_dinner

    db.session.commit()
    return jsonify({
        "message": "Attendance updated successfully",
        "attendance": attendance_to_dict(row)
    }), 200


@user_bp.route("/attendance/<int:attendance_id>", methods=["DELETE"])
@jwt_required()
def delete_attendance(attendance_id):
    row = Attendance.query.get_or_404(attendance_id)
    if not is_admin() and row.user_id != int(get_jwt_identity()):
        return jsonify({"message": "Not allowed"}), 403

    db.session.delete(row)
    db.session.commit()
    return jsonify({"message": "Attendance deleted successfully"}), 200