import logging
from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsAdminOrManager
from apps.fleet.models import Vehicle
from apps.drivers.models import Driver
from .models import WeekPlanning, PlanningEntry, Weekday
from .serializers import (
    WeekPlanningSerializer, 
    WeekPlanningCreateSerializer,
    PlanningEntrySerializer
)

logger = logging.getLogger('accounts.security')


class WeekPlanningViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor weekplanningen.
    
    Chauffeurs: alleen lezen
    Gebruikers/Admins: volledige CRUD
    """
    queryset = WeekPlanning.objects.select_related('bedrijf').prefetch_related(
        'entries__vehicle', 'entries__chauffeur'
    ).all()
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filterset_fields = ['bedrijf', 'weeknummer', 'jaar']
    ordering_fields = ['weeknummer', 'jaar']
    search_fields = ['bedrijf__naam']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return WeekPlanningCreateSerializer
        return WeekPlanningSerializer
    
    def perform_create(self, serializer):
        planning = serializer.save()
        
        # Auto-generate entries for all vehicles of the company
        vehicles = Vehicle.objects.filter(bedrijf=planning.bedrijf)
        days = [Weekday.MAANDAG, Weekday.DINSDAG, Weekday.WOENSDAG, Weekday.DONDERDAG, Weekday.VRIJDAG]
        
        entries = []
        for vehicle in vehicles:
            for day in days:
                entries.append(PlanningEntry(
                    planning=planning,
                    vehicle=vehicle,
                    dag=day
                ))
        
        PlanningEntry.objects.bulk_create(entries)
        
        # Audit log
        logger.info(
            f"WeekPlanning created: {planning.bedrijf.naam} Week {planning.weeknummer}/{planning.jaar} "
            f"by user {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        planning = serializer.save()
        logger.info(
            f"WeekPlanning updated: {planning.bedrijf.naam} Week {planning.weeknummer}/{planning.jaar} "
            f"by user {self.request.user.email}"
        )
    
    def perform_destroy(self, instance):
        planning_info = f"{instance.bedrijf.naam} Week {instance.weeknummer}/{instance.jaar}"
        instance.delete()
        logger.warning(
            f"WeekPlanning deleted: {planning_info} by user {self.request.user.email}"
        )
    
    @action(detail=False, methods=['get'])
    def current_week(self, request):
        """Get info for current week."""
        today = date.today()
        iso = today.isocalendar()
        return Response({
            'weeknummer': iso[1],
            'jaar': iso[0]
        })
    
    @action(detail=False, methods=['get'])
    def next_week(self, request):
        """Get info for next week."""
        today = date.today()
        iso = today.isocalendar()
        next_week = iso[1] + 1
        year = iso[0]
        
        # Handle year boundary (ISO week can be 52 or 53)
        if next_week > 52:
            # Check if there's a week 53 this year
            last_day = date(year, 12, 31)
            max_week = last_day.isocalendar()[1]
            if next_week > max_week:
                next_week = 1
                year += 1
        
        return Response({
            'weeknummer': next_week,
            'jaar': year
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_planning(self, request):
        """Get planning for the current logged-in driver (chauffeur role only)."""
        user = request.user
        
        # Get week and year from query params, default to current week
        today = date.today()
        iso = today.isocalendar()
        weeknummer = int(request.query_params.get('weeknummer', iso[1]))
        jaar = int(request.query_params.get('jaar', iso[0]))
        
        # Find the driver linked to this user
        try:
            driver = Driver.objects.get(gekoppelde_gebruiker=user)
        except Driver.DoesNotExist:
            return Response({
                'entries': [],
                'message': 'Je bent niet gekoppeld aan een chauffeursprofiel'
            })
        
        # Get planning entries for this driver
        entries = PlanningEntry.objects.filter(
            chauffeur=driver,
            planning__weeknummer=weeknummer,
            planning__jaar=jaar
        ).select_related('planning__bedrijf', 'vehicle').order_by('dag')
        
        # Build response with readable data
        result = []
        day_order = {'ma': 1, 'di': 2, 'wo': 3, 'do': 4, 'vr': 5}
        day_names = {'ma': 'Maandag', 'di': 'Dinsdag', 'wo': 'Woensdag', 'do': 'Donderdag', 'vr': 'Vrijdag'}
        
        for entry in entries:
            result.append({
                'id': str(entry.id),
                'dag': entry.dag,
                'dag_naam': day_names.get(entry.dag, entry.dag),
                'dag_order': day_order.get(entry.dag, 99),
                'kenteken': entry.vehicle.kenteken if entry.vehicle else '',
                'voertuig_type': entry.vehicle.type_wagen if entry.vehicle else '',
                'bedrijf': entry.planning.bedrijf.naam if entry.planning.bedrijf else '',
                'ritnummer': entry.ritnummer or '',
                'weeknummer': entry.planning.weeknummer,
                'jaar': entry.planning.jaar,
            })
        
        # Sort by day order
        result.sort(key=lambda x: x['dag_order'])
        
        return Response({
            'weeknummer': weeknummer,
            'jaar': jaar,
            'chauffeur': driver.naam,
            'entries': result
        })
    
    @action(detail=True, methods=['post'])
    def copy_to_next_week(self, request, pk=None):
        """Copy planning to next week."""
        source = self.get_object()
        
        # Calculate next week
        next_week = source.weeknummer + 1
        year = source.jaar
        if next_week > 52:
            next_week = 1
            year += 1
        
        # Check if target already exists
        if WeekPlanning.objects.filter(
            bedrijf=source.bedrijf, 
            weeknummer=next_week, 
            jaar=year
        ).exists():
            return Response(
                {'error': f'Planning voor week {next_week}/{year} bestaat al'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new planning
        new_planning = WeekPlanning.objects.create(
            bedrijf=source.bedrijf,
            weeknummer=next_week,
            jaar=year
        )
        
        # Copy entries
        for entry in source.entries.all():
            PlanningEntry.objects.create(
                planning=new_planning,
                vehicle=entry.vehicle,
                dag=entry.dag,
                chauffeur=entry.chauffeur,
                telefoon=entry.telefoon,
                adr=entry.adr
            )
        
        logger.info(
            f"WeekPlanning copied: {source.bedrijf.naam} Week {source.weeknummer}/{source.jaar} -> "
            f"Week {next_week}/{year} by user {request.user.email}"
        )
        
        serializer = self.get_serializer(new_planning)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PlanningEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet voor planningsregels.
    
    Chauffeurs: alleen lezen
    Gebruikers/Admins: volledige CRUD
    """
    queryset = PlanningEntry.objects.select_related(
        'planning__bedrijf', 'vehicle', 'chauffeur'
    ).all()
    serializer_class = PlanningEntrySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filterset_fields = ['planning', 'dag', 'chauffeur', 'vehicle']
    
    def perform_update(self, serializer):
        entry = serializer.save()
        
        # Auto-fill telefoon and adr from chauffeur
        if entry.chauffeur:
            entry.telefoon = entry.chauffeur.telefoon or ''
            entry.adr = entry.chauffeur.adr
            entry.save(update_fields=['telefoon', 'adr'])
        else:
            entry.telefoon = ''
            entry.adr = False
            entry.save(update_fields=['telefoon', 'adr'])
        
        logger.info(
            f"PlanningEntry updated: {entry.vehicle.kenteken} {entry.get_dag_display()} "
            f"-> {entry.chauffeur.naam if entry.chauffeur else 'leeg'} "
            f"by user {self.request.user.email}"
        )
