from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('drivers', '0006_driver_expiry_dates'),
    ]

    operations = [
        migrations.AddField(
            model_name='driver',
            name='standaard_pauze',
            field=models.PositiveIntegerField(
                default=30,
                help_text='Standaard pauzetijd in minuten die automatisch wordt ingevuld bij tachograaf uren.',
                verbose_name='Standaard pauze (minuten)',
            ),
        ),
    ]
