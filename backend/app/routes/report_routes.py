from datetime import date
from io import BytesIO

import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from sqlalchemy import extract

from app.models.user import User
from app.models.attendance import Attendance
from app.models.expense import Expense, ExpenseCategory
from app.models.complaint import Complaint
from app.models.bill import Bill
from app.utils.db import db

report_bp = Blueprint("report_bp", __name__)


def is_admin():
    return get_jwt().get("role") == "admin"


def get_current_user_id():
    return int(get_jwt_identity())


@report_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_summary():
    try:
        today = date.today()
        month = int(request.args.get("month", today.month))
        year = int(request.args.get("year", today.year))
        current_user_id = get_current_user_id()
        admin = is_admin()

        # =========================
        # ADMIN SUMMARY
        # =========================
        if admin:
            total_users = User.query.count()

            total_expense = db.session.query(db.func.sum(Expense.amount)).filter(
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year,
            ).scalar() or 0

            attendance_rows = Attendance.query.filter(
                extract("month", Attendance.date) == month,
                extract("year", Attendance.date) == year,
            ).all()

            total_meals = 0
            meals_today = 0
            breakfast_total = 0
            lunch_total = 0
            dinner_total = 0

            for r in attendance_rows:
                breakfast_total += int(bool(r.breakfast))
                lunch_total += int(bool(r.lunch))
                dinner_total += int(bool(r.dinner))

                count = int(bool(r.breakfast)) + int(bool(r.lunch)) + int(bool(r.dinner))
                total_meals += count
                if str(r.date) == str(today):
                    meals_today += count

            pending_complaints = Complaint.query.filter(
                Complaint.status.in_(["Open", "In Progress", "Pending"])
            ).count()

            unpaid_bills = Bill.query.filter(Bill.status == "Unpaid").count()
            pending_approval_bills = Bill.query.filter(Bill.status == "Pending Approval").count()
            paid_bills = Bill.query.filter(Bill.status == "Paid").count()

            recent_expenses = Expense.query.order_by(Expense.expense_date.desc()).limit(5).all()
            recent_attendance = Attendance.query.order_by(Attendance.date.desc()).limit(5).all()
            recent_complaints = Complaint.query.order_by(Complaint.created_at.desc()).limit(5).all()

            return jsonify({
                "role": "admin",
                "total_users": total_users,
                "total_expense": float(total_expense),
                "total_attendance": total_meals,
                "meals_today": meals_today,
                "pending_complaints": pending_complaints,
                "unpaid_bills": unpaid_bills,
                "pending_approval_bills": pending_approval_bills,
                "paid_bills": paid_bills,
                "low_stock_items": 0,
                "meal_breakdown": {
                    "breakfast": breakfast_total,
                    "lunch": lunch_total,
                    "dinner": dinner_total,
                },
                "recent_expenses": [
                    {
                        "title": e.title,
                        "amount": float(e.amount),
                        "expense_date": str(e.expense_date)
                    } for e in recent_expenses
                ],
                "recent_attendance": [
                    {
                        "user_id": a.user_id,
                        "date": str(a.date),
                        "breakfast": a.breakfast,
                        "lunch": a.lunch,
                        "dinner": a.dinner
                    } for a in recent_attendance
                ],
                "recent_complaints": [
                    {
                        "id": c.id,
                        "type": c.complaint_type,
                        "message": c.message,
                        "status": c.status,
                        "priority": getattr(c, "priority", "Medium"),
                        "created_at": str(c.created_at) if c.created_at else None
                    } for c in recent_complaints
                ]
            }), 200

        # =========================
        # USER SUMMARY (ONLY OWN DATA)
        # =========================
        attendance_rows = Attendance.query.filter(
            Attendance.user_id == current_user_id,
            extract("month", Attendance.date) == month,
            extract("year", Attendance.date) == year,
        ).all()

        total_meals = 0
        meals_today = 0
        breakfast_total = 0
        lunch_total = 0
        dinner_total = 0

        for r in attendance_rows:
            breakfast_total += int(bool(r.breakfast))
            lunch_total += int(bool(r.lunch))
            dinner_total += int(bool(r.dinner))

            count = int(bool(r.breakfast)) + int(bool(r.lunch)) + int(bool(r.dinner))
            total_meals += count
            if str(r.date) == str(today):
                meals_today += count

        pending_complaints = Complaint.query.filter(
            Complaint.user_id == current_user_id,
            Complaint.status.in_(["Open", "In Progress", "Pending"])
        ).count()

        unpaid_bills = Bill.query.filter(
            Bill.user_id == current_user_id,
            Bill.status == "Unpaid"
        ).count()

        pending_approval_bills = Bill.query.filter(
            Bill.user_id == current_user_id,
            Bill.status == "Pending Approval"
        ).count()

        paid_bills = Bill.query.filter(
            Bill.user_id == current_user_id,
            Bill.status == "Paid"
        ).count()

        recent_complaints = Complaint.query.filter(
            Complaint.user_id == current_user_id
        ).order_by(Complaint.created_at.desc()).limit(5).all()

        recent_bills = Bill.query.filter(
            Bill.user_id == current_user_id
        ).order_by(Bill.created_at.desc()).limit(5).all()

        return jsonify({
            "role": "user",
            "total_users": 0,
            "total_expense": 0,
            "total_attendance": total_meals,
            "meals_today": meals_today,
            "pending_complaints": pending_complaints,
            "unpaid_bills": unpaid_bills,
            "pending_approval_bills": pending_approval_bills,
            "paid_bills": paid_bills,
            "low_stock_items": 0,
            "meal_breakdown": {
                "breakfast": breakfast_total,
                "lunch": lunch_total,
                "dinner": dinner_total,
            },
            "recent_expenses": [],
            "recent_attendance": [
                {
                    "user_id": a.user_id,
                    "date": str(a.date),
                    "breakfast": a.breakfast,
                    "lunch": a.lunch,
                    "dinner": a.dinner
                } for a in sorted(attendance_rows, key=lambda x: x.date, reverse=True)[:5]
            ],
            "recent_complaints": [
                {
                    "id": c.id,
                    "type": c.complaint_type,
                    "message": c.message,
                    "status": c.status,
                    "priority": getattr(c, "priority", "Medium"),
                    "created_at": str(c.created_at) if c.created_at else None
                } for c in recent_complaints
            ],
            "recent_bills": [
                {
                    "bill_id": b.id,
                    "period": b.period,
                    "total_amount": float(b.total_amount or 0),
                    "status": b.status,
                    "month": b.month,
                    "year": b.year,
                    "created_at": str(b.created_at) if b.created_at else None
                } for b in recent_bills
            ]
        }), 200

    except Exception as e:
        print("REPORT SUMMARY ERROR:", str(e))
        return jsonify({"message": f"Failed to load summary: {str(e)}"}), 500


