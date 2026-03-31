"""
Utility functions for managing driver expiry reminder task status.

The task runs on a fixed daily schedule via Celery Beat (defined in settings).
The management command itself checks reminder_enabled and frequency from
AppSettings, so enabling/disabling is controlled through the database.
"""
import logging

logger = logging.getLogger(__name__)

BEAT_SCHEDULE_KEY = 'send-driver-expiry-reminders'
TASK_NAME = 'apps.drivers.tasks.send_driver_expiry_reminders'

FREQUENCY_LABELS = {
    'daily': 'Dagelijks',
    'weekdays': 'Werkdagen (ma-vr)',
    'weekly': 'Wekelijks',
    'custom': 'Aangepast',
}

DAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']


def get_cron_status():
    """
    Check reminder task status based on AppSettings.
    """
    from apps.core.models import AppSettings

    settings = AppSettings.get_settings()
    enabled = getattr(settings, 'reminder_enabled', False)

    if not enabled:
        return {
            'active': False,
            'expression': None,
            'cron_line': None,
        }

    frequency = getattr(settings, 'reminder_frequency', 'daily')
    freq_label = FREQUENCY_LABELS.get(frequency, frequency)

    # Build description
    if frequency == 'weekly':
        weekly_day = getattr(settings, 'reminder_weekly_day', 0)
        day_name = DAY_LABELS[weekly_day] if 0 <= weekly_day <= 6 else str(weekly_day)
        description = f'{freq_label} ({day_name})'
    elif frequency == 'custom':
        custom_days = getattr(settings, 'reminder_custom_days', [])
        if custom_days and isinstance(custom_days, list):
            day_names = [DAY_LABELS[d] for d in sorted(custom_days) if 0 <= d <= 6]
            description = f'{freq_label} ({", ".join(day_names)})'
        else:
            description = freq_label
    else:
        description = freq_label

    return {
        'active': True,
        'expression': description,
        'cron_line': f'Celery Beat: elke dag om 08:00 — frequentie: {description}',
    }


def sync_cron_job(settings):
    """
    Validate and activate the reminder task.

    The task runs daily via Celery Beat. The management command checks
    reminder_enabled and _should_run_today() from AppSettings to decide
    whether to actually send reminders.

    Args:
        settings: AppSettings instance

    Returns:
        dict with 'success' (bool), 'message' (str), 'status' dict
    """
    enabled = getattr(settings, 'reminder_enabled', False)

    if not enabled:
        return {
            'success': True,
            'message': 'Herinneringen zijn uitgeschakeld. Schakel ze eerst in.',
            'status': get_cron_status(),
        }

    # Validate SMTP configuration
    if not settings.smtp_host:
        return {
            'success': False,
            'message': 'SMTP is niet geconfigureerd. Vul eerst de e-mail instellingen in.',
            'status': get_cron_status(),
        }

    admin_email = (
        getattr(settings, 'reminder_email', '') or
        settings.company_email or
        settings.smtp_from_email or
        settings.smtp_username
    )
    if not admin_email:
        return {
            'success': False,
            'message': 'Geen ontvanger e-mailadres geconfigureerd bij Instellingen > Herinneringen.',
            'status': get_cron_status(),
        }

    frequency = getattr(settings, 'reminder_frequency', 'daily')
    freq_label = FREQUENCY_LABELS.get(frequency, frequency)

    logger.info('Reminder task validated: enabled=%s, frequency=%s', enabled, frequency)

    return {
        'success': True,
        'message': f'Taakplanning actief. De taak draait dagelijks om 08:00 en verstuurt herinneringen op basis van frequentie: {freq_label}.',
        'status': get_cron_status(),
    }


def remove_cron_job():
    """
    Disable reminders by setting reminder_enabled to False.
    """
    from apps.core.models import AppSettings

    try:
        settings = AppSettings.get_settings()
        settings.reminder_enabled = False
        settings.save(update_fields=['reminder_enabled'])

        return {
            'success': True,
            'message': 'Herinneringen zijn uitgeschakeld.',
        }
    except Exception as e:
        logger.error('Failed to disable reminders: %s', e)
        return {
            'success': False,
            'message': 'Kon de herinneringen niet uitschakelen.',
        }
