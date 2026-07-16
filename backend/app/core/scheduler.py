import logging
from datetime import date, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database.database import SessionLocal
from app.employees.models import Employee, EmployeeDesignationHistory
from app.notifications.service import notify_users, get_user_ids_with_permission

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def check_expiring_designations():
    """
    Nightly job to check for designations ending today or in exactly 3 days.
    Notifies HR/Admins with the 'employee:update' permission.
    """
    logger.info("[Scheduler] Running check_expiring_designations...")
    db = SessionLocal()
    try:
        today = date.today()
        in_3_days = today + timedelta(days=3)

        # Find active employees whose current designation ends today or in 3 days
        # We find active employees first, then join their active history
        expiring = db.query(Employee, EmployeeDesignationHistory).join(
            EmployeeDesignationHistory, 
            Employee.id == EmployeeDesignationHistory.employee_id
        ).filter(
            Employee.status == 'active',
            EmployeeDesignationHistory.end_date.in_([today, in_3_days])
        ).all()

        if not expiring:
            logger.info("[Scheduler] No expiring designations found today.")
            return

        # Get HR users to notify
        hr_user_ids = get_user_ids_with_permission(db, "employee:update")
        if not hr_user_ids:
            logger.warning("[Scheduler] Found expiring designations but no users have 'employee:update' permission to notify.")
            return

        for emp, hist in expiring:
            days_left = (hist.end_date - today).days
            when = "today" if days_left == 0 else f"in {days_left} days"
            
            message = (
                f"Reminder: {emp.first_name} {emp.last_name}'s "
                f"Designation Period ({hist.designation_name}) ends {when}. "
                f"Please review their profile."
            )

            notify_users(
                db,
                hr_user_ids,
                message,
                category="system",
                type="warning",
                link=f"/dashboard/EmployeeManagement/edit?id={emp.id}",
                entity_type="employee",
                entity_id=str(emp.id)
            )
            
            logger.info(f"[Scheduler] Notified HR about {emp.first_name} {emp.last_name} expiring {when}.")
        
        db.commit()

    except Exception as e:
        logger.error(f"[Scheduler] Failed to check expiring designations: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler instance and attach jobs."""
    if not scheduler.running:
        # Run every day at 00:05 AM
        scheduler.add_job(
            check_expiring_designations, 
            CronTrigger(hour=0, minute=5), 
            id="check_expiring_designations", 
            replace_existing=True
        )
        scheduler.start()
        logger.info("[Scheduler] APScheduler started.")

def shutdown_scheduler():
    """Gracefully shutdown the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[Scheduler] APScheduler shutdown.")
