from flask_mail import Message
from flask import current_app
from app.utils.db import mail


def send_email(subject, recipients, body=None, html=None):
    try:
        if isinstance(recipients, str):
            recipients = [recipients]

        msg = Message(
            subject=subject,
            recipients=recipients
        )

        if body:
            msg.body = body

        if html:
            msg.html = html

        mail.send(msg)
        print("EMAIL SENT TO:", recipients)
        return True
    except Exception as e:
        print("EMAIL SEND FAILED:", str(e))
        current_app.logger.error(f"Email send failed: {str(e)}")
        return False