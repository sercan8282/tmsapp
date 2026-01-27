import logging
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.core.permissions import IsAdminOrManager
from .models import Company
from .serializers import CompanySerializer

logger = logging.getLogger('accounts.security')


class CompanyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Company CRUD operations.
    - Admin/Gebruiker: Full CRUD access
    - Chauffeur: Read-only access
    """
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    search_fields = ['naam', 'kvk', 'contactpersoon', 'email']
    ordering_fields = ['naam', 'stad', 'created_at']
    ordering = ['naam']
    
    def perform_create(self, serializer):
        company = serializer.save()
        logger.info(
            f"Company created: {company.naam} (ID: {company.id}) by {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        company = serializer.save()
        logger.info(
            f"Company updated: {company.naam} (ID: {company.id}) by {self.request.user.email}"
        )
    
    def perform_destroy(self, instance):
        logger.warning(
            f"Company deleted: {instance.naam} (ID: {instance.id}) by {self.request.user.email}"
        )
        instance.delete()
