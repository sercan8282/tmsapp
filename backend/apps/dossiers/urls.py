"""URL configuration voor dossiers app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DossierTypeViewSet, DossierViewSet

router = DefaultRouter()
router.register(r'types', DossierTypeViewSet, basename='dossiertype')
router.register(r'', DossierViewSet, basename='dossier')

urlpatterns = [
    path('', include(router.urls)),
]
