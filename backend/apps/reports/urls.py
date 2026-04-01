"""URL patterns for the reports agent."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ReportRequestViewSet
from .sql_views import sql_schema, sql_execute, sql_export

router = DefaultRouter()
router.register(r'requests', ReportRequestViewSet, basename='report-request')

urlpatterns = [
    path('sql/schema/', sql_schema, name='sql-schema'),
    path('sql/execute/', sql_execute, name='sql-execute'),
    path('sql/export/', sql_export, name='sql-export'),
    path('', include(router.urls)),
]
