from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0032_traininglesson_publish_timestamps'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='assigned_members',
            field=models.ManyToManyField(
                blank=True,
                related_name='assigned_events',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
