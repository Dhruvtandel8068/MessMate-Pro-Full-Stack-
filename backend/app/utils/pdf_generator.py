from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors


def generate_bill_pdf(bill, user):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Header
    pdf.setFont("Helvetica-Bold", 20)
    pdf.setFillColor(colors.HexColor("#1e40af"))
    pdf.drawString(20 * mm, height - 20 * mm, "Mess Operations")

    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(colors.black)
    pdf.drawString(20 * mm, height - 28 * mm, "Monthly Billing Statement")

    # Top line
    pdf.setStrokeColor(colors.HexColor("#93c5fd"))
    pdf.setLineWidth(1)
    pdf.line(20 * mm, height - 32 * mm, 190 * mm, height - 32 * mm)

    # Bill information
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

    # User information
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

    # Summary card
    y -= 18 * mm
    pdf.setFillColor(colors.HexColor("#eff6ff"))
    pdf.roundRect(20 * mm, y - 30 * mm, 170 * mm, 35 * mm, 4 * mm, fill=1, stroke=0)

    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(25 * mm, y, "Billing Summary")

    pdf.setFont("Helvetica", 11)
    pdf.drawString(25 * mm, y - 8 * mm, f"Total Meals: {bill.total_meals}")
    pdf.drawString(25 * mm, y - 16 * mm, f"Per Meal Cost: Rs. {float(bill.per_meal_cost or 0):.2f}")
    pdf.drawString(25 * mm, y - 24 * mm, f"Total Amount: Rs. {float(bill.total_amount or 0):.2f}")

    # Footer
    pdf.setStrokeColor(colors.HexColor("#cbd5e1"))
    pdf.line(20 * mm, 20 * mm, 190 * mm, 20 * mm)

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.grey)
    pdf.drawString(20 * mm, 14 * mm, "This is a system-generated bill from Mess Operations.")

    pdf.showPage()
    pdf.save()

    buffer.seek(0)
    return buffer