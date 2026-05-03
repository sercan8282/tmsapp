import apps.timetracking.models
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timetracking', '0004_timeentry_bron'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TolRegistratie',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('datum', models.DateField(verbose_name='Datum')),
                ('kenteken', models.CharField(max_length=20, verbose_name='Kenteken')),
                ('totaal_bedrag', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Totaal bedrag')),
                ('bijlage', models.FileField(upload_to=apps.timetracking.models.tol_bijlage_upload_path, verbose_name='Bijlage')),
                ('status', models.CharField(
                    choices=[('ingediend', 'Ingediend'), ('gefactureerd', 'Gefactureerd')],
                    default='ingediend',
                    max_length=20,
                    verbose_name='Status',
                )),
                ('gefactureerd', models.BooleanField(default=False, verbose_name='Gefactureerd')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tol_registraties',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Gebruiker',
                )),
            ],
            options={
                'verbose_name': 'Tolregistratie',
                'verbose_name_plural': 'Tolregistraties',
                'ordering': ['-datum', '-created_at'],
            },
        ),
    ]
