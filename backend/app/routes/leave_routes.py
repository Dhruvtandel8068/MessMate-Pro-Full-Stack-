from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.utils.db import db
from app.models.leave import Leave
from app.models.user import User
from app.models.notification import Notification

leave_bp = Blueprint("leave_bp", __name__)


def create_notification(
    title,
    message,
    user_id=None,
    role_target=None,
    notification_type="leave",
    action_url="/leave",
):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        role_target=role_target,
        notification_type=notification_type,
        action_url=action_url,
    )
    db.session.add(notification)


def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return None


def get_current_user_and_role():
    identity = get_jwt_identity()
    print("JWT IDENTITY:", identity)

    try:
        user = User.query.filter_by(id=int(identity)).first()

        if not user:
            print("USER NOT FOUND")
            return None, None

        print("USER FOUND:", user.id, user.role)
        return user, user.role

    except Exception as e:
        print("ERROR IN USER FETCH:", str(e))
        return None, None


@leave_bp.route("/", methods=["GET"])
@jwt_required()
def get_leaves():
    try:
        user, role = get_current_user_and_role()

        if not user:
            return jsonify({"message": "Unauthorized"}), 401

        status = (request.args.get("status") or "").strip()

        query = Leave.query

        if role != "admin":
            query = query.filter_by(user_id=user.id)

        if status:
            query = query.filter_by(status=status)

        leaves = query.order_by(Leave.id.desc()).all()

        return jsonify({
            "leaves": [leave.to_dict() for leave in leaves]
        }), 200

    except Exception as e:
        print("GET LEAVES ERROR:", str(e))
        return jsonify({"message": f"Failed to fetch leaves: {str(e)}"}), 500


@leave_bp.route("/", methods=["POST"])
@jwt_required()
def apply_leave():
    try:
        user, role = get_current_user_and_role()

        if not user:
            return jsonify({"message": "Unauthorized"}), 401

        data = request.get_json() or {}

        start_date = parse_date(data.get("start_date"))
        end_date = parse_date(data.get("end_date"))
        reason = (data.get("reason") or "").strip()

        if not start_date or not end_date or not reason:
            return jsonify({"message": "All fields are required"}), 400

        if end_date < start_date:
            return jsonify({"message": "End date cannot be before start date"}), 400

        overlap = Leave.query.filter(
            Leave.user_id == user.id,
            Leave.end_date >= start_date,
            Leave.start_date <= end_date,
            Leave.status.in_(["Pending", "Approved"]),
        ).first()

        if overlap:
            return jsonify({
                "message": "You already have an overlapping pending/approved leave request"
            }), 400

        leave = Leave(
            user_id=user.id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            status="Pending",
        )

        db.session.add(leave)

        create_notification(
            title="New Leave Request",
            message=f"{user.full_name} applied for leave from {start_date} to {end_date}.",
            role_target="admin",
        )

        db.session.commit()

        return jsonify({
            "message": "Leave request submitted successfully",
            "leave": leave.to_dict(),
        }), 201

    except Exception as e:
        db.session.rollback()
        print("APPLY LEAVE ERROR:", str(e))
        return jsonify({"message": f"Failed to apply leave: {str(e)}"}), 500


@leave_bp.route("/<int:leave_id>/approve", methods=["PUT"])
@jwt_required()
def approve_leave(leave_id):
    try:
        user, role = get_current_user_and_role()

        if not user:
            return jsonify({"message": "Unauthorized"}), 401

        if role != "admin":
            return jsonify({"message": "Access denied"}), 403

        leave = Leave.query.filter_by(id=leave_id).first()

        if not leave:
            return jsonify({"message": "Leave request not found"}), 404

        data = request.get_json() or {}
        admin_remark = (data.get("admin_remark") or "").strip()

        leave.status = "Approved"
        leave.admin_remark = admin_remark if admin_remark else "Approved by admin"

        create_notification(
            title="Leave Approved",
            message=f"Your leave request from {leave.start_date} to {leave.end_date} has been approved.",
            user_id=leave.user_id,
        )

        db.session.commit()

        return jsonify({
            "message": "Leave approved successfully",
            "leave": leave.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("APPROVE LEAVE ERROR:", str(e))
        return jsonify({"message": f"Failed to approve leave: {str(e)}"}), 500


@leave_bp.route("/<int:leave_id>/reject", methods=["PUT"])
@jwt_required()
def reject_leave(leave_id):
    try:
        user, role = get_current_user_and_role()

        if not user:
            return jsonify({"message": "Unauthorized"}), 401

        if role != "admin":
            return jsonify({"message": "Access denied"}), 403

        leave = Leave.query.filter_by(id=leave_id).first()

        if not leave:
            return jsonify({"message": "Leave request not found"}), 404

        data = request.get_json() or {}
        admin_remark = (data.get("admin_remark") or "").strip()

        leave.status = "Rejected"
        leave.admin_remark = admin_remark if admin_remark else "Rejected by admin"

        create_notification(
            title="Leave Rejected",
            message=f"Your leave request from {leave.start_date} to {leave.end_date} has been rejected.",
            user_id=leave.user_id,
        )

        db.session.commit()

        return jsonify({
            "message": "Leave rejected successfully",
            "leave": leave.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("REJECT LEAVE ERROR:", str(e))
        return jsonify({"message": f"Failed to reject leave: {str(e)}"}), 500


@leave_bp.route("/<int:leave_id>", methods=["DELETE"])
@jwt_required()
def delete_leave(leave_id):
    try:
        user, role = get_current_user_and_role()

        if not user:
            return jsonify({"message": "Unauthorized"}), 401

        leave = Leave.query.filter_by(id=leave_id).first()

        if not leave:
            return jsonify({"message": "Leave request not found"}), 404

        if role != "admin" and leave.user_id != user.id:
            return jsonify({"message": "Access denied"}), 403

        if role != "admin" and leave.status != "Pending":
            return jsonify({"message": "Only pending leave requests can be deleted"}), 400

        db.session.delete(leave)
        db.session.commit()

        return jsonify({"message": "Leave request deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print("DELETE LEAVE ERROR:", str(e))
        return jsonify({"message": f"Failed to delete leave: {str(e)}"}), 500