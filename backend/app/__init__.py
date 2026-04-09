import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from app.config import Config
from app.utils.db import db, jwt, bcrypt, mail
from app.models.user import User
from app.models.expense import ExpenseCategory
from app.scheduler import start_scheduler


def seed_admin_and_categories(app):
    admin_email = (app.config.get("ADMIN_EMAIL") or "").strip().lower()
    admin_password = app.config.get("ADMIN_PASSWORD") or ""

    if admin_email and admin_password:
        existing = User.query.filter_by(email=admin_email).first()

        if not existing:
            admin = User(
                full_name="Admin",
                email=admin_email,
                role="admin",
                must_change_password=False,
            )
            admin.set_password(admin_password)
            db.session.add(admin)
            print("Admin user created successfully.")
        else:
            updated = False

            if existing.role != "admin":
                existing.role = "admin"
                updated = True

            # Optional: if old admin password was stored in plain text or old/wrong format,
            # uncomment below to force-reset admin password on every startup.
            # existing.set_password(admin_password)
            # updated = True

            if updated:
                print("Existing admin updated successfully.")
            else:
                print("Admin already exists.")

    default_categories = [
        "Vegetables",
        "Groceries",
        "Milk",
        "Gas",
        "Cleaning",
        "Other",
    ]

    for name in default_categories:
        if not ExpenseCategory.query.filter_by(name=name).first():
            db.session.add(ExpenseCategory(name=name))

    db.session.commit()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    upload_folder = app.config.get("UPLOAD_FOLDER", "uploads")
    os.makedirs(upload_folder, exist_ok=True)
    app.config["UPLOAD_FOLDER"] = upload_folder

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:5174",
                    "http://127.0.0.1:5174",
                ]
            }
        },
        supports_credentials=True,
    )

    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    mail.init_app(app)

    from app.routes.auth_routes import auth_bp
    from app.routes.user_routes import user_bp
    from app.routes.expense_routes import expense_bp
    from app.routes.report_routes import report_bp
    from app.routes.menu_routes import menu_bp
    from app.routes.inventory_routes import inventory_bp
    from app.routes.complaint_routes import complaint_bp
    from app.routes.notification_routes import notification_bp
    from app.routes.billing_routes import billing_bp
    from app.routes.attendance_routes import attendance_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api")
    app.register_blueprint(expense_bp, url_prefix="/api/expenses")
    app.register_blueprint(report_bp, url_prefix="/api/reports")
    app.register_blueprint(menu_bp, url_prefix="/api/menu")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(complaint_bp, url_prefix="/api/complaints")
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(billing_bp, url_prefix="/api/billing")
    app.register_blueprint(attendance_bp, url_prefix="/api")

    @app.get("/api/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    with app.app_context():
        from app.models.attendance import Attendance
        from app.models.bill import Bill
        from app.models.menu import MenuItem
        from app.models.inventory import Inventory
        from app.models.complaint import Complaint
        from app.models.notification import Notification
        from app.models.payment import Payment
        from app.models.expense import Expense

        db.create_all()
        seed_admin_and_categories(app)

    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        start_scheduler(app)

    return app