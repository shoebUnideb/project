from django.db import migrations


def migrate_cover_to_accent(apps, schema_editor):
    """
    Promote cover_color → accent_color for workspaces where the mentor chose
    a cover color but never changed accent_color from its 'blue' default.
    """
    Workspace = apps.get_model('core', 'Workspace')
    for ws in Workspace.objects.filter(accent_color='blue').exclude(cover_color__in=['', 'blue', 'indigo']):
        ws.accent_color = ws.cover_color
        ws.save(update_fields=['accent_color'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0043_student_profile_generalise'),
    ]

    operations = [
        migrations.RunPython(migrate_cover_to_accent, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='workspace',
            name='cover_color',
        ),
    ]
