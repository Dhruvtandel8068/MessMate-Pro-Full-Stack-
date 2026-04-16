import os
import random
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from twilio.rest import Client

from app.models.user import User
from app.utils.db import db, bcrypt
from app.utils.email_service import send_email

auth_bp = Blueprint("auth_bp", __name__)


def build_token(user):
    return create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role,
            "email": user.email,
            "contact": user.contact,
        },
        expires_delta=timedelta(days=7),
    )


def normalize_phone(phone):
    return "".join(ch for ch in str(phone or "") if ch.isdigit())


def format_indian_phone(phone):
    digits = normalize_phone(phone)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return f"+{digits}" if digits else ""


def otp_expired(user, ttl_minutes=5):
    if not user.phone_otp_expires_at:
        return True
    return datetime.utcnow() > (user.phone_otp_expires_at + timedelta(minutes=ttl_minutes))


def get_twilio_verify_client():
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")

    if not account_sid or not auth_token or not service_sid:
        return None, None

    client = Client(account_sid, auth_token)
    return client, service_sid


@auth_bp.post("/register")
def register():
    try:
        data = request.get_json() or {}

        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        contact = normalize_phone(data.get("contact"))
        room_no = (data.get("room_no") or "").strip()

        if not full_name or not email or not password:
            return jsonify({"message": "Full name, email and password are required"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"message": "Email already registered"}), 409

        if contact and User.query.filter_by(contact=contact).first():
            return jsonify({"message": "Phone number already registered"}), 409

        user = User(
            full_name=full_name,
            email=email,
            role="user",
            contact=contact or None,
            room_no=room_no or None,
            must_change_password=False,
            auth_provider="email",
            phone_verified=bool(contact),
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        email_sent = send_email(
            subject="Welcome to MessMate Pro - Account Created Successfully",
            recipients=user.email,
            body=f"""
Hello {user.full_name},

Your account has been created successfully.

You can now log in to MessMate Pro and use the system.

Thank you,
MessMate Pro Team
""",
            html=f"""
<h2>Welcome to MessMate Pro</h2>
<p>Hello <b>{user.full_name}</b>,</p>
<p>Your account has been created successfully.</p>
<p>You can now log in and use the system.</p>
<p><b>Email:</b> {user.email}</p>
<br>
<p>Thank you,<br>MessMate Pro Team</p>
"""
        )

        token = build_token(user)

        return jsonify({
            "message": "Registration successful",
            "email_sent": email_sent,
            "token": token,
            "user": user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        print("REGISTER ERROR:", str(e))
        return jsonify({"message": f"Registration failed: {str(e)}"}), 500


@auth_bp.post("/login")
def login():
    try:
        data = request.get_json() or {}

        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            return jsonify({"message": "Invalid email or password"}), 401

        token = build_token(user)
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": user.to_dict()
        }), 200

    except Exception as e:
        print("LOGIN ERROR:", str(e))
        return jsonify({"message": f"Login failed: {str(e)}"}), 500


@auth_bp.post("/google-login")
def google_login():
    try:
        data = request.get_json() or {}
        credential = data.get("credential")

        if not credential:
            return jsonify({"message": "Google credential is required"}), 400

        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            return jsonify({"message": "GOOGLE_CLIENT_ID is not configured on backend"}), 500

        idinfo = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            google_client_id,
        )

        google_id = idinfo.get("sub")
        email = (idinfo.get("email") or "").strip().lower()
        full_name = (idinfo.get("name") or "Google User").strip()

        if not google_id or not email:
            return jsonify({"message": "Invalid Google token"}), 400

        user = User.query.filter(
            (User.google_id == google_id) | (User.email == email)
        ).first()

        if not user:
            random_password = secrets.token_hex(16)
            hashed_password = bcrypt.generate_password_hash(random_password).decode("utf-8")

            user = User(
                full_name=full_name,
                email=email,
                role="user",
                auth_provider="google",
                google_id=google_id,
                password_hash=hashed_password,
                must_change_password=False,
            )
            db.session.add(user)
        else:
            user.full_name = user.full_name or full_name
            user.email = user.email or email
            user.google_id = user.google_id or google_id
            user.auth_provider = "google"

        db.session.commit()

        token = build_token(user)
        return jsonify({
            "message": "Google login successful",
            "token": token,
            "user": user.to_dict()
        }), 200

    except ValueError as e:
        print("GOOGLE LOGIN ERROR:", str(e))
        return jsonify({"message": "Invalid Google token"}), 401
    except Exception as e:
        db.session.rollback()
        print("GOOGLE LOGIN ERROR:", str(e))
        return jsonify({"message": f"Google login failed: {str(e)}"}), 500


