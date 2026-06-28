import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0030_memberdocument_assigned_by'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ExtensionRequest',
            fields=[
                ('id',             models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('days_requested', models.PositiveIntegerField()),
                ('reason',         models.TextField()),
                ('status',         models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('denied', 'Denied')], default='pending', max_length=20)),
                ('admin_note',     models.TextField(blank=True)),
                ('reviewed_at',    models.DateTimeField(blank=True, null=True)),
                ('created_at',     models.DateTimeField(auto_now_add=True)),
                ('updated_at',     models.DateTimeField(auto_now=True)),
                ('course',         models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='extension_requests', to='org_portal.trainingcourse')),
                ('enrollment',     models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='extension_requests', to='org_portal.trainingenrollment')),
                ('reviewed_by',    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_extension_requests', to=settings.AUTH_USER_MODEL)),
                ('user',           models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='extension_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
