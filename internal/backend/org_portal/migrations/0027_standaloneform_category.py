from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0026_orgsettings_contribution_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='standaloneform',
            name='category',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
