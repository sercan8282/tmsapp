from django.contrib import admin
from .models import Spreadsheet, SpreadsheetTemplate


@admin.register(SpreadsheetTemplate)
class SpreadsheetTemplateAdmin(admin.ModelAdmin):
    list_display = ['naam', 'is_active', 'created_at', 'updated_at']
    list_filter = ['is_active']
    search_fields = ['naam', 'beschrijving']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['naam']


@admin.register(Spreadsheet)
class SpreadsheetAdmin(admin.ModelAdmin):
    list_display = ['naam', 'bedrijf', 'week_nummer', 'jaar', 'totaal_factuur', 'template', 'created_by', 'updated_at']
    list_filter = ['jaar', 'week_nummer', 'bedrijf', 'template']
    search_fields = ['naam', 'bedrijf__naam']
    readonly_fields = ['id', 'totaal_factuur', 'created_at', 'updated_at']
    ordering = ['-jaar', '-week_nummer']
