from django.contrib import admin
from .models import Driver

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ['naam', 'telefoon', 'bedrijf', 'adr', 'gekoppelde_gebruiker', 'standaard_pauze', 'auto_uren', 'tacho_kenteken']
    search_fields = ['naam', 'telefoon', 'tacho_kenteken']
    list_filter = ['adr', 'bedrijf', 'auto_uren']
