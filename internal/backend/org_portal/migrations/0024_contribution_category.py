from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0023_taskinstance_approval_required_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='contribution',
            name='category',
            field=models.CharField(
                blank=True,
                choices=[
                    ('project_work', 'Project Work'),
                    ('meetings', 'Meetings'),
                    ('learning', 'Learning'),
                    ('other', 'Other'),
                ],
                default='other',
                max_length=20,
            ),
        ),
    ]
