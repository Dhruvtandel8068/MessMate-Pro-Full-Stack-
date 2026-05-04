MESS MATE PRO – MESS MANAGEMENT SYSTEM

---

PROJECT OVERVIEW
Mess Mate Pro is a full-stack web application designed to manage daily mess operations efficiently.
It automates tasks like user management, attendance tracking, billing, payments, inventory, and complaints.
The system replaces manual record-keeping with a centralized digital platform, improving accuracy and transparency.

---

FEATURES

* Authentication System (JWT-based login & role management)
* User Management (Admin CRUD operations)
* Dashboard (Overview of system data & analytics)
* Menu Management (Daily meal updates)
* Attendance Tracking (Meal-wise tracking)
* Billing System (Auto bill generation)
* Payment Management (Upload proof & admin approval)
* Inventory Management (Stock tracking)
* Complaint System (User feedback & issue resolution)
* Notifications (System alerts & updates)

---

TECH STACK

Frontend:

* React.js
* Vite
* Axios
* Bootstrap / CSS

Backend:

* Python Flask
* REST API
* JWT Authentication

Database:

* MySQL
* SQLAlchemy ORM

---

PROJECT STRUCTURE

Mess-Mate-Pro/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── App.jsx
│
├── backend/
│   ├── routes/
│   ├── models/
│   ├── controllers/
│   ├── config/
│   └── app.py
│
├── database/
└── README.txt

---

INSTALLATION & SETUP

1. Clone Repository
   git clone https://github.com/Dhruvtandel8068/MessMate-Pro-Full-Stack-
   cd mess-mate-pro

2. Setup Backend
   cd backend
   pip install -r requirements.txt
   python app.py

3. Setup Frontend
   cd frontend
   npm install
   npm run dev

---



USER ROLES

Admin:

* Manage users, menu, attendance, billing, inventory
* Approve payments and handle complaints

User:

* View menu, attendance, bills
* Make payments and raise complaints

---

WORKFLOW

1. User logs in or registers
2. System authenticates using JWT
3. Dashboard loads based on role
4. Users mark attendance and view bills
5. Admin manages data and generates reports
6. Payments and complaints are processed

---

FUTURE ENHANCEMENTS

* Mobile App Integration
* Online Payment Gateway (UPI / Razorpay)
* AI-based Meal Prediction
* Advanced Analytics Dashboard
* Multi-Mess Support

---

LICENSE

This project is for educational purposes only.

---

AUTHOR

Your Name
GitHub: https://github.com/Dhruvtandel8068

---
