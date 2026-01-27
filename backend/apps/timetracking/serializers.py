from rest_framework import serializers
from .models import TimeEntry

class TimeEntrySerializer(serializers.ModelSerializer):
    user_naam = serializers.CharField(source='user.full_name', read_only=True)
    totaal_uren_display = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeEntry
        fields = '__all__'
        read_only_fields = ['id', 'weeknummer', 'totaal_km', 'totaal_uren', 'created_at', 'updated_at']
    
    def get_totaal_uren_display(self, obj):
        if obj.totaal_uren:
            total_seconds = int(obj.totaal_uren.total_seconds())
            hours, remainder = divmod(total_seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            return f"{hours}:{minutes:02d}"
        return "0:00"
