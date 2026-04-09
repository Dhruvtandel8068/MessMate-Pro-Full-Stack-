import csv
import io
from datetime import datetime

from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import extract

from app.models.expense import Expense, ExpenseCategory
from app.models.notification import Notification
from app.utils.db import db
from app.helpers.notifications import create_notification
expense_bp = Blueprint("expense_bp", __name__)


def is_admin():
    claims = get_jwt()
    return claims.get("role") == "admin"


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


def expense_to_dict(e):
    return {
        "id": e.id,
        "title": e.title,
        "category_id": e.category_id,
        "category_name": e.category.name if e.category else "-",
        "amount": float(e.amount),
        "expense_date": str(e.expense_date),
        "created_at": str(e.created_at) if getattr(e, "created_at", None) else None,
    }


@expense_bp.route("/categories", methods=["GET"])
@jwt_required()
def get_categories():
    categories = ExpenseCategory.query.order_by(ExpenseCategory.name.asc()).all()
    return jsonify([{"id": c.id, "name": c.name} for c in categories]), 200


@expense_bp.route("/", methods=["GET"])
@jwt_required()
def get_expenses():
    month = request.args.get("month")
    year = request.args.get("year")
    category_id = request.args.get("category_id")

    query = Expense.query

    if month:
        query = query.filter(extract("month", Expense.expense_date) == int(month))
    if year:
        query = query.filter(extract("year", Expense.expense_date) == int(year))
    if category_id:
        query = query.filter(Expense.category_id == int(category_id))

    expenses = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()
    return jsonify([expense_to_dict(e) for e in expenses]), 200


@expense_bp.route("/summary", methods=["GET"])
@jwt_required()
def get_expense_summary():
    month = request.args.get("month")
    year = request.args.get("year")

    query = db.session.query(
        ExpenseCategory.name.label("category_name"),
        db.func.sum(Expense.amount).label("total_amount"),
        db.func.count(Expense.id).label("count_items")
    ).join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)

    if month:
        query = query.filter(extract("month", Expense.expense_date) == int(month))
    if year:
        query = query.filter(extract("year", Expense.expense_date) == int(year))

    rows = query.group_by(ExpenseCategory.name).order_by(ExpenseCategory.name.asc()).all()

    grand_total = db.session.query(db.func.sum(Expense.amount))
    if month:
        grand_total = grand_total.filter(extract("month", Expense.expense_date) == int(month))
    if year:
        grand_total = grand_total.filter(extract("year", Expense.expense_date) == int(year))
    grand_total = float(grand_total.scalar() or 0)

    return jsonify({
        "grand_total": grand_total,
        "categories": [
            {
                "category_name": row.category_name,
                "total_amount": float(row.total_amount or 0),
                "count_items": int(row.count_items or 0),
            }
            for row in rows
        ]
    }), 200


@expense_bp.route("/", methods=["POST"])
@jwt_required()
def create_expense():
    if not is_admin():
        return jsonify({"message": "Unauthorized"}), 403

    try:
        data = request.get_json() or {}

        title = (data.get("title") or "").strip()
        category_id = data.get("category_id")
        amount = data.get("amount")
        expense_date = data.get("expense_date")

        if not title or not category_id or amount is None or not expense_date:
            return jsonify({"message": "title, category_id, amount and expense_date are required"}), 400

        expense = Expense(
            title=title,
            category_id=int(category_id),
            amount=float(amount),
            expense_date=datetime.strptime(expense_date, "%Y-%m-%d").date(),
        )
        db.session.add(expense)
        db.session.flush()

        create_notification(
            title="New Expense Added",
            message=f"Expense '{title}' of ₹{float(amount):.2f} has been added.",
            role_target="admin",
            notification_type="expense_created",
            action_url="/expenses",
        )

        db.session.commit()
        return jsonify({"message": "Expense added successfully", "expense": expense_to_dict(expense)}), 201

    except Exception as e:
        db.session.rollback()
        print("EXPENSE CREATE ERROR:", e)
        return jsonify({"message": str(e)}), 500


@expense_bp.route("/<int:expense_id>", methods=["PUT"])
@jwt_required()
def update_expense(expense_id):
    if not is_admin():
        return jsonify({"message": "Unauthorized"}), 403

    try:
        expense = Expense.query.get_or_404(expense_id)
        data = request.get_json() or {}

        expense.title = (data.get("title") or expense.title).strip()
        expense.category_id = int(data.get("category_id") or expense.category_id)
        expense.amount = float(data.get("amount") or expense.amount)
        if data.get("expense_date"):
            expense.expense_date = datetime.strptime(data.get("expense_date"), "%Y-%m-%d").date()

        db.session.commit()
        return jsonify({"message": "Expense updated successfully", "expense": expense_to_dict(expense)}), 200

    except Exception as e:
        db.session.rollback()
        print("EXPENSE UPDATE ERROR:", e)
        return jsonify({"message": str(e)}), 500


@expense_bp.route("/<int:expense_id>", methods=["DELETE"])
@jwt_required()
def delete_expense(expense_id):
    if not is_admin():
        return jsonify({"message": "Unauthorized"}), 403

    try:
        expense = Expense.query.get_or_404(expense_id)
        db.session.delete(expense)
        db.session.commit()
        return jsonify({"message": "Expense deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print("EXPENSE DELETE ERROR:", e)
        return jsonify({"message": str(e)}), 500


@expense_bp.route("/export", methods=["GET"])
@jwt_required()
def export_expenses():
    month = request.args.get("month")
    year = request.args.get("year")

    query = Expense.query
    if month:
        query = query.filter(extract("month", Expense.expense_date) == int(month))
    if year:
        query = query.filter(extract("year", Expense.expense_date) == int(year))

    expenses = query.order_by(Expense.expense_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Title", "Category", "Amount", "Expense Date"])

    for e in expenses:
        writer.writerow([
            e.title,
            e.category.name if e.category else "-",
            float(e.amount),
            str(e.expense_date),
        ])

    csv_data = output.getvalue()
    output.close()

    file_name = f"expenses_{month or 'all'}_{year or 'all'}.csv"
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={file_name}"}
    )