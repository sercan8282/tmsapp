from django.contrib import admin
from .models import TimeEntry

@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = ['user', 'datum', 'weeknummer', 'ritnummer', 'kenteken', 'totaal_km', 'totaal_uren', 'status']
    search_fields = ['ritnummer', 'kenteken', 'user__voornaam', 'user__achternaam']
    list_filter = ['status', 'weeknummer', 'datum']
    date_hierarchy = 'datum'
