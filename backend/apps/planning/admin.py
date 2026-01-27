from django.contrib import admin
from .models import WeekPlanning, PlanningEntry

class PlanningEntryInline(admin.TabularInline):
    model = PlanningEntry
    extra = 0

@admin.register(WeekPlanning)
class WeekPlanningAdmin(admin.ModelAdmin):
    list_display = ['bedrijf', 'weeknummer', 'jaar']
    list_filter = ['bedrijf', 'jaar']
    inlines = [PlanningEntryInline]

@admin.register(PlanningEntry)
class PlanningEntryAdmin(admin.ModelAdmin):
    list_display = ['planning', 'vehicle', 'dag', 'chauffeur', 'adr']
    list_filter = ['dag', 'adr']
