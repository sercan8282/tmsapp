from django.contrib import admin
from .models import Spreadsheet


@admin.register(Spreadsheet)
class SpreadsheetAdmin(admin.ModelAdmin):
    list_display = ['naam', 'bedrijf', 'week_nummer', 'jaar', 'totaal_factuur', 'created_by', 'updated_at']
    list_filter = ['jaar', 'week_nummer', 'bedrijf']
    search_fields = ['naam', 'bedrijf__naam']
    readonly_fields = ['id', 'totaal_factuur', 'created_at', 'updated_at']
    ordering = ['-jaar', '-week_nummer']
