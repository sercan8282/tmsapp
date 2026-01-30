"""Leave app configuration."""
from django.apps import AppConfig


class LeaveConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.leave'
    verbose_name = 'Verlofbeheer'

    def ready(self):
        # Import signals when app is ready
        import apps.leave.signals  # noqa: F401
