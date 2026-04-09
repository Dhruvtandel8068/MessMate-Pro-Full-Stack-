import os
import hmac
import hashlib
import razorpay
import traceback
from uuid import uuid4
from io import BytesIO

from flask import Blueprint, jsonify, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from sqlalchemy import extract
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas

from app.models.user import User
from app.models.attendance import Attendance
from app.models.bill import Bill
from app.models.payment import Payment
from app.models.notification import Notification
from app.utils.db import db
from app.services.email_service import (
    send_bill_generated_email,
    send_payment_submitted_email,
    send_payment_approved_email,
    send_payment_rejected_email,
)

billing_bp = Blueprint("billing_bp", __name__)


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


def generate_bill_pdf(bill, user):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 20)
    pdf.setFillColor(colors.HexColor("#1e40af"))
    pdf.drawString(20 * mm, height - 20 * mm, "Mess Operations")

    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(colors.black)
    pdf.drawString(20 * mm, height - 28 * mm, "Monthly Billing Statement")

    pdf.setStrokeColor(colors.HexColor("#93c5fd"))
    pdf.setLineWidth(1)
    pdf.line(20 * mm, height - 32 * mm, 190 * mm, height - 32 * mm)

    y = height - 45 * mm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(20 * mm, y, "Bill Information")
    y -= 8 * mm

    pdf.setFont("Helvetica", 11)
    pdf.drawString(20 * mm, y, f"Bill ID: {bill.id}")
    y -= 7 * mm
    pdf.drawString(20 * mm, y, f"Period: {bill.period or f'{bill.month:02d}/{bill.year}'}")
    y -= 7 * mm
    pdf.drawString(20 * mm, y, f"Bill Type: {bill.bill_type or 'monthly'}")
    y -= 7 * mm
    pdf.drawString(20 * mm, y, f"Status: {bill.status}")
    y -= 7 * mm
    pdf.drawString(
        20 * mm,
        y,
        f"Generated On: {bill.created_at.strftime('%d-%m-%Y %H:%M') if bill.created_at else '-'}"
    )

    y -= 15 * mm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(20 * mm, y, "User Information")
    y -= 8 * mm

    pdf.setFont("Helvetica", 11)
    pdf.drawString(20 * mm, y, f"Name: {user.full_name if user else '-'}")
    y -= 7 * mm
    pdf.drawString(20 * mm, y, f"Email: {user.email if user else '-'}")
    y -= 7 * mm
    pdf.drawString(20 * mm, y, f"Role: {user.role if user else '-'}")

    y -= 18 * mm
    pdf.setFillColor(colors.HexColor("#eff6ff"))
    pdf.roundRect(20 * mm, y - 30 * mm, 170 * mm, 35 * mm, 4 * mm, fill=1, stroke=0)

    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(25 * mm, y, "Billing Summary")

    pdf.setFont("Helvetica", 11)
    pdf.drawString(25 * mm, y - 8 * mm, f"Total Meals: {int(bill.total_meals or 0)}")
    pdf.drawString(25 * mm, y - 16 * mm, f"Per Meal Cost: Rs. {float(bill.per_meal_cost or 0):.2f}")
    pdf.drawString(25 * mm, y - 24 * mm, f"Total Amount: Rs. {float(bill.total_amount or 0):.2f}")

    pdf.setStrokeColor(colors.HexColor("#cbd5e1"))
    pdf.line(20 * mm, 20 * mm, 190 * mm, 20 * mm)

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.grey)
    pdf.drawString(20 * mm, 14 * mm, "This is a system-generated bill from Mess Operations.")

    pdf.showPage()
    pdf.save()

    buffer.seek(0)
    return buffer


def bill_with_payments_dict(bill):
    user = bill.user if hasattr(bill, "user") else User.query.get(bill.user_id)
    payments = [payment.to_dict() for payment in bill.payments] if hasattr(bill, "payments") else []

    return {
        **bill.to_dict(),
        "user_name": user.full_name if user else "-",
        "user_email": user.email if user else "-",
        "payments": payments,
    }


@billing_bp.route("/users-list", methods=["GET"])
@jwt_required()
def billing_users_list():
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


@billing_bp.route("/", methods=["GET"])
@jwt_required()
def list_bills():
    try:
        current_user_id = int(get_jwt_identity())
        month = request.args.get("month")
        year = request.args.get("year")
        status = (request.args.get("status") or "").strip()

        query = Bill.query

        if not is_admin():
            query = query.filter_by(user_id=current_user_id)

        if month:
            query = query.filter(Bill.month == int(month))
        if year:
            query = query.filter(Bill.year == int(year))
        if status:
            query = query.filter(Bill.status == status)

        rows = query.order_by(Bill.created_at.desc()).all()
        return jsonify([bill_with_payments_dict(bill) for bill in rows]), 200

    except Exception as e:
        print("BILL LIST ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to load bills: {str(e)}"}), 500


