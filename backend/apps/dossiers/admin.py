from django.contrib import admin
from .models import DossierType, Dossier, DossierReactie, DossierBijlage

admin.site.register(DossierType)
admin.site.register(Dossier)
admin.site.register(DossierReactie)
admin.site.register(DossierBijlage)
