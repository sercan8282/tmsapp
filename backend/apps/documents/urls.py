"""
URL configuration voor documenten app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SignedDocumentViewSet, SavedSignatureViewSet

router = DefaultRouter()
router.register(r'documents', SignedDocumentViewSet, basename='document')
router.register(r'signatures', SavedSignatureViewSet, basename='signature')

urlpatterns = [
    path('', include(router.urls)),
]
