# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('planning', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='planningentry',
            name='ritnummer',
            field=models.CharField(blank=True, max_length=50, verbose_name='Ritnummer'),
        ),
    ]