@billing_bp.route("/summary", methods=["GET"])
@jwt_required()
def bill_summary():
    try:
        current_user_id = int(get_jwt_identity())
        month = request.args.get("month")
        year = request.args.get("year")

        query = Bill.query
        if not is_admin():
            query = query.filter_by(user_id=current_user_id)

        if month:
            query = query.filter(Bill.month == int(month))
        if year:
            query = query.filter(Bill.year == int(year))

        rows = query.all()

        return jsonify({
            "total_bills": len(rows),
            "paid_bills": sum(1 for b in rows if b.status == "Paid"),
            "unpaid_bills": sum(1 for b in rows if b.status == "Unpaid"),
            "pending_approval": sum(1 for b in rows if b.status == "Pending Approval"),
            "total_amount": round(sum(float(b.total_amount or 0) for b in rows), 2),
        }), 200

    except Exception as e:
        print("BILL SUMMARY ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to load bill summary: {str(e)}"}), 500


@billing_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_monthly_bills():
    if not is_admin():
        return jsonify({"message": "Only admin can generate bills"}), 403

    try:
        data = request.get_json() or {}

        month = int(data.get("month") or 0)
        year = int(data.get("year") or 0)
        per_meal_cost = float(data.get("per_meal_cost") or 0)
        billing_type = (data.get("billing_type") or "all").strip().lower()
        user_id = data.get("user_id")

        if not month or not year or per_meal_cost <= 0:
            return jsonify({"message": "Valid month, year and per_meal_cost are required"}), 400

        if month < 1 or month > 12:
            return jsonify({"message": "Month must be between 1 and 12"}), 400

        users_query = User.query.filter_by(role="user")

        if billing_type == "single":
            if not user_id:
                return jsonify({"message": "Please select a user"}), 400

            selected_user = users_query.filter_by(id=int(user_id)).first()
            if not selected_user:
                return jsonify({"message": "Selected user not found"}), 404

            users = [selected_user]
        else:
            users = users_query.all()

        created_count = 0
        updated_count = 0

        for user in users:
            attendance_rows = Attendance.query.filter(
                Attendance.user_id == user.id,
                extract("month", Attendance.date) == month,
                extract("year", Attendance.date) == year,
            ).all()

            total_meals = sum(
                int(bool(a.breakfast)) + int(bool(a.lunch)) + int(bool(a.dinner))
                for a in attendance_rows
            )

            total_amount = round(total_meals * per_meal_cost, 2)

            bill = Bill.query.filter_by(user_id=user.id, month=month, year=year).first()

            if bill:
                bill.total_meals = total_meals
                bill.per_meal_cost = per_meal_cost
                bill.total_amount = total_amount
                bill.period = f"{month:02d}/{year}"
                bill.bill_type = "monthly"
                if bill.status != "Paid":
                    bill.status = "Unpaid"
                updated_count += 1
            else:
                bill = Bill(
                    user_id=user.id,
                    month=month,
                    year=year,
                    period=f"{month:02d}/{year}",
                    bill_type="monthly",
                    total_meals=total_meals,
                    per_meal_cost=per_meal_cost,
                    total_amount=total_amount,
                    status="Unpaid",
                )
                db.session.add(bill)
                created_count += 1

            create_notification(
                title="Bill Generated",
                message=f"Your bill for {month:02d}/{year} has been generated. Amount: ₹{total_amount}",
                user_id=user.id,
                notification_type="bill_generated",
                action_url="/billing",
            )

            if user.email:
                send_bill_generated_email(
                    user_email=user.email,
                    user_name=user.full_name,
                    period=f"{month:02d}/{year}",
                    total_amount=total_amount,
                )

        db.session.commit()

        return jsonify({
            "message": f"Bill generation completed. Created: {created_count}, Updated: {updated_count}"
        }), 200

    except Exception as e:
        db.session.rollback()
        print("BILL GENERATE ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to generate bills: {str(e)}"}), 500


@billing_bp.route("/<int:bill_id>/download-pdf", methods=["GET"])
@jwt_required()
def download_bill_pdf(bill_id):
    try:
        bill = Bill.query.get_or_404(bill_id)

        if not is_admin() and bill.user_id != int(get_jwt_identity()):
            return jsonify({"message": "Not allowed"}), 403

        user = bill.user if hasattr(bill, "user") else User.query.get(bill.user_id)
        pdf_buffer = generate_bill_pdf(bill, user)

        filename = f"bill_{bill.id}_{bill.month or 0:02d}_{bill.year or 0}.pdf"

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        print("DOWNLOAD PDF ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to download PDF: {str(e)}"}), 500


