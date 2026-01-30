"""
Signals for leave management.
- Auto-create LeaveBalance when user is created
- Calculate overtime when TimeEntry is submitted
"""
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from .models import LeaveBalance, GlobalLeaveSettings


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_leave_balance(sender, instance, created, **kwargs):
    """
    Automatically create a LeaveBalance when a new user is created.
    """
    if created:
        # Get default hours from global settings
        try:
            global_settings = GlobalLeaveSettings.get_settings()
            default_hours = global_settings.default_leave_hours
        except Exception:
            default_hours = Decimal('216.00')
        
        LeaveBalance.objects.get_or_create(
            user=instance,
            defaults={'vacation_hours': default_hours}
        )


def calculate_overtime_for_week(user, weeknummer: int, jaar: int) -> Decimal:
    """
    Calculate overtime hours for a specific week.
    Returns positive number if overtime, negative if undertime.
    """
    from apps.timetracking.models import TimeEntry, TimeEntryStatus
    
    # Get all submitted entries for this week
    entries = TimeEntry.objects.filter(
        user=user,
        weeknummer=weeknummer,
        datum__year=jaar,
        status=TimeEntryStatus.INGEDIEND
    )
    
    # Sum total hours worked
    total_seconds = sum(
        (entry.totaal_uren.total_seconds() for entry in entries),
        0
    )
    total_hours = Decimal(str(total_seconds / 3600))
    
    # Get standard work week from settings
    try:
        global_settings = GlobalLeaveSettings.get_settings()
        standard_hours = global_settings.standard_work_week_hours
    except Exception:
        standard_hours = Decimal('40.00')
    
    # Calculate overtime (can be negative for undertime)
    overtime = total_hours - standard_hours
    
    return overtime


def update_user_overtime(user, weeknummer: int, jaar: int):
    """
    Update user's overtime balance based on submitted week.
    Only adds overtime if positive (worked more than standard week).
    """
    overtime = calculate_overtime_for_week(user, weeknummer, jaar)
    
    if overtime > 0:
        # Get or create leave balance
        balance, _ = LeaveBalance.objects.get_or_create(
            user=user,
            defaults={'vacation_hours': Decimal('216.00')}
        )
        balance.add_overtime(overtime)
        return overtime
    
    return Decimal('0')
