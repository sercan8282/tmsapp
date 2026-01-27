from rest_framework import serializers
from .models import Driver

class DriverSerializer(serializers.ModelSerializer):
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    gebruiker_naam = serializers.CharField(source='gekoppelde_gebruiker.full_name', read_only=True)
    
    class Meta:
        model = Driver
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
