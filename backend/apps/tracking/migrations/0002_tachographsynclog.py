import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracking', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TachographSyncLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date', models.DateField(unique=True, verbose_name='Datum')),
                ('vehicles_processed', models.PositiveIntegerField(default=0, verbose_name='Voertuigen verwerkt')),
                ('entries_created', models.PositiveIntegerField(default=0, verbose_name='Uren aangemaakt')),
                ('overtime_created', models.PositiveIntegerField(default=0, verbose_name='Overuren aangemaakt')),
                ('errors', models.TextField(blank=True, verbose_name='Fouten')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Tachograaf Sync Log',
                'verbose_name_plural': 'Tachograaf Sync Logs',
                'ordering': ['-date'],
            },
        ),
    ]
