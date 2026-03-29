from django.contrib import admin
from .models import Driver

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ['naam', 'telefoon', 'get_bedrijven', 'adr', 'gekoppelde_gebruiker']
    search_fields = ['naam', 'telefoon']
    list_filter = ['adr', 'bedrijven']
    filter_horizontal = ['bedrijven']

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('bedrijven')

    def get_bedrijven(self, obj):
        return ', '.join([c.naam for c in obj.bedrijven.all()]) or '-'
    get_bedrijven.short_description = 'Bedrijven'
