from app.models.expense import Expense
from app.models.attendance import Attendance
from sqlalchemy import extract
from app.utils.db import db

def calculate_bill(month, year):
    total_expense = db.session.query(
        db.func.sum(Expense.amount)
    ).filter(
        extract('month', Expense.expense_date) == month,
        extract('year', Expense.expense_date) == year
    ).scalar() or 0

    records = Attendance.query.filter(
        extract('month', Attendance.date) == month,
        extract('year', Attendance.date) == year
    ).all()

    total_meals = 0
    for r in records:
        total_meals += (r.breakfast + r.lunch + r.dinner)

    if total_meals == 0:
        return 0, 0

    per_meal_cost = total_expense / total_meals
    return total_expense, per_meal_cost