from apscheduler.schedulers.background import BackgroundScheduler

from app.services.auto_bill_service import run_auto_bill_for_previous_month

scheduler = BackgroundScheduler()
_scheduler_started = False


def auto_bill_job(app):
    with app.app_context():
        try:
            result = run_auto_bill_for_previous_month(
                window_days=app.config.get("AUTO_BILL_WINDOW_DAYS", 5)
            )
            print("AUTO BILL JOB RESULT:", result)
        except Exception as e:
            print("AUTO BILL JOB ERROR:", str(e))


def start_scheduler(app):
    global _scheduler_started

    if _scheduler_started:
        return

    if not app.config.get("AUTO_BILL_ENABLED", True):
        print("AUTO BILL SCHEDULER: Disabled from config")
        return

    scheduler.add_job(
        func=lambda: auto_bill_job(app),
        trigger="cron",
        hour=app.config.get("AUTO_BILL_RUN_HOUR", 2),
        minute=app.config.get("AUTO_BILL_RUN_MINUTE", 15),
        id="auto_bill_generation_job",
        replace_existing=True,
    )

    scheduler.start()
    _scheduler_started = True
    print(
        "AUTO BILL SCHEDULER STARTED AT "
        f"{app.config.get('AUTO_BILL_RUN_HOUR', 2):02d}:"
        f"{app.config.get('AUTO_BILL_RUN_MINUTE', 15):02d}"
    )