@report_bp.route("/export-attendance", methods=["GET"])
@jwt_required()
def export_attendance_excel():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can export attendance"}), 403

        rows = Attendance.query.order_by(Attendance.date.desc(), Attendance.id.desc()).all()

        data = []
        for row in rows:
            user = User.query.get(row.user_id)
            meal_count = int(bool(row.breakfast)) + int(bool(row.lunch)) + int(bool(row.dinner))
            data.append({
                "User Name": user.full_name if user else "-",
                "Email": user.email if user else "-",
                "Date": str(row.date),
                "Breakfast": "Yes" if row.breakfast else "No",
                "Lunch": "Yes" if row.lunch else "No",
                "Dinner": "Yes" if row.dinner else "No",
                "Meal Count": meal_count,
            })

        df = pd.DataFrame(data)
        output = BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Attendance")

        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name="attendance-report.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    except Exception as e:
        print("EXPORT ATTENDANCE ERROR:", str(e))
        return jsonify({"message": f"Failed to export attendance: {str(e)}"}), 500


@report_bp.route("/export-expenses", methods=["GET"])
@jwt_required()
def export_expenses_excel():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can export expenses"}), 403

        rows = Expense.query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()

        data = []
        for row in rows:
            category = ExpenseCategory.query.get(row.category_id) if row.category_id else None
            data.append({
                "Title": row.title,
                "Category": category.name if category else "-",
                "Amount": float(row.amount or 0),
                "Expense Date": str(row.expense_date),
            })

        df = pd.DataFrame(data)
        output = BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Expenses")

        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name="expense-report.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    except Exception as e:
        print("EXPORT EXPENSES ERROR:", str(e))
        return jsonify({"message": f"Failed to export expenses: {str(e)}"}), 500


@report_bp.route("/export-users", methods=["GET"])
@jwt_required()
def export_users_excel():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can export users"}), 403

        rows = User.query.order_by(User.id.desc()).all()

        data = []
        for row in rows:
            data.append({
                "ID": row.id,
                "Full Name": row.full_name,
                "Email": row.email,
                "Role": row.role,
                "Created At": str(row.created_at) if getattr(row, "created_at", None) else "-",
            })

        df = pd.DataFrame(data)
        output = BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Users")

        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name="users-report.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    except Exception as e:
        print("EXPORT USERS ERROR:", str(e))
        return jsonify({"message": f"Failed to export users: {str(e)}"}), 500


@report_bp.route("/charts/expenses", methods=["GET"])
@jwt_required()
def expense_chart():
    try:
        if not is_admin():
            return jsonify([]), 200

        month = int(request.args.get("month", date.today().month))
        year = int(request.args.get("year", date.today().year))

        rows = db.session.query(
            ExpenseCategory.name.label("category_name"),
            db.func.sum(Expense.amount).label("total_amount")
        ).join(ExpenseCategory, Expense.category_id == ExpenseCategory.id).filter(
            extract("month", Expense.expense_date) == month,
            extract("year", Expense.expense_date) == year
        ).group_by(ExpenseCategory.name).order_by(ExpenseCategory.name.asc()).all()

        return jsonify([
            {"label": row.category_name, "value": float(row.total_amount or 0)}
            for row in rows
        ]), 200
    except Exception as e:
        print("EXPENSE CHART ERROR:", str(e))
        return jsonify({"message": f"Failed to load expense chart: {str(e)}"}), 500


