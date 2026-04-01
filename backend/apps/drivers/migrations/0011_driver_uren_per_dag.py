from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('drivers', '0010_add_standaard_begintijd'),
    ]

    operations = [
        migrations.AddField(
            model_name='driver',
            name='uren_per_dag',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Standaard werkuren per dag. Wordt gebruikt om overwerk te berekenen in het vergelijkingsrapport.',
                max_digits=4,
                null=True,
                verbose_name='Uren per dag',
            ),
        ),
    ]
