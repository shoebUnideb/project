from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0024_contribution_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='contribution',
            name='project_name',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='contribution',
            name='impact_level',
            field=models.CharField(
                blank=True,
                choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')],
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='contribution',
            name='collaborators',
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name='contribution',
            name='deliverable_url',
            field=models.URLField(blank=True),
        ),
    ]
