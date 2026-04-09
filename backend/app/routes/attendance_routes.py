from datetime import datetime, date
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.models.attendance import Attendance
from app.models.user import User
from app.models.menu import MenuItem
from app.utils.db import db

attendance_bp = Blueprint("attendance_bp", __name__)


def is_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"


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


def get_cutoff_map(selected_date):
    items = MenuItem.query.filter(MenuItem.meal_date == selected_date).all()

    cutoffs = {
        "breakfast": None,
        "lunch": None,
        "dinner": None,
    }

    for item in items:
        if item.meal_type in cutoffs and item.cutoff_time:
            cutoffs[item.meal_type] = item.cutoff_time

    return cutoffs


def is_meal_open(selected_date, meal_type):
    now = datetime.now()
    today = date.today()

    if selected_date > today:
        return True

    if selected_date < today:
        return False

    cutoffs = get_cutoff_map(selected_date)
    cutoff = cutoffs.get(meal_type)

    default_cutoffs = {
        "breakfast": datetime.strptime("09:00", "%H:%M").time(),
        "lunch": datetime.strptime("13:00", "%H:%M").time(),
        "dinner": datetime.strptime("21:00", "%H:%M").time(),
    }

    final_cutoff = cutoff or default_cutoffs[meal_type]
    return now.time() <= final_cutoff


@attendance_bp.route("/attendance", methods=["GET"])
@jwt_required()
def get_attendance():
    try:
        current_user_id = int(get_jwt_identity())
        admin = is_admin()

        rows = Attendance.query.order_by(Attendance.date.desc(), Attendance.id.desc()).all()

        if not admin:
            rows = [r for r in rows if r.user_id == current_user_id]

        return jsonify([attendance_to_dict(r) for r in rows]), 200

    except Exception as e:
        print("GET ATTENDANCE ERROR:", e)
        return jsonify({"message": str(e)}), 500


@attendance_bp.route("/attendance/cutoffs", methods=["GET"])
@jwt_required()
def get_attendance_cutoffs():
    try:
        selected_date_str = request.args.get("date")
        selected_date = (
            datetime.strptime(selected_date_str, "%Y-%m-%d").date()
            if selected_date_str
            else date.today()
        )

        cutoffs = get_cutoff_map(selected_date)

        defaults = {
            "breakfast": "09:00",
            "lunch": "13:00",
            "dinner": "21:00",
        }

        return jsonify({
            "date": str(selected_date),
            "breakfast": cutoffs["breakfast"].strftime("%H:%M") if cutoffs["breakfast"] else defaults["breakfast"],
            "lunch": cutoffs["lunch"].strftime("%H:%M") if cutoffs["lunch"] else defaults["lunch"],
            "dinner": cutoffs["dinner"].strftime("%H:%M") if cutoffs["dinner"] else defaults["dinner"],
            "breakfast_open": is_meal_open(selected_date, "breakfast"),
            "lunch_open": is_meal_open(selected_date, "lunch"),
            "dinner_open": is_meal_open(selected_date, "dinner"),
        }), 200

    except Exception as e:
        print("GET ATTENDANCE CUTOFFS ERROR:", e)
        return jsonify({"message": str(e)}), 500


@attendance_bp.route("/attendance/check", methods=["GET"])
@jwt_required()
def check_attendance():
    try:
        user_id = request.args.get("user_id")
        selected_date_str = request.args.get("date")

        if not user_id:
            return jsonify({"message": "User is required"}), 400

        if not selected_date_str:
            return jsonify({"message": "Date is required"}), 400

        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
        user_id = int(user_id)

        row = Attendance.query.filter_by(user_id=user_id, date=selected_date).first()

        if row:
            return jsonify({
                "exists": True,
                "attendance": {
                    "id": row.id,
                    "user_id": row.user_id,
                    "date": str(row.date),
                    "breakfast": bool(row.breakfast),
                    "lunch": bool(row.lunch),
                    "dinner": bool(row.dinner),
                }
            }), 200

        return jsonify({
            "exists": False,
            "attendance": None
        }), 200

    except Exception as e:
        print("CHECK ATTENDANCE ERROR:", e)
        return jsonify({"message": str(e)}), 500


