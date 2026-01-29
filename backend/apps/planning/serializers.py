from rest_framework import serializers
from .models import WeekPlanning, PlanningEntry


class PlanningEntrySerializer(serializers.ModelSerializer):
    vehicle_kenteken = serializers.CharField(source='vehicle.kenteken', read_only=True)
    vehicle_type = serializers.CharField(source='vehicle.type_wagen', read_only=True)
    vehicle_ritnummer = serializers.CharField(source='vehicle.ritnummer', read_only=True)
    chauffeur_naam = serializers.CharField(source='chauffeur.naam', read_only=True)
    dag_display = serializers.CharField(source='get_dag_display', read_only=True)
    
    class Meta:
        model = PlanningEntry
        fields = [
            'id', 'planning', 'vehicle', 'dag', 'chauffeur',
            'vehicle_kenteken', 'vehicle_type', 'vehicle_ritnummer',
            'chauffeur_naam', 'dag_display', 'telefoon', 'adr',
            'ritnummer',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'planning', 'vehicle', 'dag',  # Prevent changing assignment
            'telefoon', 'adr',  # Auto-filled from chauffeur
            'created_at', 'updated_at'
        ]


class WeekPlanningSerializer(serializers.ModelSerializer):
    entries = PlanningEntrySerializer(many=True, read_only=True)
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    
    class Meta:
        model = WeekPlanning
        fields = [
            'id', 'bedrijf', 'bedrijf_naam', 'weeknummer', 'jaar',
            'entries', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'bedrijf', 'created_at', 'updated_at']


class WeekPlanningCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeekPlanning
        fields = ['bedrijf', 'weeknummer', 'jaar']
    
    def validate_weeknummer(self, value):
        if value < 1 or value > 53:
            raise serializers.ValidationError("Weeknummer moet tussen 1 en 53 zijn")
        return value
    
    def validate_jaar(self, value):
        from datetime import date
        current_year = date.today().year
        if value < current_year - 1 or value > current_year + 2:
            raise serializers.ValidationError(
                f"Jaar moet tussen {current_year - 1} en {current_year + 2} liggen"
            )
        return value
