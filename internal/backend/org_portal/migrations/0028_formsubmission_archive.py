from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0027_standaloneform_category'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='formsubmission',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='formsubmission',
            name='is_archived',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='formsubmission',
            name='response_snapshot',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
