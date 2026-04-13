from datetime import date, timedelta
from calendar import monthrange
from sqlalchemy import extract

from app.models.user import User
from app.models.attendance import Attendance
from app.models.expense import Expense
from app.models.bill import Bill
from app.models.leave import Leave                  # ← NEW
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


# ── NEW: get all approved leave dates for a user in a given month ─────────────

def get_user_leave_dates(user_id: int, month: int, year: int) -> set:
    """
    Returns a set of date objects on which this user is on approved leave
    within the given month/year. Used to skip those days during billing.
    """
    start_of_month = date(year, month, 1)
    end_of_month   = date(year, month, monthrange(year, month)[1])

    leaves = Leave.query.filter(
        Leave.user_id    == user_id,
        Leave.status     == "Approved",
        Leave.start_date <= end_of_month,
        Leave.end_date   >= start_of_month,
    ).all()

    leave_dates = set()
    for leave in leaves:
        cur = max(leave.start_date, start_of_month)
        end = min(leave.end_date,   end_of_month)
        while cur <= end:
            leave_dates.add(cur)
            cur += timedelta(days=1)

    return leave_dates


# ─────────────────────────────────────────────────────────────────────────────

def calculate_monthly_per_meal_cost(month, year):
    """
    Total expense / total meals actually eaten (approved leave days excluded).
    This is fair — we only charge for meals that were actually prepared.
    """
    total_expense = db.session.query(
        db.func.sum(Expense.amount)
    ).filter(
        extract("month", Expense.expense_date) == month,
        extract("year",  Expense.expense_date) == year
    ).scalar() or 0

    attendance_rows = Attendance.query.filter(
        extract("month", Attendance.date) == month,
        extract("year",  Attendance.date) == year
    ).all()

    # Cache leave dates per user to avoid repeated DB hits
    leave_cache = {}

    total_meals = 0
    for a in attendance_rows:
        if a.user_id not in leave_cache:
            leave_cache[a.user_id] = get_user_leave_dates(a.user_id, month, year)

        if a.date in leave_cache[a.user_id]:
            continue   # on approved leave — don't count this day

        total_meals += int(bool(a.breakfast)) + int(bool(a.lunch)) + int(bool(a.dinner))

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

    Leave logic:
      - per_meal_cost = total expense / meals eaten (leave days excluded globally)
      - each user's bill = their meals eaten on NON-leave days × per_meal_cost
      - students on leave are NOT charged for those days
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
        # Get this user's approved leave dates for the month
        user_leave_dates = get_user_leave_dates(user.id, month, year)

        attendance_rows = Attendance.query.filter(
            Attendance.user_id == user.id,
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
        ).all()

        # Count only meals eaten on days the student was NOT on leave
        user_total_meals = 0
        for a in attendance_rows:
            if a.date in user_leave_dates:
                continue   # approved leave → skip this day
            user_total_meals += int(bool(a.breakfast)) + int(bool(a.lunch)) + int(bool(a.dinner))

        total_amount = round(user_total_meals * per_meal_cost, 2)
        leave_days   = len(user_leave_dates)

        existing_bill = Bill.query.filter_by(
            user_id=user.id,
            month=month,
            year=year
        ).first()

        if existing_bill:
            existing_bill.total_meals    = user_total_meals
            existing_bill.per_meal_cost  = per_meal_cost
            existing_bill.total_amount   = total_amount
            existing_bill.period         = f"{month:02d}/{year}"
            existing_bill.bill_type      = "monthly"

            if existing_bill.status != "Paid":
                existing_bill.status = "Unpaid"

            updated_count += 1
        else:
            new_bill = Bill(
                user_id       = user.id,
                month         = month,
                year          = year,
                period        = f"{month:02d}/{year}",
                bill_type     = "monthly",
                total_meals   = user_total_meals,
                per_meal_cost = per_meal_cost,
                total_amount  = total_amount,
                status        = "Unpaid",
            )
            db.session.add(new_bill)
            created_count += 1

        leave_note = f" ({leave_days} leave day(s) not charged)" if leave_days else ""

        create_notification(
            title="Monthly Bill Generated",
            message=(
                f"Your bill for {month:02d}/{year} has been generated automatically. "
                f"Meals: {user_total_meals}, Per Meal Cost: ₹{per_meal_cost:.2f}, "
                f"Total: ₹{total_amount:.2f}{leave_note}"
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
        "success":       True,
        "skipped":       False,
        "message":       f"Auto bills generated for {month:02d}/{year}",
        "created_count": created_count,
        "updated_count": updated_count,
        "per_meal_cost": per_meal_cost,
        "total_expense": total_expense,
        "total_meals":   total_meals,
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