@attendance_bp.route("/attendance/check-multiple", methods=["GET"])
@jwt_required()
def check_multiple_attendance():
    try:
        user_ids = request.args.getlist("user_ids")
        selected_date_str = request.args.get("date")

        if not selected_date_str:
            return jsonify({"message": "Date is required"}), 400

        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()

        if not user_ids:
            return jsonify({"records": []}), 200

        parsed_user_ids = [int(uid) for uid in user_ids]

        rows = Attendance.query.filter(
            Attendance.user_id.in_(parsed_user_ids),
            Attendance.date == selected_date
        ).all()

        records = []
        for row in rows:
            records.append({
                "id": row.id,
                "user_id": row.user_id,
                "date": str(row.date),
                "breakfast": bool(row.breakfast),
                "lunch": bool(row.lunch),
                "dinner": bool(row.dinner),
            })

        return jsonify({"records": records}), 200

    except Exception as e:
        print("CHECK MULTIPLE ATTENDANCE ERROR:", e)
        return jsonify({"message": str(e)}), 500


@attendance_bp.route("/attendance", methods=["POST"])
@jwt_required()
def save_attendance():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can mark attendance"}), 403

        data = request.get_json()

        selected_date_str = data.get("date")
        user_id = data.get("user_id")

        if not selected_date_str:
            return jsonify({"message": "Date is required"}), 400

        if not user_id:
            return jsonify({"message": "User is required"}), 400

        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()
        user_id = int(user_id)

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404

        breakfast = bool(data.get("breakfast"))
        lunch = bool(data.get("lunch"))
        dinner = bool(data.get("dinner"))

        if not breakfast and not lunch and not dinner:
            return jsonify({"message": "Please select at least one meal"}), 400

        row = Attendance.query.filter_by(user_id=user_id, date=selected_date).first()

        if row:
            if breakfast:
                row.breakfast = True
            if lunch:
                row.lunch = True
            if dinner:
                row.dinner = True
        else:
            row = Attendance(
                user_id=user_id,
                date=selected_date,
                breakfast=breakfast,
                lunch=lunch,
                dinner=dinner,
            )
            db.session.add(row)

        db.session.commit()

        return jsonify({
            "message": "Attendance saved successfully",
            "attendance": attendance_to_dict(row)
        }), 200

    except Exception as e:
        print("SAVE ATTENDANCE ERROR:", e)
        db.session.rollback()
        return jsonify({"message": str(e)}), 500


@attendance_bp.route("/attendance/bulk", methods=["POST"])
@jwt_required()
def save_bulk_attendance():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can mark attendance"}), 403

        data = request.get_json()

        selected_date_str = data.get("date")
        user_ids = data.get("user_ids", [])
        breakfast = bool(data.get("breakfast"))
        lunch = bool(data.get("lunch"))
        dinner = bool(data.get("dinner"))

        if not selected_date_str:
            return jsonify({"message": "Date is required"}), 400

        if not user_ids or not isinstance(user_ids, list):
            return jsonify({"message": "Please select at least one user"}), 400

        if not breakfast and not lunch and not dinner:
            return jsonify({"message": "Please select at least one meal"}), 400

        selected_date = datetime.strptime(selected_date_str, "%Y-%m-%d").date()

        saved_rows = []
        skipped_users = []

        for raw_user_id in user_ids:
            try:
                user_id = int(raw_user_id)
            except (TypeError, ValueError):
                skipped_users.append(raw_user_id)
                continue

            user = User.query.get(user_id)
            if not user:
                skipped_users.append(raw_user_id)
                continue

            row = Attendance.query.filter_by(user_id=user_id, date=selected_date).first()

            if row:
                if breakfast:
                    row.breakfast = True
                if lunch:
                    row.lunch = True
                if dinner:
                    row.dinner = True
            else:
                row = Attendance(
                    user_id=user_id,
                    date=selected_date,
                    breakfast=breakfast,
                    lunch=lunch,
                    dinner=dinner,
                )
                db.session.add(row)

            saved_rows.append(row)

        db.session.commit()

        return jsonify({
            "message": "Bulk attendance saved successfully",
            "saved_count": len(saved_rows),
            "skipped_users": skipped_users,
            "attendance": [attendance_to_dict(row) for row in saved_rows]
        }), 200

    except Exception as e:
        print("SAVE BULK ATTENDANCE ERROR:", e)
        db.session.rollback()
        return jsonify({"message": str(e)}), 500