from app.models.notification import Notification
from app.utils.db import db


def create_notification(
    title,
    message,
    user_id=None,
    role_target=None,
    notification_type="general",
    action_url=None,
):
    """
    Create a notification for a specific user or role.
    """
    notification = Notification(
        title=title,
        message=message,
        user_id=user_id,
        role_target=role_target,
        notification_type=notification_type,
        action_url=action_url,
    )

    db.session.add(notification)