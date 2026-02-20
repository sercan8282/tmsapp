from rest_framework import serializers
from .models import Spreadsheet


class SpreadsheetListSerializer(serializers.ModelSerializer):
    """Serializer for list view (lightweight)."""
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    created_by_naam = serializers.SerializerMethodField()

    class Meta:
        model = Spreadsheet
        fields = [
            'id', 'naam', 'bedrijf', 'bedrijf_naam',
            'week_nummer', 'jaar',
            'tarief_per_uur', 'tarief_per_km', 'tarief_dot',
            'totaal_factuur',
            'created_by', 'created_by_naam',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'totaal_factuur', 'created_by', 'created_at', 'updated_at']

    def get_created_by_naam(self, obj):
        if obj.created_by:
            return f"{obj.created_by.voornaam} {obj.created_by.achternaam}".strip() or obj.created_by.username
        return None


class SpreadsheetDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail/create/update view (includes rijen)."""
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    created_by_naam = serializers.SerializerMethodField()

    class Meta:
        model = Spreadsheet
        fields = [
            'id', 'naam', 'bedrijf', 'bedrijf_naam',
            'week_nummer', 'jaar',
            'tarief_per_uur', 'tarief_per_km', 'tarief_dot',
            'rijen', 'notities', 'totaal_factuur',
            'created_by', 'created_by_naam',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'totaal_factuur', 'created_by', 'created_at', 'updated_at']

    def get_created_by_naam(self, obj):
        if obj.created_by:
            return f"{obj.created_by.voornaam} {obj.created_by.achternaam}".strip() or obj.created_by.username
        return None

    def validate_rijen(self, value):
        """Valideer dat rijen een lijst van dictionaries is."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Rijen moet een lijst zijn.")
        for i, rij in enumerate(value):
            if not isinstance(rij, dict):
                raise serializers.ValidationError(f"Rij {i} moet een object zijn.")
        return value
