from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0033_event_assigned_members'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='recurrence_type',
            field=models.CharField(
                blank=True,
                choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('monthly', 'Monthly')],
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='recurrence_end_date',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='event',
            name='series_id',
            field=models.CharField(blank=True, db_index=True, max_length=36),
        ),
    ]
