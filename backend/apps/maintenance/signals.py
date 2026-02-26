"""
Signals for Fleet Maintenance Management.
Genereert automatisch waarschuwingen en updates.
"""
import logging
from datetime import date, timedelta

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import (
    APKRecord,
    MaintenanceTask,
    MaintenanceThreshold,
    MaintenanceAlert,
    MaintenanceStatus,
    AlertSeverity,
)

logger = logging.getLogger('accounts.security')


@receiver(post_save, sender=MaintenanceTask)
def check_maintenance_task_alerts(sender, instance, created, **kwargs):
    """Genereer waarschuwingen als taken te laat zijn."""
    if instance.status in [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED]:
        # Markeer gerelateerde alerts als opgelost
        MaintenanceAlert.objects.filter(
            maintenance_task=instance,
            is_resolved=False
        ).update(is_resolved=True)
        return

    if instance.is_overdue and created:
        # Zoek relevante thresholds
        thresholds = MaintenanceThreshold.objects.filter(
            is_active=True,
            maintenance_type=instance.maintenance_type
        )
        for threshold in thresholds:
            days_overdue = (date.today() - instance.scheduled_date).days
            severity = threshold.get_severity_for_days(-days_overdue)

            MaintenanceAlert.objects.get_or_create(
                vehicle=instance.vehicle,
                maintenance_task=instance,
                threshold=threshold,
                is_resolved=False,
                defaults={
                    'severity': severity,
                    'title': f'Onderhoud achterstallig: {instance.title}',
                    'message': (
                        f'{instance.maintenance_type.name} voor {instance.vehicle.kenteken} '
                        f'is {days_overdue} dagen te laat. '
                        f'Geplande datum: {instance.scheduled_date}.'
                    ),
                }
            )


@receiver(post_save, sender=APKRecord)
def check_apk_alerts(sender, instance, created, **kwargs):
    """Genereer waarschuwingen voor APK vervaldatums."""
    if not instance.is_current:
        return

    # Als er een vernieuwde APK is, sluit bestaande alerts
    if instance.passed and not instance.is_expired:
        MaintenanceAlert.objects.filter(
            vehicle=instance.vehicle,
            apk_record__isnull=False,
            is_resolved=False
        ).update(is_resolved=True)
        return

    # Controleer of er APK thresholds zijn
    thresholds = MaintenanceThreshold.objects.filter(
        is_active=True,
        is_apk_threshold=True
    )

    days_remaining = instance.days_until_expiry
    if days_remaining is None:
        return

    for threshold in thresholds:
        if days_remaining <= threshold.warning_days:
            severity = threshold.get_severity_for_days(days_remaining)

            MaintenanceAlert.objects.get_or_create(
                vehicle=instance.vehicle,
                apk_record=instance,
                threshold=threshold,
                is_resolved=False,
                defaults={
                    'severity': severity,
                    'title': f'APK verloopt binnenkort: {instance.vehicle.kenteken}',
                    'message': (
                        f'APK voor {instance.vehicle.kenteken} verloopt op {instance.expiry_date}. '
                        f'Nog {days_remaining} dagen resterend.'
                    ),
                }
            )
