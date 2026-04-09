from datetime import date
from calendar import monthrange
from sqlalchemy import extract

from app.models.user import User
from app.models.attendance import Attendance
from app.models.expense import Expense
from app.models.bill import Bill
from app.models.notification import Notification
from app.utils.db import db


def get_previous_month_year(reference_date=None):
    if reference_date is None:
        reference_date = date.today()

    if reference_date.month == 1:
        return 12, reference_date.year - 1

    return reference_date.month - 1, reference_date.year


def get_period_dates(month, year):
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def create_notification(
    title,
    message,
    user_id=None,
    role_target=None,
    notification_type="general",
    action_url=None,
):
    row = Notification(
        user_id=user_id,
        title=title,
        message=message,
        role_target=role_target,
        notification_type=notification_type,
        action_url=action_url,
    )
    db.session.add(row)


def calculate_monthly_per_meal_cost(month, year):
    total_expense = db.session.query(
        db.func.sum(Expense.amount)
    ).filter(
        extract("month", Expense.expense_date) == month,
        extract("year", Expense.expense_date) == year
    ).scalar() or 0

    attendance_rows = Attendance.query.filter(
        extract("month", Attendance.date) == month,
        extract("year", Attendance.date) == year
    ).all()

    total_meals = sum(
        int(bool(a.breakfast)) + int(bool(a.lunch)) + int(bool(a.dinner))
        for a in attendance_rows
    )

    if total_meals <= 0:
        return 0.0, 0.0, 0

    per_meal_cost = round(float(total_expense) / total_meals, 2)
    return round(float(total_expense), 2), per_meal_cost, total_meals


def bills_already_exist(month, year):
    count = Bill.query.filter_by(month=month, year=year).count()
    return count > 0


def generate_monthly_bills_auto(month, year, force=False):
    """
    Auto-generate bills for all users for the given month/year.
    Uses:
        per meal cost = total monthly expense / total monthly meals
    """

    if not force and bills_already_exist(month, year):
        return {
            "success": True,
            "skipped": True,
            "message": f"Bills already exist for {month:02d}/{year}",
            "created_count": 0,
            "updated_count": 0,
            "per_meal_cost": 0,
            "total_expense": 0,
            "total_meals": 0,
        }

    users = User.query.filter_by(role="user").all()
    if not users:
        return {
            "success": False,
            "message": "No user accounts found for bill generation",
        }

    total_expense, per_meal_cost, total_meals = calculate_monthly_per_meal_cost(month, year)

    if total_meals <= 0:
        return {
            "success": False,
            "message": f"No attendance/meals found for {month:02d}/{year}. Auto bill generation skipped.",
            "total_expense": total_expense,
            "total_meals": total_meals,
            "per_meal_cost": 0,
        }

    created_count = 0
    updated_count = 0

    for user in users:
        attendance_rows = Attendance.query.filter(
            Attendance.user_id == user.id,
            extract("month", Attendance.date) == month,
            extract("year", Attendance.date) == year,
        ).all()

        user_total_meals = sum(
            int(bool(a.breakfast)) + int(bool(a.lunch)) + int(bool(a.dinner))
            for a in attendance_rows
        )

        total_amount = round(user_total_meals * per_meal_cost, 2)

        existing_bill = Bill.query.filter_by(
            user_id=user.id,
            month=month,
            year=year
        ).first()

        if existing_bill:
            existing_bill.total_meals = user_total_meals
            existing_bill.per_meal_cost = per_meal_cost
            existing_bill.total_amount = total_amount
            existing_bill.period = f"{month:02d}/{year}"
            existing_bill.bill_type = "monthly"

            if existing_bill.status != "Paid":
                existing_bill.status = "Unpaid"

            updated_count += 1
        else:
            new_bill = Bill(
                user_id=user.id,
                month=month,
                year=year,
                period=f"{month:02d}/{year}",
                bill_type="monthly",
                total_meals=user_total_meals,
                per_meal_cost=per_meal_cost,
                total_amount=total_amount,
                status="Unpaid",
            )
            db.session.add(new_bill)
            created_count += 1

        create_notification(
            title="Monthly Bill Generated",
            message=(
                f"Your bill for {month:02d}/{year} has been generated automatically. "
                f"Meals: {user_total_meals}, Per Meal Cost: ₹{per_meal_cost:.2f}, "
                f"Total: ₹{total_amount:.2f}"
            ),
            user_id=user.id,
            notification_type="bill_generated",
            action_url="/billing",
        )

    create_notification(
        title="Auto Bill Generation Completed",
        message=(
            f"Monthly auto bill generation completed for {month:02d}/{year}. "
            f"Created: {created_count}, Updated: {updated_count}, "
            f"Per Meal Cost: ₹{per_meal_cost:.2f}"
        ),
        role_target="admin",
        notification_type="bill_generated",
        action_url="/billing",
    )

    db.session.commit()

    return {
        "success": True,
        "skipped": False,
        "message": f"Auto bills generated for {month:02d}/{year}",
        "created_count": created_count,
        "updated_count": updated_count,
        "per_meal_cost": per_meal_cost,
        "total_expense": total_expense,
        "total_meals": total_meals,
    }


def run_auto_bill_for_previous_month(window_days=5):
    """
    This runs only during the first few days of the current month.
    Example:
    - On April 1 to April 5, it generates bills for March.
    """
    today = date.today()

    if today.day > window_days:
        return {
            "success": True,
            "skipped": True,
            "message": f"Today is day {today.day}. Auto generation window already passed.",
        }

    month, year = get_previous_month_year(today)
    return generate_monthly_bills_auto(month, year, force=False)