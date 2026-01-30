import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count, Q

from .models import TimeEntry, TimeEntryStatus
from .serializers import TimeEntrySerializer

logger = logging.getLogger('accounts.security')


class TimeEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for TimeEntry CRUD operations.
    - Users can only see/edit their own entries
    - Admins can see all entries
    - Submitted entries cannot be edited by users (only admins)
    """
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'weeknummer', 'ritnummer', 'datum']
    search_fields = ['ritnummer', 'kenteken', 'user__voornaam', 'user__achternaam', 'user__email']
    ordering_fields = ['datum', 'weeknummer', 'created_at']
    ordering = ['-datum', '-aanvang']
    
    def get_queryset(self):
        user = self.request.user
        queryset = TimeEntry.objects.select_related('user')
        
        # Admins and managers see all, others see only their own
        if user.is_superuser or user.rol in ['admin', 'gebruiker']:
            # Optional filter by user
            user_filter = self.request.query_params.get('user')
            if user_filter:
                queryset = queryset.filter(user_id=user_filter)
        else:
            # Chauffeurs only see their own
            queryset = queryset.filter(user=user)
        
        # Filter by year if provided
        jaar = self.request.query_params.get('jaar')
        if jaar:
            queryset = queryset.filter(datum__year=int(jaar))
        
        return queryset
    
    def perform_create(self, serializer):
        entry = serializer.save(user=self.request.user)
        logger.info(
            f"TimeEntry created: {entry.ritnummer} on {entry.datum} by {self.request.user.email}"
        )
    
    def perform_update(self, serializer):
        instance = self.get_object()
        
        # Only admins can edit submitted entries
        if instance.status == TimeEntryStatus.INGEDIEND:
            if not (self.request.user.is_superuser or self.request.user.rol == 'admin'):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Ingediende uren kunnen alleen door een admin worden aangepast.')
        
        # Users can only edit their own entries
        if instance.user != self.request.user:
            if not (self.request.user.is_superuser or self.request.user.rol in ['admin', 'gebruiker']):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Je kunt alleen je eigen uren bewerken.')
        
        entry = serializer.save()
        logger.info(
            f"TimeEntry updated: {entry.ritnummer} on {entry.datum} by {self.request.user.email}"
        )
    
    def perform_destroy(self, instance):
        # Only admins can delete submitted entries
        if instance.status == TimeEntryStatus.INGEDIEND:
            if not (self.request.user.is_superuser or self.request.user.rol == 'admin'):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Ingediende uren kunnen alleen door een admin worden verwijderd.')
        
        # Users can only delete their own entries
        if instance.user != self.request.user:
            if not (self.request.user.is_superuser or self.request.user.rol in ['admin', 'gebruiker']):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Je kunt alleen je eigen uren verwijderen.')
        
        logger.warning(
            f"TimeEntry deleted: {instance.ritnummer} on {instance.datum} by {self.request.user.email}"
        )
        instance.delete()
    
    @action(detail=False, methods=['post'])
    def submit_week(self, request):
        """Submit all concept entries for a specific week."""
        weeknummer = request.data.get('weeknummer')
        jaar = request.data.get('jaar')
        
        if not weeknummer:
            return Response({'error': 'Weeknummer is verplicht.'}, status=status.HTTP_400_BAD_REQUEST)
        
        entries = TimeEntry.objects.filter(
            user=request.user,
            weeknummer=weeknummer,
            status=TimeEntryStatus.CONCEPT
        )
        
        if jaar:
            entries = entries.filter(datum__year=int(jaar))
        
        if not entries.exists():
            return Response(
                {'error': 'Geen concept uren gevonden voor deze week.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        count = entries.update(status=TimeEntryStatus.INGEDIEND)
        
        logger.info(
            f"Week {weeknummer} submitted: {count} entries by {request.user.email}"
        )
        
        # Calculate and add overtime to leave balance
        overtime_added = None
        try:
            from apps.leave.signals import update_user_overtime
            jaar_int = int(jaar) if jaar else entries.first().datum.year
            overtime = update_user_overtime(request.user, weeknummer, jaar_int)
            if overtime > 0:
                overtime_added = str(overtime)
                logger.info(f"Overtime added: {overtime}h for {request.user.email}")
        except Exception as e:
            logger.warning(f"Could not calculate overtime: {e}")
        
        response_data = {
            'message': f'{count} uren ingediend voor week {weeknummer}.',
            'count': count
        }
        if overtime_added:
            response_data['overtime_added'] = overtime_added
        
        return Response(response_data)
    
    @action(detail=False, methods=['get'])
    def week_summary(self, request):
        """Get summary for a specific week."""
        weeknummer = request.query_params.get('weeknummer')
        jaar = request.query_params.get('jaar')
        user_id = request.query_params.get('user')
        
        if not weeknummer:
            return Response({'error': 'Weeknummer is verplicht.'}, status=status.HTTP_400_BAD_REQUEST)
        
        queryset = TimeEntry.objects.filter(weeknummer=weeknummer)
        
        if jaar:
            queryset = queryset.filter(datum__year=int(jaar))
        
        # Filter by user based on permissions
        if request.user.is_superuser or request.user.rol in ['admin', 'gebruiker']:
            if user_id:
                queryset = queryset.filter(user_id=user_id)
        else:
            queryset = queryset.filter(user=request.user)
        
        # Calculate totals
        from datetime import timedelta
        entries = list(queryset)
        
        totaal_km = sum(e.totaal_km for e in entries)
        totaal_uren = sum((e.totaal_uren for e in entries), timedelta())
        
        # Format hours
        total_seconds = int(totaal_uren.total_seconds())
        hours, remainder = divmod(total_seconds, 3600)
        minutes, _ = divmod(remainder, 60)
        
        concept_count = sum(1 for e in entries if e.status == TimeEntryStatus.CONCEPT)
        ingediend_count = sum(1 for e in entries if e.status == TimeEntryStatus.INGEDIEND)
        
        return Response({
            'weeknummer': weeknummer,
            'totaal_entries': len(entries),
            'concept_count': concept_count,
            'ingediend_count': ingediend_count,
            'totaal_km': totaal_km,
            'totaal_uren': f"{hours}:{minutes:02d}",
            'kan_indienen': concept_count > 0,
        })
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get history grouped by week."""
        user = request.user
        
        queryset = TimeEntry.objects.all()
        
        # Filter based on permissions
        if not (user.is_superuser or user.rol in ['admin', 'gebruiker']):
            queryset = queryset.filter(user=user)
        
        # Optional user filter for admins
        user_filter = request.query_params.get('user')
        if user_filter and (user.is_superuser or user.rol in ['admin', 'gebruiker']):
            queryset = queryset.filter(user_id=user_filter)
        
        # Group by week and year
        from django.db.models.functions import ExtractYear
        weeks = queryset.annotate(
            jaar=ExtractYear('datum')
        ).values('weeknummer', 'jaar', 'user__voornaam', 'user__achternaam', 'user_id').annotate(
            totaal_km=Sum('totaal_km'),
            entries_count=Count('id'),
            concept_count=Count('id', filter=Q(status=TimeEntryStatus.CONCEPT)),
            ingediend_count=Count('id', filter=Q(status=TimeEntryStatus.INGEDIEND)),
        ).order_by('-jaar', '-weeknummer')
        
        return Response(list(weeks))
