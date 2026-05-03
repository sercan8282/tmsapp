from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimeEntryViewSet, ImportBatchViewSet, TolRegistratieViewSet

router = DefaultRouter()
router.register(r'', TimeEntryViewSet, basename='time-entries')

import_router = DefaultRouter()
import_router.register(r'', ImportBatchViewSet, basename='import-batches')

tol_router = DefaultRouter()
tol_router.register(r'', TolRegistratieViewSet, basename='tol-registraties')

urlpatterns = [
    path('imports/', include(import_router.urls)),
    path('tol/', include(tol_router.urls)),
    path('', include(router.urls)),
]
