"""
Signals to automatically log activities.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import user_logged_in, user_logged_out

from .models import ActivityLog, ActivityType


def get_request_from_context():
    """Try to get the current request from thread local storage."""
    try:
        from django.utils.deprecation import MiddlewareMixin
        import threading
        _thread_locals = threading.local()
        return getattr(_thread_locals, 'request', None)
    except:
        return None


# ==================== Invoice Signals ====================
@receiver(post_save, sender='invoicing.Invoice')
def log_invoice_activity(sender, instance, created, **kwargs):
    """Log invoice creation and updates."""
    from apps.invoicing.models import Invoice
    
    if created:
        ActivityLog.log(
            user=instance.created_by,
            action=ActivityType.CREATED,
            entity_type='invoice',
            entity_id=instance.id,
            title=f"Factuur {instance.factuurnummer or 'concept'} aangemaakt",
            description=f"voor {instance.bedrijf.naam if instance.bedrijf else 'Onbekend'} - €{instance.totaal or 0:.2f}",
            link=f"/invoices/{instance.id}",
        )
    else:
        ActivityLog.log(
            user=instance.created_by,
            action=ActivityType.UPDATED,
            entity_type='invoice',
            entity_id=instance.id,
            title=f"Factuur {instance.factuurnummer or 'concept'} bijgewerkt",
            description=f"voor {instance.bedrijf.naam if instance.bedrijf else 'Onbekend'} - €{instance.totaal or 0:.2f}",
            link=f"/invoices/{instance.id}",
        )


# ==================== Planning Signals ====================
@receiver(post_save, sender='planning.WeekPlanning')
def log_planning_activity(sender, instance, created, **kwargs):
    """Log planning creation."""
    if created:
        ActivityLog.log(
            user=None,  # Planning often created via system
            action=ActivityType.CREATED,
            entity_type='planning',
            entity_id=instance.id,
            title=f"Planning W{instance.weeknummer}/{instance.jaar} aangemaakt",
            description=f"voor {instance.bedrijf.naam if instance.bedrijf else 'Onbekend'}",
            link=f"/planning?week={instance.weeknummer}&year={instance.jaar}",
        )


# ==================== Leave Request Signals ====================
@receiver(post_save, sender='leave.LeaveRequest')
def log_leave_activity(sender, instance, created, **kwargs):
    """Log leave request creation and status changes."""
    if created:
        ActivityLog.log(
            user=instance.user,
            action=ActivityType.SUBMITTED,
            entity_type='leave',
            entity_id=instance.id,
            title=f"Verlofaanvraag {instance.get_leave_type_display()}",
            description=f"van {instance.user.voornaam} {instance.user.achternaam}" if instance.user else '',
            link="/leave",
        )
    else:
        # Check if status changed
        if instance.status == 'approved':
            ActivityLog.log(
                user=instance.approved_by if hasattr(instance, 'approved_by') else None,
                action=ActivityType.APPROVED,
                entity_type='leave',
                entity_id=instance.id,
                title=f"Verlofaanvraag goedgekeurd",
                description=f"{instance.get_leave_type_display()} van {instance.user.voornaam} {instance.user.achternaam}" if instance.user else '',
                link="/leave",
            )
        elif instance.status == 'rejected':
            ActivityLog.log(
                user=instance.approved_by if hasattr(instance, 'approved_by') else None,
                action=ActivityType.REJECTED,
                entity_type='leave',
                entity_id=instance.id,
                title=f"Verlofaanvraag afgewezen",
                description=f"{instance.get_leave_type_display()} van {instance.user.voornaam} {instance.user.achternaam}" if instance.user else '',
                link="/leave",
            )


# ==================== User Signals ====================
@receiver(post_save, sender='accounts.User')
def log_user_activity(sender, instance, created, **kwargs):
    """Log user creation only (not updates to avoid noise from login/token refresh)."""
    if created:
        ActivityLog.log(
            user=None,  # Admin who created is not easily accessible
            action=ActivityType.CREATED,
            entity_type='user',
            entity_id=instance.id,
            title=f"Nieuwe gebruiker aangemaakt",
            description=f"{instance.voornaam} {instance.achternaam} ({instance.email})",
            link=f"/admin/users/{instance.id}",
        )
# ==================== Company Signals ====================
@receiver(post_save, sender='companies.Company')
def log_company_activity(sender, instance, created, **kwargs):
    """Log company creation and updates."""
    if created:
        ActivityLog.log(
            user=None,
            action=ActivityType.CREATED,
            entity_type='company',
            entity_id=instance.id,
            title=f"Nieuw bedrijf aangemaakt",
            description=instance.naam,
            link=f"/companies/{instance.id}",
        )
    else:
        ActivityLog.log(
            user=None,
            action=ActivityType.UPDATED,
            entity_type='company',
            entity_id=instance.id,
            title=f"Bedrijf bijgewerkt",
            description=instance.naam,
            link=f"/companies/{instance.id}",
        )


# ==================== Vehicle Signals ====================
@receiver(post_save, sender='fleet.Vehicle')
def log_vehicle_activity(sender, instance, created, **kwargs):
    """Log vehicle creation and updates."""
    if created:
        ActivityLog.log(
            user=None,
            action=ActivityType.CREATED,
            entity_type='vehicle',
            entity_id=instance.id,
            title=f"Nieuw voertuig toegevoegd",
            description=f"{instance.kenteken} - {instance.merk} {instance.model}" if hasattr(instance, 'merk') else instance.kenteken,
            link=f"/fleet/{instance.id}",
        )
    else:
        ActivityLog.log(
            user=None,
            action=ActivityType.UPDATED,
            entity_type='vehicle',
            entity_id=instance.id,
            title=f"Voertuig bijgewerkt",
            description=f"{instance.kenteken} - {instance.merk} {instance.model}" if hasattr(instance, 'merk') else instance.kenteken,
            link=f"/fleet/{instance.id}",
        )


# ==================== Driver Signals ====================
@receiver(post_save, sender='drivers.Driver')
def log_driver_activity(sender, instance, created, **kwargs):
    """Log driver creation and updates."""
    if created:
        ActivityLog.log(
            user=None,
            action=ActivityType.CREATED,
            entity_type='driver',
            entity_id=instance.id,
            title=f"Nieuwe chauffeur toegevoegd",
            description=instance.naam,
            link=f"/drivers/{instance.id}",
        )
    else:
        ActivityLog.log(
            user=None,
            action=ActivityType.UPDATED,
            entity_type='driver',
            entity_id=instance.id,
            title=f"Chauffeur bijgewerkt",
            description=instance.naam,
            link=f"/drivers/{instance.id}",
        )


# ==================== Time Entry Signals ====================
@receiver(post_save, sender='timetracking.TimeEntry')
def log_timeentry_activity(sender, instance, created, **kwargs):
    """Log time entry submission."""
    from apps.timetracking.models import TimeEntryStatus
    
    if not created and instance.status == TimeEntryStatus.INGEDIEND:
        ActivityLog.log(
            user=instance.user,
            action=ActivityType.SUBMITTED,
            entity_type='time_entry',
            entity_id=instance.id,
            title=f"Uren ingediend",
            description=f"Week {instance.weeknummer} - {instance.datum}",
            link="/time-entries",
        )


# ==================== Login/Logout Signals ====================
@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    """Log user login."""
    ActivityLog.log(
        user=user,
        action=ActivityType.LOGIN,
        entity_type='auth',
        entity_id=user.id,
        title=f"Ingelogd",
        description=f"{user.voornaam} {user.achternaam}",
        link="/dashboard",
        request=request,
    )


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    """Log user logout."""
    if user:
        ActivityLog.log(
            user=user,
            action=ActivityType.LOGOUT,
            entity_type='auth',
            entity_id=user.id,
            title=f"Uitgelogd",
            description=f"{user.voornaam} {user.achternaam}",
            link="/",
            request=request,
        )
