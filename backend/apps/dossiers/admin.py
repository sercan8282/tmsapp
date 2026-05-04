from django.contrib import admin
from .models import DossierType, Dossier, DossierReactie, DossierBijlage, Organisatie, Contactpersoon, DossierMailLog

admin.site.register(DossierType)
admin.site.register(Dossier)
admin.site.register(DossierReactie)
admin.site.register(DossierBijlage)
admin.site.register(Organisatie)
admin.site.register(Contactpersoon)
admin.site.register(DossierMailLog)
