from django.contrib import admin
from .models import Vehicle

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ['kenteken', 'type_wagen', 'ritnummer', 'bedrijf']
    search_fields = ['kenteken', 'ritnummer']
    list_filter = ['bedrijf', 'type_wagen']
