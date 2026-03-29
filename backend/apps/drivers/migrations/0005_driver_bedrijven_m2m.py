"""
Migration: replace the single-company ForeignKey on Driver with a
ManyToManyField so that a driver can be linked to multiple companies.

Steps:
  1. Add new M2M field `bedrijven` (temporary related_name to avoid clash)
  2. Copy existing FK data into the M2M relation
  3. Remove the old FK field `bedrijf`
  4. Rename the M2M related_name to the canonical 'drivers'
"""
import django.db.models.deletion
from django.db import migrations, models


def copy_bedrijf_to_bedrijven(apps, schema_editor):
    """Copy each driver's existing bedrijf FK value into the new M2M table."""
    Driver = apps.get_model('drivers', 'Driver')
    for driver in Driver.objects.exclude(bedrijf__isnull=True):
        driver.bedrijven.add(driver.bedrijf)


class Migration(migrations.Migration):

    dependencies = [
        ('drivers', '0004_driver_actief'),
        ('companies', '0001_initial'),
    ]

    operations = [
        # Step 1: add the new M2M field with a temporary related_name so it
        # does not clash with the still-existing FK related_name='drivers'.
        migrations.AddField(
            model_name='driver',
            name='bedrijven',
            field=models.ManyToManyField(
                blank=True,
                related_name='drivers_m2m',
                to='companies.company',
                verbose_name='Bedrijven',
            ),
        ),
        # Step 2: populate M2M from old FK
        migrations.RunPython(copy_bedrijf_to_bedrijven, migrations.RunPython.noop),
        # Step 3: drop the old FK column
        migrations.RemoveField(
            model_name='driver',
            name='bedrijf',
        ),
        # Step 4: update the M2M related_name to the canonical 'drivers'
        migrations.AlterField(
            model_name='driver',
            name='bedrijven',
            field=models.ManyToManyField(
                blank=True,
                related_name='drivers',
                to='companies.company',
                verbose_name='Bedrijven',
            ),
        ),
    ]
