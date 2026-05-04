"""URL configuration voor dossiers app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DossierTypeViewSet, DossierViewSet, OrganisatieViewSet, ContactpersoonViewSet

router = DefaultRouter()
router.register(r'types', DossierTypeViewSet, basename='dossiertype')
router.register(r'organisaties', OrganisatieViewSet, basename='organisatie')
router.register(r'contactpersonen', ContactpersoonViewSet, basename='contactpersoon')
router.register(r'', DossierViewSet, basename='dossier')

urlpatterns = [
    path('', include(router.urls)),
]
