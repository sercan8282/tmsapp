from django.contrib import admin
from .models import Company

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['naam', 'kvk', 'contactpersoon', 'telefoon', 'stad']
    search_fields = ['naam', 'kvk', 'contactpersoon']
    list_filter = ['stad']
