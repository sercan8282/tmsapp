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


def recalculate_user_overtime(user):
    """
    Recalculate user's overtime balance from TachographOvertime records.

    This is idempotent - can be called multiple times safely.
    Uses daily overtime records (hours worked - uren_per_dag) as source of truth,
    minus any overtime already used in approved leave requests.
    """
    import logging
    from django.db.models import Sum
    from apps.tracking.models import TachographOvertime
    from apps.drivers.models import Driver
    from .models import LeaveBalance, LeaveRequest, LeaveType, LeaveRequestStatus

    logger = logging.getLogger(__name__)

    # Sum all daily overtime from tachograph records for this user's driver(s)
    drivers = Driver.objects.filter(gekoppelde_gebruiker=user)
    total_earned = TachographOvertime.objects.filter(
        driver__in=drivers
    ).aggregate(total=Sum('overtime_hours'))['total'] or Decimal('0')
    total_earned = Decimal(str(total_earned))

    # Sum all overtime already used in approved leave requests
    total_used = LeaveRequest.objects.filter(
        user=user,
        leave_type=LeaveType.OVERUREN,
        status=LeaveRequestStatus.APPROVED,
    ).aggregate(total=Sum('hours_requested'))['total'] or Decimal('0')

    # Set the balance
    balance, _ = LeaveBalance.objects.get_or_create(
        user=user,
        defaults={'vacation_hours': Decimal('216.00')}
    )
    new_overtime = max(Decimal('0'), total_earned - total_used)

    if balance.overtime_hours != new_overtime:
        old_overtime = balance.overtime_hours
        balance.overtime_hours = new_overtime
        balance.save(update_fields=['overtime_hours', 'updated_at'])
        logger.info(
            'Overuren herberekend voor %s: %s → %s (verdiend: %s, gebruikt: %s)',
            user.full_name, old_overtime, new_overtime, total_earned, total_used,
        )

    return new_overtime
