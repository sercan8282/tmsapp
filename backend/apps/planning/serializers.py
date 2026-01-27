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
        fields = '__all__'
        read_only_fields = ['id', 'telefoon', 'adr', 'created_at', 'updated_at']


class WeekPlanningSerializer(serializers.ModelSerializer):
    entries = PlanningEntrySerializer(many=True, read_only=True)
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    
    class Meta:
        model = WeekPlanning
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class WeekPlanningCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeekPlanning
        fields = ['bedrijf', 'weeknummer', 'jaar']
