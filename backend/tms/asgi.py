"""
ASGI config for TMS project.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tms.settings.development')

application = get_asgi_application()
