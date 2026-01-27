from datetime import date
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.fleet.models import Vehicle
from .models import WeekPlanning, PlanningEntry, Weekday
from .serializers import (
    WeekPlanningSerializer, 
    WeekPlanningCreateSerializer,
    PlanningEntrySerializer
)


class WeekPlanningViewSet(viewsets.ModelViewSet):
    queryset = WeekPlanning.objects.select_related('bedrijf').prefetch_related('entries').all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['bedrijf', 'weeknummer', 'jaar']
    ordering_fields = ['weeknummer', 'jaar']
    
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
    
    @action(detail=False, methods=['get'])
    def next_week(self, request):
        """Get info for next week."""
        today = date.today()
        next_week = today.isocalendar()[1] + 1
        year = today.year
        
        # Handle year boundary
        if next_week > 52:
            next_week = 1
            year += 1
        
        return Response({
            'weeknummer': next_week,
            'jaar': year
        })


class PlanningEntryViewSet(viewsets.ModelViewSet):
    queryset = PlanningEntry.objects.select_related('planning', 'vehicle', 'chauffeur').all()
    serializer_class = PlanningEntrySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['planning', 'dag', 'chauffeur']
