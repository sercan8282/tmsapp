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
        
        # Admins and managers see ALL entries (including concept), others see only their own
        if user.is_superuser or user.rol in ['admin', 'gebruiker']:
            # Admins can see all entries (concept and submitted)
            # Filter by user if provided
            user_filter = self.request.query_params.get('user')
            status_filter = self.request.query_params.get('status')
            
            if user_filter:
                # If filtering by specific user, show all their entries
                queryset = queryset.filter(user_id=user_filter)
            
            # If explicit status filter, apply it
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            # No default filter - admins see all statuses
        else:
            # Chauffeurs only see their own (all statuses)
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
    def driver_report(self, request):
        """
        Get a driver's history report showing weeks and days with routes.
        Only accessible by admins.
        Returns a matrix of weeks x days with route information.
        """
        user = request.user
        
        # Security: Only admins can access this endpoint
        if not (user.is_superuser or user.rol == 'admin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Alleen admins hebben toegang tot deze functie.')
        
        driver_id = request.query_params.get('driver_id')
        if not driver_id:
            return Response({'error': 'driver_id is verplicht'}, status=400)
        
        # Get driver info
        from apps.accounts.models import User
        try:
            driver = User.objects.get(id=driver_id)
        except User.DoesNotExist:
            return Response({'error': 'Chauffeur niet gevonden'}, status=404)
        
        # Get all submitted entries for this driver
        entries = TimeEntry.objects.filter(
            user_id=driver_id,
            status=TimeEntryStatus.INGEDIEND
        ).order_by('-datum')
        
        # Group by week
        weeks_data = {}
        for entry in entries:
            jaar = entry.datum.year
            week = entry.weeknummer
            weekday = entry.datum.weekday()  # 0=Monday, 4=Friday
            
            week_key = f"{jaar}-W{week:02d}"
            
            if week_key not in weeks_data:
                weeks_data[week_key] = {
                    'jaar': jaar,
                    'weeknummer': week,
                    'dagen': {
                        'ma': [],
                        'di': [],
                        'wo': [],
                        'do': [],
                        'vr': [],
                        'za': [],
                        'zo': [],
                    }
                }
            
            day_map = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
            dag = day_map[weekday]
            
            weeks_data[week_key]['dagen'][dag].append({
                'ritnummer': entry.ritnummer,
                'kenteken': entry.kenteken,
                'km': entry.totaal_km,
                'uren': str(entry.totaal_uren) if entry.totaal_uren else '0:00',
            })
        
        # Sort weeks descending
        sorted_weeks = sorted(weeks_data.values(), key=lambda x: (x['jaar'], x['weeknummer']), reverse=True)
        
        return Response({
            'driver': {
                'id': str(driver.id),
                'naam': driver.full_name,
                'email': driver.email,
            },
            'weeks': sorted_weeks,
        })
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get history grouped by week."""
        user = request.user
        
        queryset = TimeEntry.objects.all()
        
        # Filter based on permissions
        if not (user.is_superuser or user.rol in ['admin', 'gebruiker']):
            # Chauffeurs see all their own entries
            queryset = queryset.filter(user=user)
        # Admins see ALL entries (including concept) - no status filter
        
        # Optional status filter
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
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

    @action(detail=False, methods=['get'], url_path='driver_report_years')
    def driver_report_years(self, request):
        """Get available years for driver report, limited to last 5 years from current year."""
        from apps.planning.models import PlanningEntry
        from datetime import date
        
        user = request.user
        if not (user.is_superuser or user.rol == 'admin'):
            return Response(
                {'error': 'Geen toegang'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        driver_id = request.query_params.get('driver_id')
        
        # Get years from planning entries
        entries_query = PlanningEntry.objects.all()
        if driver_id:
            entries_query = entries_query.filter(chauffeur_id=driver_id)
        
        years_from_db = list(
            entries_query.values_list('planning__jaar', flat=True)
            .distinct()
            .order_by('-planning__jaar')
        )
        
        # Filter to only last 5 years from current year
        current_year = date.today().year
        min_year = current_year - 4  # Current year + 4 previous = 5 years
        
        available_years = [y for y in years_from_db if y >= min_year and y <= current_year]
        
        # Sort descending (newest first)
        available_years = sorted(set(available_years), reverse=True)
        
        return Response({
            'years': available_years
        })

    @action(detail=False, methods=['get'], url_path='driver_report')
    def driver_report(self, request):
        """Get driver report: weeks with days showing ritnummer, kenteken, km, uren from planning entries."""
        user = request.user
        
        # Only admins can access this
        if not (user.is_superuser or user.rol == 'admin'):
            return Response(
                {'error': 'Geen toegang'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        driver_id = request.query_params.get('driver_id')
        if not driver_id:
            return Response(
                {'error': 'driver_id is verplicht'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get year filter (optional)
        jaar = request.query_params.get('jaar')
        
        # Get the driver
        from apps.drivers.models import Driver
        from apps.planning.models import PlanningEntry
        try:
            driver = Driver.objects.get(id=driver_id)
        except Driver.DoesNotExist:
            return Response(
                {'error': 'Chauffeur niet gevonden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all planning entries for this driver
        entries = PlanningEntry.objects.filter(
            chauffeur=driver
        ).select_related('planning', 'vehicle')
        
        # Apply year filter if provided
        if jaar:
            entries = entries.filter(planning__jaar=int(jaar))
        
        entries = entries.order_by('-planning__jaar', '-planning__weeknummer', 'dag')
        
        # Group by week
        from collections import defaultdict
        weeks_data = defaultdict(lambda: defaultdict(list))
        
        for entry in entries:
            week_key = f"{entry.planning.jaar}-{entry.planning.weeknummer:02d}"
            day_name = entry.dag  # Already 'ma', 'di', etc.
            
            weeks_data[week_key][day_name].append({
                'ritnummer': entry.ritnummer or entry.vehicle.ritnummer or '',
                'kenteken': entry.vehicle.kenteken or '',
                'km': 0,  # Not tracked in planning
                'uren': 0,  # Not tracked in planning
            })
        
        # Convert to list format
        weeks = []
        for week_key in sorted(weeks_data.keys(), reverse=True):
            year, week_num = week_key.split('-')
            week_entry = {
                'jaar': int(year),
                'weeknummer': int(week_num),
                'dagen': {
                    'ma': [],
                    'di': [],
                    'wo': [],
                    'do': [],
                    'vr': [],
                    'za': [],
                    'zo': [],
                }
            }
            for day in ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']:
                if day in weeks_data[week_key]:
                    week_entry['dagen'][day] = weeks_data[week_key][day]
            weeks.append(week_entry)
        
        return Response({
            'driver_id': str(driver_id),
            'driver_name': driver.naam,
            'weeks': weeks
        })

    @action(detail=False, methods=['get'], url_path='driver_report_pdf')
    def driver_report_pdf(self, request):
        """Generate PDF for driver history report."""
        import io
        from django.http import HttpResponse
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        
        user = request.user
        
        # Only admins can access this
        if not (user.is_superuser or user.rol == 'admin'):
            return Response(
                {'error': 'Geen toegang'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        driver_id = request.query_params.get('driver_id')
        if not driver_id:
            return Response(
                {'error': 'driver_id is verplicht'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the driver
        from apps.drivers.models import Driver
        from apps.planning.models import PlanningEntry
        try:
            driver = Driver.objects.get(id=driver_id)
        except Driver.DoesNotExist:
            return Response(
                {'error': 'Chauffeur niet gevonden'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all planning entries for this driver
        entries = PlanningEntry.objects.filter(
            chauffeur=driver
        ).select_related('planning', 'vehicle').order_by('-planning__jaar', '-planning__weeknummer', 'dag')
        
        # Group by week
        from collections import defaultdict
        weeks_data = defaultdict(lambda: defaultdict(list))
        
        for entry in entries:
            week_key = f"{entry.planning.jaar}-{entry.planning.weeknummer:02d}"
            day_name = entry.dag
            
            weeks_data[week_key][day_name].append({
                'ritnummer': entry.ritnummer or entry.vehicle.ritnummer or '',
                'kenteken': entry.vehicle.kenteken or '',
            })
        
        # Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=1*cm,
            rightMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=12
        )
        title = Paragraph(f"Chauffeur Historie: {driver.naam}", title_style)
        elements.append(title)
        elements.append(Spacer(1, 0.5*cm))
        
        # Table header
        day_headers = ['Week', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
        table_data = [day_headers]
        
        # Sort weeks
        for week_key in sorted(weeks_data.keys(), reverse=True):
            year, week_num = week_key.split('-')
            row = [f"W{int(week_num)} '{year[-2:]}"]
            
            for day in ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']:
                day_entries = weeks_data[week_key].get(day, [])
                if day_entries:
                    cell_text = '\n'.join([f"{e['ritnummer']} ({e['kenteken']})" for e in day_entries])
                else:
                    cell_text = '-'
                row.append(cell_text)
            
            table_data.append(row)
        
        if len(table_data) == 1:
            # No data
            elements.append(Paragraph("Geen ritten gevonden voor deze chauffeur.", styles['Normal']))
        else:
            # Create table
            col_widths = [2*cm] + [3.5*cm] * 7
            table = Table(table_data, colWidths=col_widths, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                ('TOPPADDING', (0, 1), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f7fa')]),
            ]))
            elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        
        # Return PDF response
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        safe_name = driver.naam.replace(' ', '_').replace('/', '-')
        filename = f"chauffeur_historie_{safe_name}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

