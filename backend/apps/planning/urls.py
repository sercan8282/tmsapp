from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WeekPlanningViewSet, PlanningEntryViewSet

router = DefaultRouter()
router.register(r'weeks', WeekPlanningViewSet, basename='week-planning')
router.register(r'entries', PlanningEntryViewSet, basename='planning-entries')

urlpatterns = [
    path('', include(router.urls)),
]
