"""
Celery tasks for scheduled notifications.
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task
def process_scheduled_notifications():
    """
    Process and send scheduled notifications.
    This task should be run every minute via Celery Beat.
    """
    from .models import NotificationSchedule, ScheduleFrequency, WeekDay
    from .services import send_to_group
    
    now = timezone.now()
    current_time = now.time()
    current_weekday = now.weekday()  # 0 = Monday, 6 = Sunday
    
    # Get active schedules that are due
    schedules = NotificationSchedule.objects.filter(
        is_active=True,
        group__is_active=True,
    ).select_related('group')
    
    for schedule in schedules:
        should_send = False
        
        # Check if the time matches (within a 1-minute window)
        time_matches = (
            schedule.send_time.hour == current_time.hour and
            schedule.send_time.minute == current_time.minute
        )
        
        if not time_matches:
            continue
        
        # Check if already sent today
        if schedule.last_sent_at:
            last_sent_date = schedule.last_sent_at.date()
            if last_sent_date == now.date():
                continue  # Already sent today
        
        # Check frequency
        if schedule.frequency == ScheduleFrequency.DAILY:
            should_send = True
        
        elif schedule.frequency == ScheduleFrequency.WEEKDAYS:
            # Monday (0) to Friday (4)
            should_send = current_weekday <= 4
        
        elif schedule.frequency == ScheduleFrequency.WEEKEND:
            # Saturday (5) and Sunday (6)
            should_send = current_weekday >= 5
        
        elif schedule.frequency == ScheduleFrequency.WEEKLY:
            # Specific day of the week
            if schedule.weekly_day is not None:
                should_send = current_weekday == schedule.weekly_day
        
        elif schedule.frequency == ScheduleFrequency.CUSTOM:
            # Custom days list
            if schedule.custom_days:
                should_send = current_weekday in schedule.custom_days
        
        if should_send:
            try:
                result = send_to_group(
                    group=schedule.group,
                    title=schedule.title,
                    body=schedule.body,
                    icon=schedule.icon,
                    url=schedule.url,
                )
                
                # Update last sent time
                schedule.last_sent_at = now
                schedule.calculate_next_send()
                schedule.save(update_fields=['last_sent_at', 'next_send_at'])
                
                logger.info(
                    f"Scheduled notification sent: {schedule.title} to group {schedule.group.name}. "
                    f"Success: {result.get('success_count', 0)}, Failures: {result.get('failure_count', 0)}"
                )
            
            except Exception as e:
                logger.error(f"Error sending scheduled notification {schedule.id}: {str(e)}")


@shared_task
def update_next_send_times():
    """
    Update next_send_at for all active schedules.
    Run this daily to keep next_send_at accurate.
    """
    from .models import NotificationSchedule
    
    schedules = NotificationSchedule.objects.filter(is_active=True)
    updated_count = 0
    
    for schedule in schedules:
        try:
            schedule.calculate_next_send()
            schedule.save(update_fields=['next_send_at'])
            updated_count += 1
        except Exception as e:
            logger.error(f"Error updating next_send_at for schedule {schedule.id}: {str(e)}")
    
    logger.info(f"Updated next_send_at for {updated_count} schedules")
    return updated_count
