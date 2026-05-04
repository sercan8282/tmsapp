# Generated migration for adding type to DossierMailLog

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("dossiers", "0003_organisatie_dossiermaillog_contactpersoon_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="dossiermaillog",
            name="type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="maillogs",
                to="dossiers.dossiertype",
                verbose_name="Type",
            ),
        ),
    ]
