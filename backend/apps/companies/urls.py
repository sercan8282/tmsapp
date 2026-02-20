from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyViewSet, MailingListContactViewSet

router = DefaultRouter()
router.register(r'mailing-contacts', MailingListContactViewSet, basename='mailing-contacts')
router.register(r'', CompanyViewSet, basename='companies')

urlpatterns = [
    path('', include(router.urls)),
]
