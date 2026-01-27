from django.contrib import admin
from .models import Driver

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ['naam', 'telefoon', 'bedrijf', 'adr', 'gekoppelde_gebruiker']
    search_fields = ['naam', 'telefoon']
    list_filter = ['adr', 'bedrijf']
