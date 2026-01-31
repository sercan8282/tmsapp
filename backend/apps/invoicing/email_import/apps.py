from django.apps import AppConfig


class EmailImportConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.invoicing.email_import'
    verbose_name = 'E-mail Factuur Import'
