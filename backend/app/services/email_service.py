from flask_mail import Message
from app.utils.db import mail


def send_email(subject, recipients, body):
    try:
        if not recipients:
            return False

        msg = Message(
            subject=subject,
            recipients=recipients,
            body=body
        )
        mail.send(msg)
        return True
    except Exception as e:
        print("EMAIL SEND ERROR:", str(e))
        return False


def send_bill_generated_email(user_email, user_name, period, total_amount):
    subject = f"Bill Generated for {period}"
    body = f"""
Hello {user_name},

Your mess bill for {period} has been generated.

Total Amount: ₹{total_amount}

Please login to your account to view full bill details and download PDF.

Regards,
Mess Operations Team
"""
    return send_email(subject, [user_email], body)


def send_payment_submitted_email(user_email, user_name, period):
    subject = f"Payment Submitted for {period}"
    body = f"""
Hello {user_name},

Your payment proof for bill {period} has been submitted successfully.
It is now pending admin approval.

Regards,
Mess Operations Team
"""
    return send_email(subject, [user_email], body)


def send_payment_approved_email(user_email, user_name, period):
    subject = f"Payment Approved for {period}"
    body = f"""
Hello {user_name},

Your payment for bill {period} has been approved successfully.

Regards,
Mess Operations Team
"""
    return send_email(subject, [user_email], body)


def send_payment_rejected_email(user_email, user_name, period, reason):
    subject = f"Payment Rejected for {period}"
    body = f"""
Hello {user_name},

Your payment for bill {period} has been rejected.

Reason:
{reason}

Please login and submit valid payment proof again.

Regards,
Mess Operations Team
"""
    return send_email(subject, [user_email], body)