@billing_bp.route("/<int:bill_id>/pay", methods=["POST"])
@jwt_required()
def upload_payment(bill_id):
    try:
        bill = Bill.query.get_or_404(bill_id)

        if not is_admin() and bill.user_id != int(get_jwt_identity()):
            return jsonify({"message": "Not allowed"}), 403

        mode = request.form.get("mode", "UPI").strip()
        receipt_no = request.form.get("receipt_no", "").strip()
        note = request.form.get("note", "").strip()
        proof = request.files.get("proof")

        if not proof or not proof.filename:
            return jsonify({"message": "Payment screenshot/proof is required"}), 400

        allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
        ext = os.path.splitext(proof.filename)[1].lower()
        if ext not in allowed_extensions:
            return jsonify({"message": "Only JPG, JPEG, PNG, PDF files are allowed"}), 400

        filename = f"payment_{bill_id}_{uuid4().hex}{ext}"
        upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
        os.makedirs(upload_folder, exist_ok=True)
        proof.save(os.path.join(upload_folder, filename))

        payment = Payment(
            bill_id=bill.id,
            mode=mode,
            proof_filename=filename,
            receipt_no=receipt_no or None,
            note=note or None,
            status="Pending",
        )

        bill.status = "Pending Approval"
        db.session.add(payment)

        create_notification(
            title="New Payment Submitted",
            message=f"Payment proof submitted for bill {bill.period}. Please review.",
            role_target="admin",
            notification_type="payment_submitted",
            action_url="/payment-approval",
        )

        user = bill.user if hasattr(bill, "user") else User.query.get(bill.user_id)
        if user and user.email:
            send_payment_submitted_email(
                user_email=user.email,
                user_name=user.full_name,
                period=bill.period,
            )

        db.session.commit()

        return jsonify({
            "message": "Payment submitted successfully",
            "payment": payment.to_dict(),
            "bill": bill.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("PAYMENT ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to submit payment: {str(e)}"}), 500


@billing_bp.route("/payments/pending", methods=["GET"])
@jwt_required()
def list_pending_payments():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can view pending payments"}), 403

        payments = Payment.query.filter_by(status="Pending").order_by(Payment.created_at.desc()).all()

        result = []
        for payment in payments:
            bill = payment.bill
            user = bill.user if bill else None

            result.append({
                **payment.to_dict(),
                "bill": bill.to_dict() if bill else None,
                "user_name": user.full_name if user else "-",
                "user_email": user.email if user else "-",
            })

        return jsonify(result), 200

    except Exception as e:
        print("PENDING PAYMENTS ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to load pending payments: {str(e)}"}), 500


