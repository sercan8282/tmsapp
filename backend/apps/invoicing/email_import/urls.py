"""
Email Import URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MailboxConfigViewSet, EmailImportViewSet

router = DefaultRouter()
router.register(r'mailboxes', MailboxConfigViewSet, basename='mailbox-config')
router.register(r'imports', EmailImportViewSet, basename='email-import')

urlpatterns = [
    path('', include(router.urls)),
]
