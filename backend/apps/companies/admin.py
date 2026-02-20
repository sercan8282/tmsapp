from django.contrib import admin
from .models import Company, MailingListContact


class MailingListContactInline(admin.TabularInline):
    model = MailingListContact
    extra = 1
    fields = ['naam', 'email', 'functie', 'is_active']


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['naam', 'kvk', 'contactpersoon', 'telefoon', 'stad']
    search_fields = ['naam', 'kvk', 'contactpersoon']
    list_filter = ['stad']
    inlines = [MailingListContactInline]


@admin.register(MailingListContact)
class MailingListContactAdmin(admin.ModelAdmin):
    list_display = ['naam', 'email', 'bedrijf', 'functie', 'is_active']
    search_fields = ['naam', 'email', 'functie']
    list_filter = ['is_active', 'bedrijf']