@report_bp.route("/charts/complaints", methods=["GET"])
@jwt_required()
def complaint_chart():
    try:
        current_user_id = get_current_user_id()

        query = db.session.query(
            Complaint.status,
            db.func.count(Complaint.id)
        )

        if not is_admin():
            query = query.filter(Complaint.user_id == current_user_id)

        rows = query.group_by(Complaint.status).all()

        return jsonify([
            {"label": row[0], "value": int(row[1])}
            for row in rows
        ]), 200
    except Exception as e:
        print("COMPLAINT CHART ERROR:", str(e))
        return jsonify({"message": f"Failed to load complaint chart: {str(e)}"}), 500


@report_bp.route("/charts/billing", methods=["GET"])
@jwt_required()
def billing_chart():
    try:
        month = request.args.get("month")
        year = request.args.get("year")
        current_user_id = get_current_user_id()

        query = db.session.query(Bill.status, db.func.count(Bill.id))

        if not is_admin():
            query = query.filter(Bill.user_id == current_user_id)

        if month:
            query = query.filter(Bill.month == int(month))
        if year:
            query = query.filter(Bill.year == int(year))

        rows = query.group_by(Bill.status).all()

        return jsonify([
            {"label": row[0], "value": int(row[1])}
            for row in rows
        ]), 200
    except Exception as e:
        print("BILLING CHART ERROR:", str(e))
        return jsonify({"message": f"Failed to load billing chart: {str(e)}"}), 500


@report_bp.route("/charts/attendance", methods=["GET"])
@jwt_required()
def attendance_chart():
    try:
        month = int(request.args.get("month", date.today().month))
        year = int(request.args.get("year", date.today().year))
        current_user_id = get_current_user_id()

        query = Attendance.query.filter(
            extract("month", Attendance.date) == month,
            extract("year", Attendance.date) == year,
        )

        if not is_admin():
            query = query.filter(Attendance.user_id == current_user_id)

        rows = query.all()

        breakfast = sum(int(bool(r.breakfast)) for r in rows)
        lunch = sum(int(bool(r.lunch)) for r in rows)
        dinner = sum(int(bool(r.dinner)) for r in rows)

        return jsonify([
            {"label": "Breakfast", "value": breakfast},
            {"label": "Lunch", "value": lunch},
            {"label": "Dinner", "value": dinner},
        ]), 200
    except Exception as e:
        print("ATTENDANCE CHART ERROR:", str(e))
        return jsonify({"message": f"Failed to load attendance chart: {str(e)}"}), 500


@report_bp.route("/bill-export/<int:bill_id>", methods=["GET"])
@jwt_required()
def get_single_bill_export_data(bill_id):
    try:
        bill = Bill.query.get_or_404(bill_id)
        current_user_id = int(get_jwt_identity())

        if not is_admin() and bill.user_id != current_user_id:
            return jsonify({"message": "Not allowed"}), 403

        user = bill.user if hasattr(bill, "user") else User.query.get(bill.user_id)

        return jsonify({
            "bill_id": bill.id,
            "user_name": user.full_name if user else "-",
            "user_email": user.email if user else "-",
            "month": bill.month,
            "year": bill.year,
            "period": bill.period,
            "meals": int(bill.total_meals or 0),
            "per_meal_cost": float(bill.per_meal_cost or 0),
            "total_amount": float(bill.total_amount or 0),
            "payment_status": bill.status,
            "created_at": str(bill.created_at) if bill.created_at else None,
        }), 200
    except Exception as e:
        print("BILL EXPORT ERROR:", str(e))
        return jsonify({"message": f"Failed to export bill: {str(e)}"}), 500


@report_bp.route("/bills-export", methods=["GET"])
@jwt_required()
def get_monthly_bills_export_data():
    try:
        if not is_admin():
            return jsonify({"message": "Only admin can export all bills"}), 403

        month = request.args.get("month")
        year = request.args.get("year")

        if not month or not year:
            return jsonify({"message": "month and year are required"}), 400

        bills = Bill.query.filter(
            Bill.month == int(month),
            Bill.year == int(year)
        ).order_by(Bill.id.asc()).all()

        return jsonify({
            "month": int(month),
            "year": int(year),
            "count": len(bills),
            "bills": [
                {
                    "bill_id": bill.id,
                    "user_name": bill.user.full_name if bill.user else "-",
                    "user_email": bill.user.email if bill.user else "-",
                    "month": bill.month,
                    "year": bill.year,
                    "period": bill.period,
                    "meals": int(bill.total_meals or 0),
                    "per_meal_cost": float(bill.per_meal_cost or 0),
                    "total_amount": float(bill.total_amount or 0),
                    "payment_status": bill.status,
                }
                for bill in bills
            ]
        }), 200
    except Exception as e:
        print("MONTHLY BILL EXPORT ERROR:", str(e))
        return jsonify({"message": f"Failed to export bills: {str(e)}"}), 500