@billing_bp.route("/payments/<int:payment_id>/approve", methods=["PUT"])
@jwt_required()
def approve_payment(payment_id):
    if not is_admin():
        return jsonify({"message": "Only admin can approve payments"}), 403

    try:
        payment = Payment.query.get_or_404(payment_id)
        data = request.get_json(silent=True) or {}
        admin_remark = (data.get("admin_remark") or "Payment approved").strip()

        payment.status = "Approved"
        payment.admin_remark = admin_remark

        if payment.bill:
            payment.bill.status = "Paid"

            create_notification(
                title="Payment Approved",
                message=f"Your payment for bill {payment.bill.period} has been approved.",
                user_id=payment.bill.user_id,
                notification_type="payment_approved",
                action_url="/billing",
            )

            user = payment.bill.user if hasattr(payment.bill, "user") else User.query.get(payment.bill.user_id)
            if user and user.email:
                send_payment_approved_email(
                    user_email=user.email,
                    user_name=user.full_name,
                    period=payment.bill.period,
                )

        db.session.commit()

        return jsonify({
            "message": "Payment approved successfully",
            "payment": payment.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("APPROVE PAYMENT ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to approve payment: {str(e)}"}), 500


@billing_bp.route("/payments/<int:payment_id>/reject", methods=["PUT"])
@jwt_required()
def reject_payment(payment_id):
    if not is_admin():
        return jsonify({"message": "Only admin can reject payments"}), 403

    try:
        payment = Payment.query.get_or_404(payment_id)
        data = request.get_json(silent=True) or {}
        admin_remark = (data.get("admin_remark") or "Payment rejected").strip()

        payment.status = "Rejected"
        payment.admin_remark = admin_remark

        if payment.bill:
            payment.bill.status = "Unpaid"

            create_notification(
                title="Payment Rejected",
                message=f"Your payment for bill {payment.bill.period} was rejected. Reason: {admin_remark}",
                user_id=payment.bill.user_id,
                notification_type="payment_rejected",
                action_url="/billing",
            )

            user = payment.bill.user if hasattr(payment.bill, "user") else User.query.get(payment.bill.user_id)
            if user and user.email:
                send_payment_rejected_email(
                    user_email=user.email,
                    user_name=user.full_name,
                    period=payment.bill.period,
                    reason=admin_remark,
                )

        db.session.commit()

        return jsonify({
            "message": "Payment rejected successfully",
            "payment": payment.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("REJECT PAYMENT ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to reject payment: {str(e)}"}), 500


@billing_bp.route("/<int:bill_id>/razorpay-order", methods=["POST"])
@jwt_required()
def create_razorpay_order(bill_id):
    try:
        bill = Bill.query.get_or_404(bill_id)

        if bill.user_id != int(get_jwt_identity()):
            return jsonify({"message": "Not allowed"}), 403

        if bill.status == "Paid":
            return jsonify({"message": "This bill is already paid"}), 400

        if float(bill.total_amount or 0) <= 0:
            return jsonify({"message": "Bill amount must be greater than zero"}), 400

        key_id = current_app.config.get("RAZORPAY_KEY_ID")
        key_secret = current_app.config.get("RAZORPAY_KEY_SECRET")

        if not key_id or not key_secret:
            return jsonify({"message": "Razorpay is not configured on the server. Contact admin."}), 500

        client = razorpay.Client(auth=(key_id, key_secret))

        amount_in_paise = int(float(bill.total_amount) * 100)

        order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"bill_{bill.id}",
            "notes": {
                "bill_id": str(bill.id),
                "period": bill.period or "",
                "user_id": str(bill.user_id),
            },
        })

        return jsonify({
            "order_id": order["id"],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": key_id,
            "bill_id": bill.id,
            "period": bill.period,
            "total_amount": float(bill.total_amount),
        }), 200

    except razorpay.errors.BadRequestError as e:
        print("RAZORPAY BAD REQUEST:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Razorpay error: {str(e)}"}), 400
    except Exception as e:
        print("RAZORPAY ORDER ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Failed to create payment order: {str(e)}"}), 500


@billing_bp.route("/<int:bill_id>/razorpay-verify", methods=["POST"])
@jwt_required()
def verify_razorpay_payment(bill_id):
    try:
        bill = Bill.query.get_or_404(bill_id)

        if bill.user_id != int(get_jwt_identity()):
            return jsonify({"message": "Not allowed"}), 403

        data = request.get_json() or {}
        razorpay_order_id = data.get("razorpay_order_id", "").strip()
        razorpay_payment_id = data.get("razorpay_payment_id", "").strip()
        razorpay_signature = data.get("razorpay_signature", "").strip()

        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            return jsonify({"message": "Missing payment verification data"}), 400

        key_secret = current_app.config.get("RAZORPAY_KEY_SECRET", "")
        body = f"{razorpay_order_id}|{razorpay_payment_id}"

        expected_signature = hmac.new(
            key_secret.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if expected_signature != razorpay_signature:
            print(f"RAZORPAY SIGNATURE MISMATCH — bill_id={bill_id}")
            return jsonify({"message": "Payment verification failed — invalid signature"}), 400

        payment = Payment(
            bill_id=bill.id,
            mode="Razorpay",
            status="Approved",
            receipt_no=razorpay_payment_id,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
        )
        db.session.add(payment)
        bill.status = "Paid"

        user = bill.user if hasattr(bill, "user") else User.query.get(bill.user_id)

        create_notification(
            title="Payment Successful",
            message=(
                f"Your Razorpay payment for {bill.period} was successful. "
                f"Amount: ₹{float(bill.total_amount):.2f}. "
                f"Ref: {razorpay_payment_id}"
            ),
            user_id=bill.user_id,
            notification_type="payment_approved",
            action_url="/billing",
        )

        create_notification(
            title="Online Payment Received",
            message=(
                f"Razorpay payment from {user.full_name if user else 'a user'} "
                f"for {bill.period}. Amount: ₹{float(bill.total_amount):.2f}."
            ),
            role_target="admin",
            notification_type="payment_approved",
            action_url="/billing",
        )

        if user and user.email:
            send_payment_approved_email(
                user_email=user.email,
                user_name=user.full_name,
                period=bill.period,
            )

        db.session.commit()

        return jsonify({
            "message": "Payment verified and confirmed successfully",
            "bill": bill.to_dict(),
            "payment": payment.to_dict(),
        }), 200

    except Exception as e:
        db.session.rollback()
        print("RAZORPAY VERIFY ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"message": f"Payment verification failed: {str(e)}"}), 500