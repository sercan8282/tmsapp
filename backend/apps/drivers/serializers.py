from rest_framework import serializers
from .models import Driver

class DriverSerializer(serializers.ModelSerializer):
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True, allow_null=True)
    gekoppelde_gebruiker_naam = serializers.SerializerMethodField()
    
    class Meta:
        model = Driver
        fields = [
            'id', 'naam', 'telefoon', 'bedrijf', 'bedrijf_naam',
            'gekoppelde_gebruiker', 'gekoppelde_gebruiker_naam',
            'adr', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_gekoppelde_gebruiker_naam(self, obj):
        if obj.gekoppelde_gebruiker:
            return obj.gekoppelde_gebruiker.full_name or obj.gekoppelde_gebruiker.username
        return None
