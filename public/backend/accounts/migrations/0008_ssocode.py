from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_add_has_internal_access'),
    ]

    operations = [
        migrations.CreateModel(
            name='SSOCode',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('expires_at', models.DateTimeField()),
                ('used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sso_codes',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'indexes': [models.Index(fields=['expires_at'], name='accounts_ss_expires_idx')]},
        ),
    ]
