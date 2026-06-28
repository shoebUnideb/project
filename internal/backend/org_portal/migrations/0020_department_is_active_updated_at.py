from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0019_accessrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='department',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='department',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
