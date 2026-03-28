from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0003_vehicle_actief'),
    ]

    operations = [
        migrations.AlterField(
            model_name='vehicle',
            name='kenteken',
            field=models.CharField(max_length=20, verbose_name='Kenteken'),
        ),
        migrations.AddConstraint(
            model_name='vehicle',
            constraint=models.UniqueConstraint(
                condition=models.Q(actief=True),
                fields=['kenteken'],
                name='unique_kenteken_actief',
            ),
        ),
    ]
