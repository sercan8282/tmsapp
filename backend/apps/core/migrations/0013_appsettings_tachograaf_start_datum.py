from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_appsettings_linqo_api_key'),
    ]

    operations = [
        migrations.AddField(
            model_name='appsettings',
            name='tachograaf_start_datum',
            field=models.DateField(
                blank=True,
                null=True,
                help_text='Vanaf welke datum tachograaf gegevens automatisch verwerkt moeten worden.',
                verbose_name='Tachograaf startdatum',
            ),
        ),
    ]
