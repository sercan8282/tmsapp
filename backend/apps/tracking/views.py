"""
Track & Trace API views.

Security architecture:
- All endpoints require JWT authentication
- Location submission: only authenticated drivers can submit their own location
- Live view: admin/manager can see all, drivers see only their own
- Route history: admin/manager can see all, drivers see only their own
- Rate limiting on all endpoints
- Input validation + anomaly detection
- Audit logging for session start/stop
"""
import logging
from django.utils import timezone
from django.db.models import Prefetch, Subquery, OuterRef
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminOrManager
from .models import TrackingSession, LocationPoint
from .serializers import (
    TrackingSessionCreateSerializer,
    TrackingSessionSerializer,
    LocationPointCreateSerializer,
    LocationPointBatchSerializer,
    LocationPointSerializer,
    LiveVehicleSerializer,
)
from .security import (
    TrackingSubmitThrottle,
    TrackingReadThrottle,
    detect_teleportation,
    validate_location_bounds,
    get_client_ip,
    calculate_route_distance,
)

logger = logging.getLogger('tracking')


class TrackingSessionView(APIView):
    """
    Start/stop tracking sessions.
    
    POST: Start a new tracking session
    DELETE: Stop the current active session
    GET: Get the current user's active session
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [TrackingReadThrottle]

    def get(self, request):
        """Get the current user's active tracking session."""
        session = TrackingSession.objects.filter(
            user=request.user, is_active=True
        ).select_related('vehicle').first()
        
        if session:
            serializer = TrackingSessionSerializer(session)
            return Response(serializer.data)
        return Response({'active': False}, status=status.HTTP_200_OK)

    def post(self, request):
        """Start a new tracking session."""
        # End any existing active sessions for this user
        TrackingSession.objects.filter(
            user=request.user, is_active=True
        ).update(is_active=False, ended_at=timezone.now())
        
        serializer = TrackingSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        vehicle_id = serializer.validated_data.get('vehicle_id')
        vehicle = None
        if vehicle_id:
            from apps.fleet.models import Vehicle
            vehicle = Vehicle.objects.filter(id=vehicle_id).first()
        
        # Auto-detect vehicle from driver profile
        if not vehicle and hasattr(request.user, 'driver_profile'):
            driver = request.user.driver_profile
            if driver and driver.voertuig:
                vehicle = driver.voertuig

        session = TrackingSession.objects.create(
            user=request.user,
            vehicle=vehicle,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            ip_address=get_client_ip(request),
        )
        
        logger.info(
            f"Tracking session started: user={request.user.username}, "
            f"session={session.id}, vehicle={vehicle}"
        )
        
        result = TrackingSessionSerializer(session)
        return Response(result.data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        """Stop the current user's active tracking session."""
        updated = TrackingSession.objects.filter(
            user=request.user, is_active=True
        ).update(is_active=False, ended_at=timezone.now())
        
        if updated:
            logger.info(f"Tracking session stopped: user={request.user.username}")
            return Response({'stopped': True})
        return Response(
            {'detail': 'No active session found.'},
            status=status.HTTP_404_NOT_FOUND,
        )


class LocationSubmitView(APIView):
    """
    Submit GPS location points.
    
    POST: Submit a single location point or batch of points.
    
    Security:
    - Authenticated users only
    - User must have an active tracking session
    - Coordinates validated for realistic ranges
    - Anomaly detection (teleportation check)
    - Rate limited to prevent spam
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [TrackingSubmitThrottle]

    def post(self, request):
        """Submit location point(s)."""
        session = TrackingSession.objects.filter(
            user=request.user, is_active=True
        ).first()
        
        if not session:
            return Response(
                {'detail': 'No active tracking session. Start one first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Check if it's a batch or single point
        is_batch = 'points' in request.data
        
        if is_batch:
            batch_serializer = LocationPointBatchSerializer(data=request.data)
            batch_serializer.is_valid(raise_exception=True)
            points_data = batch_serializer.validated_data['points']
        else:
            point_serializer = LocationPointCreateSerializer(data=request.data)
            point_serializer.is_valid(raise_exception=True)
            points_data = [point_serializer.validated_data]
        
        # Get the last known point for anomaly detection
        last_point = session.points.order_by('-recorded_at').first()
        
        created_points = []
        rejected_count = 0
        
        for point_data in points_data:
            lat = float(point_data['latitude'])
            lon = float(point_data['longitude'])
            
            # Security: validate location bounds
            if not validate_location_bounds(lat, lon):
                rejected_count += 1
                continue
            
            # Security: teleportation detection
            if last_point:
                is_teleport = detect_teleportation(
                    float(last_point.latitude), float(last_point.longitude),
                    last_point.recorded_at,
                    lat, lon, point_data['recorded_at'],
                )
                if is_teleport:
                    logger.warning(
                        f"Teleportation rejected: user={request.user.username}, "
                        f"session={session.id}"
                    )
                    rejected_count += 1
                    continue
            
            point = LocationPoint(
                session=session,
                latitude=point_data['latitude'],
                longitude=point_data['longitude'],
                accuracy=point_data.get('accuracy'),
                speed=point_data.get('speed'),
                heading=point_data.get('heading'),
                altitude=point_data.get('altitude'),
                recorded_at=point_data['recorded_at'],
            )
            created_points.append(point)
            last_point = point  # Use for next iteration's anomaly check
        
        # Bulk create for performance
        if created_points:
            LocationPoint.objects.bulk_create(created_points)
        
        return Response({
            'accepted': len(created_points),
            'rejected': rejected_count,
        }, status=status.HTTP_201_CREATED)


class LiveTrackingView(APIView):
    """
    Get real-time positions of all active tracking sessions.
    
    Admin/manager: see all active vehicles
    Chauffeur: see only own position
    
    Security:
    - Role-based data filtering
    - Minimal data exposure (no IP, user agent, etc.)
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [TrackingReadThrottle]

    def get(self, request):
        """Get all active vehicle positions."""
        user = request.user
        
        # Get active sessions with their latest point
        sessions_qs = TrackingSession.objects.filter(
            is_active=True
        ).select_related('vehicle', 'user', 'user__driver_profile')
        
        # Role-based filtering
        if user.rol == 'chauffeur':
            sessions_qs = sessions_qs.filter(user=user)
        
        results = []
        for session in sessions_qs:
            last_point = session.points.order_by('-recorded_at').first()
            if not last_point:
                continue
            
            # Get driver name
            user_name = ''
            if hasattr(session.user, 'driver_profile') and session.user.driver_profile:
                user_name = session.user.driver_profile.naam
            else:
                user_name = session.user.get_full_name() or session.user.username
            
            results.append({
                'session_id': session.id,
                'user_name': user_name,
                'vehicle_id': session.vehicle_id,
                'vehicle_kenteken': session.vehicle.kenteken if session.vehicle else None,
                'vehicle_ritnummer': session.vehicle.ritnummer if session.vehicle else None,
                'vehicle_type': session.vehicle.type_wagen if session.vehicle else None,
                'latitude': float(last_point.latitude),
                'longitude': float(last_point.longitude),
                'speed': last_point.speed,
                'heading': last_point.heading,
                'accuracy': last_point.accuracy,
                'recorded_at': last_point.recorded_at,
                'is_active': True,
                'vehicle_status': 'driving' if last_point.speed and last_point.speed > 3 else ('driving' if session.is_active else 'parked'),
            })
        
        serializer = LiveVehicleSerializer(results, many=True)
        return Response(serializer.data)


class RouteHistoryView(APIView):
    """
    Get route history for a specific session or date range.
    
    Admin/manager: access all sessions
    Chauffeur: access only own sessions
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [TrackingReadThrottle]

    def get(self, request, session_id=None):
        """Get route history for a session."""
        user = request.user
        
        if session_id:
            try:
                session = TrackingSession.objects.select_related(
                    'vehicle', 'user', 'user__driver_profile'
                ).get(id=session_id)
            except TrackingSession.DoesNotExist:
                return Response(
                    {'detail': 'Session not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            
            # Security: enforce ownership for chauffeurs
            if user.rol == 'chauffeur' and session.user_id != user.id:
                return Response(
                    {'detail': 'Not authorized.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            
            points = session.points.order_by('recorded_at')
            distance = calculate_route_distance(points)
            
            return Response({
                'session': TrackingSessionSerializer(session).data,
                'points': LocationPointSerializer(points, many=True).data,
                'total_points': points.count(),
                'distance_km': distance,
            })
        
        # List sessions (most recent first)
        sessions_qs = TrackingSession.objects.select_related(
            'vehicle', 'user', 'user__driver_profile'
        ).order_by('-started_at')
        
        if user.rol == 'chauffeur':
            sessions_qs = sessions_qs.filter(user=user)
        
        # Optional filters
        vehicle_id = request.query_params.get('vehicle')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if vehicle_id:
            sessions_qs = sessions_qs.filter(vehicle_id=vehicle_id)
        if date_from:
            sessions_qs = sessions_qs.filter(started_at__date__gte=date_from)
        if date_to:
            sessions_qs = sessions_qs.filter(started_at__date__lte=date_to)
        
        sessions_qs = sessions_qs[:50]  # Limit to 50 sessions
        
        serializer = TrackingSessionSerializer(sessions_qs, many=True)
        return Response(serializer.data)


class TrackingVehiclesView(APIView):
    """
    Get list of vehicles available for tracking assignment.
    Used in the vehicle monitor dropdown.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [TrackingReadThrottle]

    def get(self, request):
        """Get vehicles for tracking assignment."""
        try:
            from apps.fleet.models import Vehicle
            vehicles = Vehicle.objects.all().order_by('kenteken').values(
                'id', 'kenteken', 'type_wagen', 'ritnummer',
            )
            return Response(list(vehicles))
        except Exception as e:
            logger.error(f"Failed to load tracking vehicles: {e}")
            return Response([], status=status.HTTP_200_OK)


class AssignedVehicleView(APIView):
    """
    Get the vehicle assigned to the current logged-in driver.
    Returns the vehicle linked via Driver.voertuig → Driver.gekoppelde_gebruiker.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [TrackingReadThrottle]

    def get(self, request):
        """Get the assigned vehicle for the current user."""
        try:
            from apps.drivers.models import Driver
            driver = Driver.objects.select_related('voertuig').filter(
                gekoppelde_gebruiker=request.user
            ).first()

            if not driver or not driver.voertuig:
                return Response({'assigned': False}, status=status.HTTP_200_OK)

            vehicle = driver.voertuig
            return Response({
                'assigned': True,
                'vehicle': {
                    'id': str(vehicle.id),
                    'kenteken': vehicle.kenteken,
                    'type_wagen': vehicle.type_wagen,
                    'ritnummer': vehicle.ritnummer,
                },
                'driver_naam': driver.naam,
            })
        except Exception as e:
            logger.error(f"Failed to load assigned vehicle: {e}")
            return Response({'assigned': False}, status=status.HTTP_200_OK)


class TachographOverviewView(APIView):
    """
    GET /api/tracking/tachograph/?date=YYYY-MM-DD
    Returns tachograph trip data for all vehicles on the given date.
    """
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        from .tachograph_service import get_tachograph_overview, FMTrackError
        from datetime import date as date_type

        date_str = request.query_params.get('date')
        if not date_str:
            date_str = date_type.today().isoformat()

        # Validate date format
        try:
            from datetime import datetime
            datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return Response(
                {'error': 'Ongeldig datumformaat. Gebruik YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            data = get_tachograph_overview(date_str)
            return Response({'date': date_str, 'vehicles': data, 'count': len(data)})
        except FMTrackError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TachographOvertimeWriteView(APIView):
    """
    POST /api/tracking/tachograph/overtime/
    Write overtime hours from tachograph data to a driver.

    Body: {
        "driver_id": "<TMS driver UUID>",
        "date": "YYYY-MM-DD",
        "overtime_hours": 1.5,
        "vehicle_name": "99-BRD-5",
        "fm_driver_name": "Jan Scherpenisse"
    }
    """
    permission_classes = [IsAdminOrManager]

    def post(self, request):
        from apps.drivers.models import Driver
        from apps.tracking.models import TachographOvertime

        driver_id = request.data.get('driver_id')
        date_str = request.data.get('date')
        overtime_hours = request.data.get('overtime_hours')
        vehicle_name = request.data.get('vehicle_name', '')
        fm_driver_name = request.data.get('fm_driver_name', '')

        if not all([driver_id, date_str, overtime_hours]):
            return Response(
                {'error': 'driver_id, date en overtime_hours zijn verplicht.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            driver = Driver.objects.get(pk=driver_id)
        except Driver.DoesNotExist:
            return Response(
                {'error': 'Chauffeur niet gevonden.'},
                status=status.HTTP_404_NOT_FOUND
            )

        overtime, created = TachographOvertime.objects.update_or_create(
            driver=driver,
            date=date_str,
            defaults={
                'overtime_hours': overtime_hours,
                'vehicle_name': vehicle_name,
                'fm_driver_name': fm_driver_name,
                'created_by': request.user,
            }
        )

        return Response({
            'success': True,
            'created': created,
            'message': f'Overuren ({overtime_hours}u) {"aangemaakt" if created else "bijgewerkt"} voor {driver.naam}.',
            'id': str(overtime.id),
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class TachographOvertimeListView(APIView):
    """
    GET /api/tracking/tachograph/overtime/?driver_id=...&date_from=...&date_till=...
    List tachograph overtime records.
    """
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        from apps.tracking.models import TachographOvertime

        qs = TachographOvertime.objects.select_related('driver').order_by('-date')

        driver_id = request.query_params.get('driver_id')
        if driver_id:
            qs = qs.filter(driver_id=driver_id)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(date__gte=date_from)

        date_till = request.query_params.get('date_till')
        if date_till:
            qs = qs.filter(date__lte=date_till)

        records = []
        for ot in qs[:100]:
            records.append({
                'id': str(ot.id),
                'driver_id': str(ot.driver_id),
                'driver_naam': ot.driver.naam,
                'date': ot.date.isoformat(),
                'overtime_hours': float(ot.overtime_hours),
                'vehicle_name': ot.vehicle_name,
                'fm_driver_name': ot.fm_driver_name,
                'created_at': ot.created_at.isoformat(),
            })

        return Response({'results': records, 'count': len(records)})


class FMTrackPositionsView(APIView):
    """
    GET /api/tracking/fm-positions/
    Returns last known positions of all FM-Track vehicles.
    Matches FM-Track plate_number to TMS Vehicle kenteken for linking.
    """
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        from apps.tracking.tachograph_service import get_vehicle_locations, FMTrackError
        from apps.fleet.models import Vehicle

        try:
            positions = get_vehicle_locations()
        except FMTrackError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Build a lookup of TMS vehicles by kenteken for enrichment
        vehicle_lookup = {}
        for v in Vehicle.objects.all():
            if v.kenteken:
                vehicle_lookup[v.kenteken.upper().replace('-', '')] = {
                    'id': str(v.id),
                    'kenteken': v.kenteken,
                    'ritnummer': v.ritnummer,
                }

        # Enrich positions with TMS vehicle data
        for pos in positions:
            plate = (pos.get('plate_number') or '').upper().replace('-', '')
            tms_vehicle = vehicle_lookup.get(plate)
            if tms_vehicle:
                pos['tms_vehicle'] = tms_vehicle
            else:
                pos['tms_vehicle'] = None

        return Response({'positions': positions, 'count': len(positions)})


class TachographVehiclesListView(APIView):
    """
    GET /api/tracking/tachograph/vehicles/
    Returns a list of all FM-Track vehicle plate numbers.
    Used for the tacho_kenteken dropdown in driver settings.
    """
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        from apps.tracking.tachograph_service import get_objects, FMTrackError

        try:
            objects = get_objects()
        except FMTrackError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        vehicles = []
        for obj in objects:
            vehicle_params = obj.get('vehicle_params', {})
            plate = vehicle_params.get('plate_number') or obj.get('name', '')
            vehicles.append({
                'object_id': obj.get('id', ''),
                'name': obj.get('name', ''),
                'plate_number': plate,
                'make': vehicle_params.get('make', ''),
                'model': vehicle_params.get('model', ''),
            })

        vehicles.sort(key=lambda x: x['plate_number'])
        return Response({'vehicles': vehicles, 'count': len(vehicles)})


class TachographManualSyncView(APIView):
    """
    POST /api/tracking/tachograph/sync/
    Manually trigger the tachograph hours sync task.
    Returns the task result directly (synchronous).

    Pass {"force": true} to clear existing sync data and re-sync everything.
    """
    permission_classes = [IsAdminOrManager]

    def post(self, request):
        force = request.data.get('force', False)

        try:
            if force:
                from apps.tracking.tasks import force_resync_tachograph_hours
                result = force_resync_tachograph_hours()
            else:
                from apps.tracking.tasks import sync_tachograph_hours
                result = sync_tachograph_hours()
            return Response(result)
        except Exception as e:
            logger.exception('Manual tachograph sync failed')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VehicleDetailView(APIView):
    """
    GET /api/tracking/fm-positions/<object_id>/detail/?date=YYYY-MM-DD
    Returns detailed trip history for a specific FM-Track vehicle on a given date.
    Includes: current position, odometer, speed, trips with addresses, max speed per trip.
    """
    permission_classes = [IsAdminOrManager]

    def get(self, request, object_id):
        from datetime import datetime as dt, date as date_type
        from apps.tracking.tachograph_service import (
            get_trips, get_raw_data, get_objects, get_vehicle_locations, FMTrackError,
            _format_address, _format_duration,
        )

        date_str = request.query_params.get('date')
        if not date_str:
            date_str = date_type.today().isoformat()

        try:
            dt.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return Response(
                {'error': 'Ongeldig datumformaat. Gebruik YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_date = dt.strptime(date_str, '%Y-%m-%d').date()
        date_from = dt(target_date.year, target_date.month, target_date.day, 0, 0, 0)
        date_till = dt(target_date.year, target_date.month, target_date.day, 23, 59, 59)

        try:
            # Fetch trips for this vehicle on this date
            trips_raw = get_trips(object_id, date_from, date_till)

            # Filter to target date
            trips_filtered = []
            for trip in trips_raw:
                trip_start_dt = trip.get('trip_start', {}).get('datetime', '')
                if trip_start_dt and trip_start_dt[:10] == date_str:
                    trips_filtered.append(trip)

            # Get current live position for this vehicle
            current_position = None
            try:
                positions = get_vehicle_locations()
                for pos in positions:
                    if pos.get('object_id') == object_id:
                        current_position = pos
                        break
            except FMTrackError:
                pass

            # Get vehicle info from objects
            vehicle_info = None
            fuel_tank_capacity = 0
            avg_fuel_consumption = 0
            try:
                objects = get_objects()
                for obj in objects:
                    if obj.get('id') == object_id:
                        vp = obj.get('vehicle_params', {})
                        vehicle_info = {
                            'name': obj.get('name', ''),
                            'plate_number': vp.get('plate_number') or obj.get('name', ''),
                            'make': vp.get('make', ''),
                            'model': vp.get('model', ''),
                        }
                        fuel_tank_capacity = vp.get('fuel_tank_capacity') or 0
                        avg_fuel_consumption = vp.get('average_fuel_consumption') or 0
                        break
            except FMTrackError:
                pass

            # Build trip details
            trip_details = []
            fuel_chart_data = []
            total_distance = 0
            total_duration_seconds = 0
            max_speed_overall = 0

            for trip in trips_filtered:
                start_info = trip.get('trip_start', {})
                end_info = trip.get('trip_end', {})
                duration = trip.get('trip_duration', 0)
                total_duration_seconds += duration

                start_mileage = start_info.get('mileage', 0)
                end_mileage = end_info.get('mileage', 0)
                distance_km = round(trip.get('mileage', 0) / 1000, 1)
                total_distance += distance_km

                # FM-Track provides max_speed in trip data (m/s or km/h depending on API version)
                trip_max_speed = trip.get('max_speed', 0)
                # Convert from m/s to km/h if needed (FM-Track v1 uses km/h)
                if trip_max_speed > max_speed_overall:
                    max_speed_overall = trip_max_speed

                # Speed limit check: >130 km/h is considered speeding in NL
                is_speeding = trip_max_speed > 130

                # Fuel levels from trip start/end
                start_fuel = start_info.get('fuel_level', 0) or 0
                end_fuel = end_info.get('fuel_level', 0) or 0

                # Calculate fuel in liters
                start_fuel_liters = round(fuel_tank_capacity * start_fuel / 100, 1) if fuel_tank_capacity and start_fuel else None
                end_fuel_liters = round(fuel_tank_capacity * end_fuel / 100, 1) if fuel_tank_capacity and end_fuel else None

                trip_details.append({
                    'start_time': start_info.get('datetime', ''),
                    'end_time': end_info.get('datetime', ''),
                    'start_address': _format_address(start_info.get('address')),
                    'end_address': _format_address(end_info.get('address')),
                    'start_lat': start_info.get('latitude'),
                    'start_lng': start_info.get('longitude'),
                    'end_lat': end_info.get('latitude'),
                    'end_lng': end_info.get('longitude'),
                    'start_km': round(start_mileage / 1000, 1) if start_mileage else 0,
                    'end_km': round(end_mileage / 1000, 1) if end_mileage else 0,
                    'distance_km': distance_km,
                    'duration_seconds': duration,
                    'duration_display': _format_duration(duration),
                    'max_speed': round(trip_max_speed),
                    'is_speeding': is_speeding,
                    'start_fuel_level': round(start_fuel),
                    'end_fuel_level': round(end_fuel),
                    'fuel_used_liters': round(start_fuel_liters - end_fuel_liters, 1) if start_fuel_liters is not None and end_fuel_liters is not None else None,
                })

                # Build fuel chart data points (timestamp + fuel %)
                if start_fuel > 0 and start_info.get('datetime'):
                    fuel_chart_data.append({
                        'timestamp': start_info['datetime'],
                        'fuel_level': round(start_fuel),
                        'fuel_liters': start_fuel_liters,
                        'event': 'trip_start',
                    })
                if end_fuel > 0 and end_info.get('datetime'):
                    fuel_chart_data.append({
                        'timestamp': end_info['datetime'],
                        'fuel_level': round(end_fuel),
                        'fuel_liters': end_fuel_liters,
                        'event': 'trip_end',
                    })

            # Current odometer from last trip or position
            current_km = 0
            if trip_details:
                current_km = trip_details[-1]['end_km']
            elif current_position and current_position.get('mileage'):
                current_km = round(current_position['mileage'] / 1000, 1)

            # Fuel consumption stats
            total_fuel_used_liters = None
            total_fuel_used_pct = None
            avg_fuel_consumption = None  # L/100km
            avg_fuel_consumption_pct = None  # %/100km
            fuel_per_hour = None
            fuel_per_hour_pct = None
            if fuel_chart_data and len(fuel_chart_data) >= 2:
                first_fuel = fuel_chart_data[0].get('fuel_level', 0)
                last_fuel = fuel_chart_data[-1].get('fuel_level', 0)
                if first_fuel > 0:
                    fuel_diff_pct = max(0, first_fuel - last_fuel)
                    total_fuel_used_pct = round(fuel_diff_pct, 1)
                    if fuel_tank_capacity > 0:
                        total_fuel_used_liters = round(fuel_tank_capacity * fuel_diff_pct / 100, 1)
                    if total_distance > 0 and fuel_diff_pct > 0:
                        avg_fuel_consumption_pct = round(fuel_diff_pct / total_distance * 100, 1)
                        if fuel_tank_capacity > 0 and total_fuel_used_liters:
                            avg_fuel_consumption = round(total_fuel_used_liters / total_distance * 100, 1)
                    if total_duration_seconds > 0 and fuel_diff_pct > 0:
                        fuel_per_hour_pct = round(fuel_diff_pct / (total_duration_seconds / 3600), 1)
                        if fuel_tank_capacity > 0 and total_fuel_used_liters:
                            fuel_per_hour = round(total_fuel_used_liters / (total_duration_seconds / 3600), 1)

            # Remaining driving time (EU 561/2006: max 9h daily)
            max_daily_drive_seconds = 9 * 3600
            remaining_drive_seconds = max(0, max_daily_drive_seconds - total_duration_seconds)

            # Fetch GPS route track for the day (raw_data gives actual GPS points)
            route_coordinates = []
            if trips_filtered:
                try:
                    raw_points = get_raw_data(object_id, date_from, date_till)
                    for pt in raw_points:
                        lat = pt.get('latitude') or pt.get('lat')
                        lng = pt.get('longitude') or pt.get('lng') or pt.get('lon')
                        if lat and lng:
                            route_coordinates.append({
                                'lat': float(lat),
                                'lng': float(lng),
                                'speed': pt.get('speed', 0),
                                'timestamp': pt.get('datetime') or pt.get('timestamp', ''),
                            })
                except (FMTrackError, Exception) as e:
                    logger.warning('Failed to fetch raw GPS data for route: %s', e)
                    # Fallback: build route from trip start/end coordinates
                    for trip_d in trip_details:
                        if trip_d.get('start_lat') and trip_d.get('start_lng'):
                            route_coordinates.append({
                                'lat': float(trip_d['start_lat']),
                                'lng': float(trip_d['start_lng']),
                                'speed': 0,
                                'timestamp': trip_d.get('start_time', ''),
                            })
                        if trip_d.get('end_lat') and trip_d.get('end_lng'):
                            route_coordinates.append({
                                'lat': float(trip_d['end_lat']),
                                'lng': float(trip_d['end_lng']),
                                'speed': 0,
                                'timestamp': trip_d.get('end_time', ''),
                            })

            # Build current_position with smart speed
            cur_pos = None
            if current_position:
                live_speed = current_position.get('speed', 0) or 0
                vehicle_status = current_position.get('vehicle_status', 'parked')
                speed_source = 'live'

                # When live GPS speed is 0 but vehicle is driving (e.g. between
                # GPS polls, at traffic light), derive a useful speed value from
                # the most recent trip so the UI isn't contradictory.
                if live_speed == 0 and vehicle_status == 'driving' and trip_details:
                    last_trip = trips_filtered[-1] if trips_filtered else None
                    if last_trip:
                        # Use average speed from last trip
                        lt_dur = last_trip.get('trip_duration', 0)
                        lt_dist = last_trip.get('mileage', 0) / 1000  # m -> km
                        if lt_dur > 0 and lt_dist > 0:
                            live_speed = round(lt_dist / (lt_dur / 3600))
                            speed_source = 'trip_avg'

                # If still 0 but driving, fall back to day average
                if live_speed == 0 and vehicle_status == 'driving' and total_distance > 0 and total_duration_seconds > 0:
                    live_speed = round(total_distance / (total_duration_seconds / 3600))
                    speed_source = 'day_avg'

                cur_pos = {
                    'latitude': current_position.get('latitude'),
                    'longitude': current_position.get('longitude'),
                    'speed': live_speed,
                    'speed_source': speed_source,
                    'address': current_position.get('address', ''),
                    'vehicle_status': vehicle_status,
                    'fuel_level': current_position.get('fuel_level', 0),
                    'fuel_remaining_km': current_position.get('fuel_remaining_km'),
                    'heading': current_position.get('heading'),
                    'timestamp': current_position.get('timestamp', ''),
                }

            result = {
                'object_id': object_id,
                'date': date_str,
                'vehicle': vehicle_info,
                'current_position': cur_pos,
                'odometer_km': current_km,
                'total_distance_km': round(total_distance, 1),
                'total_duration_seconds': total_duration_seconds,
                'total_duration_display': _format_duration(total_duration_seconds),
                'max_speed': round(max_speed_overall),
                'trip_count': len(trip_details),
                'trips': trip_details,
                'fuel_tank_capacity': fuel_tank_capacity,
                'total_fuel_used_liters': total_fuel_used_liters,
                'total_fuel_used_pct': total_fuel_used_pct,
                'avg_fuel_consumption': avg_fuel_consumption,
                'avg_fuel_consumption_pct': avg_fuel_consumption_pct,
                'fuel_per_hour': fuel_per_hour,
                'fuel_per_hour_pct': fuel_per_hour_pct,
                'remaining_drive_seconds': remaining_drive_seconds,
                'remaining_drive_display': _format_duration(remaining_drive_seconds),
                'fuel_chart_data': fuel_chart_data,
                'route_coordinates': route_coordinates,
            }

            return Response(result)

        except FMTrackError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
