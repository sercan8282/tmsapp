from django.contrib import admin
from .models import InvoiceTemplate, Invoice, InvoiceLine


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0


@admin.register(InvoiceTemplate)
class InvoiceTemplateAdmin(admin.ModelAdmin):
    list_display = ['naam', 'is_active', 'updated_at']
    list_filter = ['is_active']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['factuurnummer', 'bedrijf', 'type', 'status', 'factuurdatum', 'totaal']
    list_filter = ['type', 'status', 'factuurdatum']
    search_fields = ['factuurnummer', 'bedrijf__naam']
    date_hierarchy = 'factuurdatum'
    inlines = [InvoiceLineInline]


@admin.register(InvoiceLine)
class InvoiceLineAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'omschrijving', 'aantal', 'prijs_per_eenheid', 'totaal']
