from rest_framework import serializers
from .models import Vehicle

class VehicleSerializer(serializers.ModelSerializer):
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True, allow_null=True)
    
    class Meta:
        model = Vehicle
        fields = [
            'id', 'kenteken', 'type_wagen', 'ritnummer',
            'bedrijf', 'bedrijf_naam', 'minimum_weken_per_jaar',
            'actief', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_kenteken(self, value):
        value = value.upper()
        qs = Vehicle.objects.filter(kenteken__iexact=value, actief=True)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Er bestaat al een actief voertuig met dit kenteken."
            )
        return value
