from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0025_contribution_detailed_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='orgsettings',
            name='contribution_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='orgsettings',
            name='contribution_require_evidence',
            field=models.BooleanField(default=False),
        ),
    ]
