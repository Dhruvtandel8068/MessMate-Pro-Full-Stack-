from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from app.models.complaint import Complaint
from app.models.notification import Notification
from app.models.user import User
from app.utils.db import db
from app.helpers.notifications import create_notification
complaint_bp = Blueprint("complaint_bp", __name__)


def is_admin():
    return get_jwt().get("role") == "admin"


def create_notification(title, message, user_id=None, role_target=None, notification_type="general", action_url=None):
    row = Notification(
        user_id=user_id,
        title=title,
        message=message,
        role_target=role_target,
        notification_type=notification_type,
        action_url=action_url,
    )
    db.session.add(row)


def complaint_to_dict(complaint):
    user = User.query.get(complaint.user_id)
    timeline = [
        {
            "label": "Created",
            "time": str(complaint.created_at) if complaint.created_at else None,
        },
        {
            "label": "Updated",
            "time": str(complaint.updated_at) if getattr(complaint, "updated_at", None) else None,
        },
        {
            "label": "Resolved",
            "time": str(complaint.resolved_at) if getattr(complaint, "resolved_at", None) else None,
        },
    ]
    return {
        "id": complaint.id,
        "user_id": complaint.user_id,
        "user_name": user.full_name if user else "-",
        "user_email": user.email if user else "-",
        "complaint_type": complaint.complaint_type,
        "message": complaint.message,
        "priority": complaint.priority,
        "status": complaint.status,
        "admin_remark": complaint.admin_remark,
        "created_at": str(complaint.created_at) if complaint.created_at else None,
        "updated_at": str(complaint.updated_at) if complaint.updated_at else None,
        "resolved_at": str(complaint.resolved_at) if complaint.resolved_at else None,
        "timeline": timeline,
    }


@complaint_bp.route("/", methods=["GET"])
@jwt_required()
def list_complaints():
    try:
        current_user_id = int(get_jwt_identity())
        status = (request.args.get("status") or "").strip()
        priority = (request.args.get("priority") or "").strip()
        query_text = (request.args.get("q") or "").strip().lower()

        if is_admin():
            query = Complaint.query
        else:
            query = Complaint.query.filter_by(user_id=current_user_id)

        if status:
            query = query.filter(Complaint.status == status)
        if priority:
            query = query.filter(Complaint.priority == priority)
        if query_text:
            like = f"%{query_text}%"
            query = query.filter(
                db.or_(
                    Complaint.complaint_type.ilike(like),
                    Complaint.message.ilike(like),
                    Complaint.status.ilike(like),
                    Complaint.priority.ilike(like),
                )
            )

        complaints = query.order_by(Complaint.created_at.desc()).all()
        return jsonify([complaint_to_dict(c) for c in complaints]), 200

    except Exception as e:
        print("LIST COMPLAINTS ERROR:", str(e))
        return jsonify({"message": f"Failed to load complaints: {str(e)}"}), 500


@complaint_bp.route("/", methods=["POST"])
@jwt_required()
def create_complaint():
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        complaint_type = (data.get("complaint_type") or "").strip()
        message = (data.get("message") or "").strip()
        priority = (data.get("priority") or "Medium").strip()

        if not complaint_type or not message:
            return jsonify({"message": "complaint_type and message are required"}), 400

        allowed_priorities = ["Low", "Medium", "High", "Urgent"]
        if priority not in allowed_priorities:
            return jsonify({"message": "Invalid priority"}), 400

        complaint = Complaint(
            user_id=current_user_id,
            complaint_type=complaint_type,
            message=message,
            priority=priority,
            status="Open",
        )

        db.session.add(complaint)
        db.session.flush()

        create_notification(
            title="New Complaint Submitted",
            message=f"A new complaint has been submitted with {priority} priority.",
            role_target="admin",
            notification_type="complaint_created",
            action_url="/complaints",
        )

        db.session.commit()

        return jsonify({
            "message": "Complaint submitted successfully",
            "complaint": complaint_to_dict(complaint),
        }), 201

    except Exception as e:
        db.session.rollback()
        print("CREATE COMPLAINT ERROR:", str(e))
        return jsonify({"message": f"Failed to submit complaint: {str(e)}"}), 500


@complaint_bp.route("/<int:complaint_id>", methods=["PUT"])
@jwt_required()
def update_complaint(complaint_id):
    try:
        complaint = Complaint.query.get_or_404(complaint_id)
        data = request.get_json() or {}
        current_user_id = int(get_jwt_identity())

        if is_admin():
            status = (data.get("status") or complaint.status).strip()
            priority = (data.get("priority") or complaint.priority).strip()
            admin_remark = (data.get("admin_remark") or complaint.admin_remark or "").strip()

            allowed_statuses = ["Open", "In Progress", "Resolved", "Rejected"]
            allowed_priorities = ["Low", "Medium", "High", "Urgent"]

            if status not in allowed_statuses:
                return jsonify({"message": "Invalid status"}), 400
            if priority not in allowed_priorities:
                return jsonify({"message": "Invalid priority"}), 400

            complaint.status = status
            complaint.priority = priority
            complaint.admin_remark = admin_remark or None

            if status == "Resolved":
                complaint.resolved_at = datetime.utcnow()
                create_notification(
                    title="Complaint Resolved",
                    message=f"Your complaint has been resolved. Remark: {complaint.admin_remark or 'No remark'}",
                    user_id=complaint.user_id,
                    notification_type="complaint_resolved",
                    action_url="/complaints",
                )
            elif status == "Rejected":
                create_notification(
                    title="Complaint Rejected",
                    message=f"Your complaint was rejected. Remark: {complaint.admin_remark or 'No remark'}",
                    user_id=complaint.user_id,
                    notification_type="complaint_rejected",
                    action_url="/complaints",
                )
        else:
            if complaint.user_id != current_user_id:
                return jsonify({"message": "Not allowed"}), 403

            if complaint.status not in ["Open", "Rejected"]:
                return jsonify({"message": "Only open or rejected complaints can be edited"}), 400

            complaint.complaint_type = (data.get("complaint_type") or complaint.complaint_type).strip()
            complaint.message = (data.get("message") or complaint.message).strip()
            priority = (data.get("priority") or complaint.priority).strip()

            allowed_priorities = ["Low", "Medium", "High", "Urgent"]
            if priority not in allowed_priorities:
                return jsonify({"message": "Invalid priority"}), 400
            complaint.priority = priority

        db.session.commit()

        return jsonify({
            "message": "Complaint updated successfully",
            "complaint": complaint_to_dict(complaint),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("UPDATE COMPLAINT ERROR:", str(e))
        return jsonify({"message": f"Failed to update complaint: {str(e)}"}), 500


@complaint_bp.route("/<int:complaint_id>", methods=["DELETE"])
@jwt_required()
def delete_complaint(complaint_id):
    try:
        complaint = Complaint.query.get_or_404(complaint_id)
        current_user_id = int(get_jwt_identity())

        if not is_admin() and complaint.user_id != current_user_id:
            return jsonify({"message": "Not allowed"}), 403

        db.session.delete(complaint)
        db.session.commit()

        return jsonify({"message": "Complaint deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print("DELETE COMPLAINT ERROR:", str(e))
        return jsonify({"message": f"Failed to delete complaint: {str(e)}"}), 500