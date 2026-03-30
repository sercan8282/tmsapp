"""
Utility functions for managing system crontab entries for reminder jobs.

Uses subprocess to manage crontab entries for the current user.
"""
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile

logger = logging.getLogger(__name__)

# Unique comment identifier to find our cron entry
CRON_COMMENT = 'tmsapp_driver_reminders'


def _get_crontab_executable():
    """Find the crontab executable, checking common locations."""
    # First try PATH
    path = shutil.which('crontab')
    if path:
        return path
    # Fall back to common locations on Linux/macOS
    for candidate in ('/usr/bin/crontab', '/bin/crontab', '/usr/local/bin/crontab'):
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def _get_manage_py_path():
    """Get the absolute path to manage.py."""
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'manage.py'
    )


def _get_python_path():
    """Get the path to the current Python interpreter."""
    return sys.executable


def _get_current_crontab():
    """Get the current user's crontab entries."""
    crontab_exe = _get_crontab_executable()
    if not crontab_exe:
        logger.error('crontab executable not found on this system')
        return ''
    try:
        result = subprocess.run(
            [crontab_exe, '-l'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return result.stdout
        # Exit code 1 typically means "no crontab for user" – not an error
        stderr = result.stderr.strip()
        if stderr and 'no crontab for' not in stderr.lower():
            logger.warning('crontab -l returned rc=%d: %s', result.returncode, stderr)
        return ''
    except subprocess.TimeoutExpired:
        logger.error('crontab -l timed out')
        return ''
    except FileNotFoundError:
        logger.error('crontab executable not found: %s', crontab_exe)
        return ''


def _set_crontab(content):
    """Set the current user's crontab using a temporary file."""
    crontab_exe = _get_crontab_executable()
    if not crontab_exe:
        logger.error('crontab executable not found – cannot set crontab')
        return False
    tmpfile = None
    try:
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.crontab', delete=False
        ) as f:
            tmpfile = f.name
            f.write(content)
        result = subprocess.run(
            [crontab_exe, tmpfile],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            logger.error(
                'Failed to set crontab (rc=%d): %s',
                result.returncode,
                result.stderr.strip(),
            )
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        logger.error('crontab timed out while setting crontab')
        return False
    except FileNotFoundError:
        logger.error('crontab executable not found: %s', crontab_exe)
        return False
    except Exception as e:
        logger.error('Unexpected error setting crontab: %s', e)
        return False
    finally:
        if tmpfile and os.path.exists(tmpfile):
            try:
                os.unlink(tmpfile)
            except OSError:
                pass


def _remove_our_entry(crontab_content):
    """Remove our cron entry from crontab content."""
    lines = crontab_content.split('\n')
    filtered = [
        line for line in lines
        if CRON_COMMENT not in line
    ]
    return '\n'.join(filtered)


def build_cron_expression(settings):
    """
    Build a cron expression from reminder settings.

    Args:
        settings: AppSettings instance with reminder_* fields

    Returns:
        Cron expression string (e.g., '0 8 * * *')
    """
    reminder_time = getattr(settings, 'reminder_time', None)
    if reminder_time:
        minute = reminder_time.minute
        hour = reminder_time.hour
    else:
        minute = 0
        hour = 8

    frequency = getattr(settings, 'reminder_frequency', 'daily')

    if frequency == 'daily':
        dow = '*'
    elif frequency == 'weekdays':
        dow = '1-5'
    elif frequency == 'weekly':
        weekly_day = getattr(settings, 'reminder_weekly_day', 0)
        # Python weekday: 0=Monday..6=Sunday → cron: 0=Sunday, 1=Monday..6=Saturday
        cron_day = (weekly_day + 1) % 7
        dow = str(cron_day)
    elif frequency == 'custom':
        custom_days = getattr(settings, 'reminder_custom_days', [])
        if custom_days and isinstance(custom_days, list):
            cron_days = [(d + 1) % 7 for d in custom_days]
            dow = ','.join(str(d) for d in sorted(cron_days))
        else:
            dow = '*'
    else:
        dow = '*'

    return f'{minute} {hour} * * {dow}'


def build_cron_line(settings):
    """Build the full crontab line including the command."""
    expression = build_cron_expression(settings)
    python_path = _get_python_path()
    manage_path = _get_manage_py_path()

    # Use DJANGO_SETTINGS_MODULE from environment if available
    settings_module = os.environ.get('DJANGO_SETTINGS_MODULE', 'tms.settings.production')

    command = (
        f'{expression} '
        f'DJANGO_SETTINGS_MODULE={settings_module} '
        f'{python_path} {manage_path} send_driver_expiry_reminders '
        f'# {CRON_COMMENT}'
    )
    return command


def get_cron_status():
    """
    Check if our cron job exists and get its details.

    Returns:
        dict with 'active' (bool), 'expression' (str or None), 'next_run' description
    """
    crontab = _get_current_crontab()
    for line in crontab.split('\n'):
        if CRON_COMMENT in line and not line.strip().startswith('#'):
            # Extract the cron expression (first 5 fields)
            parts = line.strip().split()
            if len(parts) >= 5:
                expression = ' '.join(parts[:5])
                return {
                    'active': True,
                    'expression': expression,
                    'cron_line': line.strip(),
                }
    return {
        'active': False,
        'expression': None,
        'cron_line': None,
    }


def sync_cron_job(settings):
    """
    Create or update the cron job based on current reminder settings.

    If reminders are enabled, creates/updates the cron entry.
    If reminders are disabled, removes the cron entry.

    Args:
        settings: AppSettings instance

    Returns:
        dict with 'success' (bool), 'message' (str), 'status' dict
    """
    enabled = getattr(settings, 'reminder_enabled', False)
    crontab = _get_current_crontab()
    cleaned = _remove_our_entry(crontab)

    if not enabled:
        # Remove the cron job
        success = _set_crontab(cleaned)
        if success:
            return {
                'success': True,
                'message': 'Cron job verwijderd (herinneringen zijn uitgeschakeld).',
                'status': get_cron_status(),
            }
        crontab_exe = _get_crontab_executable()
        if crontab_exe:
            detail = 'Controleer de server logs voor meer details.'
        else:
            detail = 'crontab executable niet gevonden.'
        return {
            'success': False,
            'message': 'Kon de cron job niet verwijderen.',
            'detail': detail,
            'status': get_cron_status(),
        }

    # Build new cron line
    cron_line = build_cron_line(settings)

    # Add to crontab
    new_crontab = cleaned.rstrip('\n')
    if new_crontab:
        new_crontab += '\n'
    new_crontab += cron_line + '\n'

    success = _set_crontab(new_crontab)
    if success:
        return {
            'success': True,
            'message': 'Cron job succesvol aangemaakt/bijgewerkt.',
            'status': get_cron_status(),
        }
    crontab_exe = _get_crontab_executable()
    if crontab_exe:
        detail = (
            'Controleer de server logs voor meer details. '
            'Zorg dat de service gebruiker crontab-rechten heeft '
            '(niet vermeld in /etc/cron.deny, of opgenomen in /etc/cron.allow).'
        )
    else:
        detail = 'crontab executable niet gevonden.'
    return {
        'success': False,
        'message': 'Kon de cron job niet aanmaken. Controleer de server permissies.',
        'detail': detail,
        'status': get_cron_status(),
    }


def remove_cron_job():
    """
    Remove the reminder cron job.

    Returns:
        dict with 'success' (bool), 'message' (str)
    """
    crontab = _get_current_crontab()
    cleaned = _remove_our_entry(crontab)
    success = _set_crontab(cleaned)

    if success:
        return {
            'success': True,
            'message': 'Cron job succesvol verwijderd.',
        }
    return {
        'success': False,
        'message': 'Kon de cron job niet verwijderen.',
    }
