from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Vehicle
from .serializers import VehicleSerializer

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.select_related('bedrijf').all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['kenteken', 'ritnummer', 'type_wagen']
    filterset_fields = ['bedrijf']
    ordering_fields = ['kenteken', 'type_wagen']
