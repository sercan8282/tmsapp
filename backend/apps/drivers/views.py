from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Driver
from .serializers import DriverSerializer

class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related('bedrijf', 'gekoppelde_gebruiker').all()
    serializer_class = DriverSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['naam', 'telefoon']
    filterset_fields = ['bedrijf', 'adr']
    ordering_fields = ['naam']
