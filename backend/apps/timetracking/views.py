from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count

from .models import TimeEntry, TimeEntryStatus
from .serializers import TimeEntrySerializer


class TimeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'weeknummer', 'ritnummer']
    search_fields = ['ritnummer', 'kenteken']
    ordering_fields = ['datum', 'weeknummer']
    
    def get_queryset(self):
        user = self.request.user
        queryset = TimeEntry.objects.select_related('user')
        
        # Admins see all, others see only their own
        if not user.is_admin:
            queryset = queryset.filter(user=user)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def submit_week(self, request):
        """Submit all concept entries for a specific week."""
        weeknummer = request.data.get('weeknummer')
        if not weeknummer:
            return Response({'error': 'Weeknummer is verplicht.'}, status=status.HTTP_400_BAD_REQUEST)
        
        entries = TimeEntry.objects.filter(
            user=request.user,
            weeknummer=weeknummer,
            status=TimeEntryStatus.CONCEPT
        )
        
        count = entries.update(status=TimeEntryStatus.INGEDIEND)
        
        return Response({
            'message': f'{count} uren ingediend voor week {weeknummer}.',
            'count': count
        })
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get history grouped by week."""
        user = request.user if not request.user.is_admin else None
        
        queryset = TimeEntry.objects.filter(status=TimeEntryStatus.INGEDIEND)
        if user:
            queryset = queryset.filter(user=user)
        
        # Group by week
        weeks = queryset.values('weeknummer', 'user__voornaam', 'user__achternaam').annotate(
            totaal_km=Sum('totaal_km'),
            entries_count=Count('id')
        ).order_by('-weeknummer')
        
        return Response(list(weeks))