@auth_bp.post("/phone/send-otp")
def send_phone_otp():
    try:
        data = request.get_json() or {}
        raw_phone = data.get("phone")
        phone = normalize_phone(raw_phone)
        formatted_phone = format_indian_phone(raw_phone)
        full_name = (data.get("full_name") or "Phone User").strip()

        if not phone or len(phone) < 10:
            return jsonify({"message": "Valid phone number is required"}), 400

        user = User.query.filter_by(contact=phone).first()
        if not user:
            user = User(
                full_name=full_name,
                email=None,
                role="user",
                contact=phone,
                auth_provider="phone",
                phone_verified=False,
                must_change_password=False,
            )
            db.session.add(user)
            db.session.flush()

        client, service_sid = get_twilio_verify_client()
        if not client or not service_sid:
            return jsonify({"message": "Twilio Verify is not configured properly"}), 500

        verification = client.verify.v2.services(service_sid).verifications.create(
            to=formatted_phone,
            channel="sms"
        )

        user.phone_otp_expires_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "message": "OTP sent successfully",
            "status": verification.status
        }), 200

    except Exception as e:
        db.session.rollback()
        print("SEND OTP ERROR:", str(e))
        return jsonify({"message": f"Failed to send OTP: {str(e)}"}), 500

@auth_bp.post("/phone/verify-otp")
def verify_phone_otp():
    try:
        data = request.get_json() or {}
        raw_phone = data.get("phone")
        phone = normalize_phone(raw_phone)
        formatted_phone = format_indian_phone(raw_phone)
        otp = str(data.get("otp") or "").strip()
        full_name = (data.get("full_name") or "Phone User").strip()

        if not phone or not otp:
            return jsonify({"message": "Phone and OTP are required"}), 400

        user = User.query.filter_by(contact=phone).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        client, service_sid = get_twilio_verify_client()
        if not client or not service_sid:
            return jsonify({"message": "Twilio Verify is not configured properly"}), 500

        check = client.verify.v2.services(service_sid).verification_checks.create(
            to=formatted_phone,
            code=otp
        )

        if check.status != "approved":
            return jsonify({"message": "Invalid OTP"}), 401

        user.full_name = user.full_name or full_name
        user.phone_verified = True
        user.auth_provider = "phone"
        user.clear_phone_otp()
        db.session.commit()

        token = build_token(user)

        return jsonify({
            "message": "Phone login successful",
            "token": token,
            "user": user.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        print("VERIFY OTP ERROR:", str(e))
        return jsonify({"message": f"Failed to verify OTP: {str(e)}"}), 500

@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return jsonify({"message": "User not found"}), 404

        data = request.get_json() or {}
        old_password = (data.get("old_password") or "").strip()
        new_password = (data.get("new_password") or "").strip()
        confirm_password = (data.get("confirm_password") or "").strip()

        if not old_password or not new_password or not confirm_password:
            return jsonify({"message": "All password fields are required"}), 400

        if not user.check_password(old_password):
            return jsonify({"message": "Old password is incorrect"}), 400

        if new_password != confirm_password:
            return jsonify({"message": "New password and confirm password do not match"}), 400

        if len(new_password) < 6:
            return jsonify({"message": "New password must be at least 6 characters"}), 400

        user.set_password(new_password)
        user.must_change_password = False

        db.session.commit()

        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print("CHANGE PASSWORD ERROR:", str(e))
        return jsonify({"message": f"Failed to change password: {str(e)}"}), 500