import logging
from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from apps.core.permissions import IsAdminOrManager
from .models import Vehicle
from .serializers import VehicleSerializer

logger = logging.getLogger('accounts.security')


class VehicleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Vehicle/Fleet CRUD operations.
    - Admin/Gebruiker: Full CRUD access
    - Chauffeur: Read-only access
    """
    queryset = Vehicle.objects.select_related('bedrijf').all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    search_fields = ['kenteken', 'ritnummer', 'type_wagen']
    filterset_fields = ['bedrijf', 'type_wagen']
    ordering_fields = ['kenteken', 'type_wagen', 'created_at']
    ordering = ['kenteken']
    
    def perform_create(self, serializer):
        vehicle = serializer.save()
        logger.info(
            f"Vehicle created: {vehicle.kenteken} (ID: {vehicle.id}) by {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        vehicle = serializer.save()
        logger.info(
            f"Vehicle updated: {vehicle.kenteken} (ID: {vehicle.id}) by {self.request.user.email}"
        )
    
    def perform_destroy(self, instance):
        logger.warning(
            f"Vehicle deleted: {instance.kenteken} (ID: {instance.id}) by {self.request.user.email}"
        )
        instance.delete()

    @action(detail=False, methods=['get'], url_path='vehicle_weeks_overview')
    def vehicle_weeks_overview(self, request):
        """
        Overview of worked days per vehicle vs minimum days.
        Minimum days = minimum_weken_per_jaar * 5 (working days per week).
        Only vehicles with minimum_weken_per_jaar set are included.
        
        Groups by ritnummer: if multiple vehicles share the same ritnummer
        (e.g. old vehicle replaced by new one), their worked days are combined.
        The displayed vehicle info comes from the most recently created vehicle.
        """
        from apps.timetracking.models import TimeEntry, TimeEntryStatus
        
        jaar = int(request.query_params.get('jaar', date.today().year))
        
        # Get vehicles that have minimum weeks configured
        vehicles = Vehicle.objects.select_related('bedrijf').filter(
            minimum_weken_per_jaar__isnull=False
        ).order_by('kenteken')
        
        # Group vehicles by ritnummer for combining worked days
        ritnummer_groups = {}
        for vehicle in vehicles:
            rit = vehicle.ritnummer.strip() if vehicle.ritnummer else ''
            if not rit:
                # No ritnummer — treat as standalone vehicle
                rit = f"__vehicle_{vehicle.id}"
            
            if rit not in ritnummer_groups:
                ritnummer_groups[rit] = {
                    'vehicles': [],
                    'kentekens': [],
                    # Use the most recently created vehicle for display info
                    'display_vehicle': vehicle,
                    'minimum_weken': vehicle.minimum_weken_per_jaar,
                }
            
            ritnummer_groups[rit]['vehicles'].append(vehicle)
            ritnummer_groups[rit]['kentekens'].append(vehicle.kenteken)
            
            # Use the latest vehicle for display info and minimum_weken
            if vehicle.created_at > ritnummer_groups[rit]['display_vehicle'].created_at:
                ritnummer_groups[rit]['display_vehicle'] = vehicle
                ritnummer_groups[rit]['minimum_weken'] = vehicle.minimum_weken_per_jaar
        
        results = []
        for rit_key, group in ritnummer_groups.items():
            # Count distinct days where ANY of the kentekens for this ritnummer has time entries
            all_kentekens = group['kentekens']
            worked_days = TimeEntry.objects.filter(
                kenteken__in=all_kentekens,
                datum__year=jaar,
                status=TimeEntryStatus.INGEDIEND,
            ).values('datum').distinct().count()
            
            display_v = group['display_vehicle']
            minimum_weken = group['minimum_weken']
            minimum_dagen = minimum_weken * 5
            gemiste_dagen = max(0, minimum_dagen - worked_days)
            gewerkte_weken_decimal = round(worked_days / 5, 1)
            percentage = round((worked_days / minimum_dagen) * 100, 1) if minimum_dagen > 0 else 100
            
            results.append({
                'vehicle_id': str(display_v.id),
                'kenteken': display_v.kenteken,
                'type_wagen': display_v.type_wagen,
                'ritnummer': display_v.ritnummer,
                'bedrijf_naam': display_v.bedrijf.naam if display_v.bedrijf else '',
                'minimum_weken': minimum_weken,
                'minimum_dagen': minimum_dagen,
                'gewerkte_dagen': worked_days,
                'gemiste_dagen': gemiste_dagen,
                'gewerkte_weken_decimal': gewerkte_weken_decimal,
                'percentage': min(percentage, 100),
            })
        
        return Response(results)
