from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from app.models.notification import Notification
from app.models.user import User
from app.utils.db import db

notification_bp = Blueprint("notification_bp", __name__)


def is_admin():
    return get_jwt().get("role") == "admin"


@notification_bp.route("/users-list", methods=["GET"])
@jwt_required()
def notification_users_list():
    if not is_admin():
        return jsonify({"message": "Only admin can view users"}), 403

    users = User.query.filter_by(role="user").order_by(User.full_name.asc()).all()

    return jsonify([
        {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        }
        for user in users
    ]), 200


@notification_bp.route("/", methods=["GET"])
@jwt_required()
def list_notifications():
    role = get_jwt().get("role")
    user_id = int(get_jwt_identity())

    if role == "admin":
        rows = Notification.query.filter(
            (Notification.user_id == user_id) |
            ((Notification.user_id.is_(None)) & (Notification.role_target == "admin"))
        ).order_by(Notification.created_at.desc()).all()
    else:
        rows = Notification.query.filter(
            (Notification.user_id == user_id) |
            ((Notification.user_id.is_(None)) & (Notification.role_target == "user"))
        ).order_by(Notification.created_at.desc()).all()

    return jsonify([row.to_dict() for row in rows]), 200


@notification_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def unread_count():
    role = get_jwt().get("role")
    user_id = int(get_jwt_identity())

    if role == "admin":
        count = Notification.query.filter(
            (
                (Notification.user_id == user_id) |
                ((Notification.user_id.is_(None)) & (Notification.role_target == "admin"))
            ),
            Notification.is_read.is_(False)
        ).count()
    else:
        count = Notification.query.filter(
            (
                (Notification.user_id == user_id) |
                ((Notification.user_id.is_(None)) & (Notification.role_target == "user"))
            ),
            Notification.is_read.is_(False)
        ).count()

    return jsonify({"unread_count": count}), 200


@notification_bp.route("/", methods=["POST"])
@jwt_required()
def create_notification():
    if not is_admin():
        return jsonify({"message": "Only admin can create notifications"}), 403

    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    message = (data.get("message") or "").strip()
    target_type = (data.get("target_type") or "all_users").strip()
    notification_type = (data.get("notification_type") or "general").strip()
    action_url = (data.get("action_url") or "").strip()
    user_id = data.get("user_id")

    if not title or not message:
        return jsonify({"message": "Title and message are required"}), 400

    row = None

    if target_type == "single_user":
        if not user_id:
            return jsonify({"message": "Please select a user"}), 400

        selected_user = User.query.filter_by(id=int(user_id), role="user").first()
        if not selected_user:
            return jsonify({"message": "Selected user not found"}), 404

        row = Notification(
            title=title,
            message=message,
            user_id=int(user_id),
            role_target=None,
            notification_type=notification_type,
            action_url=action_url or None,
        )

    elif target_type == "admin_only":
        row = Notification(
            title=title,
            message=message,
            user_id=None,
            role_target="admin",
            notification_type=notification_type,
            action_url=action_url or None,
        )

    else:  # all_users
        row = Notification(
            title=title,
            message=message,
            user_id=None,
            role_target="user",
            notification_type=notification_type,
            action_url=action_url or None,
        )

    db.session.add(row)
    db.session.commit()

    return jsonify({
        "message": "Notification created successfully",
        "notification": row.to_dict()
    }), 201


@notification_bp.route("/<int:notification_id>/read", methods=["PATCH"])
@jwt_required()
def mark_as_read(notification_id):
    row = Notification.query.get_or_404(notification_id)
    role = get_jwt().get("role")
    user_id = int(get_jwt_identity())

    allowed = False

    if row.user_id == user_id:
        allowed = True
    elif row.user_id is None and row.role_target == role:
        allowed = True

    if not allowed:
        return jsonify({"message": "Not allowed"}), 403

    row.is_read = True
    db.session.commit()

    return jsonify({
        "message": "Notification marked as read",
        "notification": row.to_dict()
    }), 200


@notification_bp.route("/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_as_read():
    role = get_jwt().get("role")
    user_id = int(get_jwt_identity())

    if role == "admin":
        rows = Notification.query.filter(
            (
                (Notification.user_id == user_id) |
                ((Notification.user_id.is_(None)) & (Notification.role_target == "admin"))
            ),
            Notification.is_read.is_(False)
        ).all()
    else:
        rows = Notification.query.filter(
            (
                (Notification.user_id == user_id) |
                ((Notification.user_id.is_(None)) & (Notification.role_target == "user"))
            ),
            Notification.is_read.is_(False)
        ).all()

    for row in rows:
        row.is_read = True

    db.session.commit()
    return jsonify({"message": "All notifications marked as read"}), 200


@notification_bp.route("/<int:notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    row = Notification.query.get_or_404(notification_id)
    role = get_jwt().get("role")
    user_id = int(get_jwt_identity())

    allowed = False

    if is_admin():
        allowed = True
    elif row.user_id == user_id:
        allowed = True
    elif row.user_id is None and row.role_target == role:
        allowed = True

    if not allowed:
        return jsonify({"message": "Not allowed"}), 403

    db.session.delete(row)
    db.session.commit()

    return jsonify({"message": "Notification deleted successfully"}), 200