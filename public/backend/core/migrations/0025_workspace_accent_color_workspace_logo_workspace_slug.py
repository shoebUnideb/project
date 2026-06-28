from django.db import migrations, models
from django.utils.text import slugify
from django.utils.crypto import get_random_string


def populate_slugs(apps, schema_editor):
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, name FROM core_workspace ORDER BY id")
        rows = cursor.fetchall()
    used = set()
    updates = []
    for ws_id, name in rows:
        base = slugify(name)[:100] or 'workspace'
        slug = base
        while slug in used:
            slug = f"{base}-{get_random_string(4)}"
        used.add(slug)
        updates.append((slug, ws_id))
    with connection.cursor() as cursor:
        for slug, ws_id in updates:
            cursor.execute("UPDATE core_workspace SET slug = %s WHERE id = %s", [slug, ws_id])


class Migration(migrations.Migration):

    atomic = False  # manage indexes and columns manually to be idempotent

    dependencies = [
        ('core', '0024_remove_mentorprofile_pronouns'),
    ]

    operations = [
        # All three columns added via raw SQL with IF NOT EXISTS
        migrations.RunSQL(
            "ALTER TABLE core_workspace ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) NOT NULL DEFAULT 'blue'",
            "ALTER TABLE core_workspace DROP COLUMN IF EXISTS accent_color",
        ),
        migrations.RunSQL(
            "ALTER TABLE core_workspace ADD COLUMN IF NOT EXISTS logo VARCHAR(100)",
            "ALTER TABLE core_workspace DROP COLUMN IF EXISTS logo",
        ),
        migrations.RunSQL(
            "ALTER TABLE core_workspace ADD COLUMN IF NOT EXISTS slug VARCHAR(120) NOT NULL DEFAULT ''",
            "ALTER TABLE core_workspace DROP COLUMN IF EXISTS slug",
        ),
        # Populate slugs for existing rows (only those with empty slug)
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        # Add unique + like indexes with IF NOT EXISTS
        migrations.RunSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS core_workspace_slug_key ON core_workspace (slug)",
            "DROP INDEX IF EXISTS core_workspace_slug_key",
        ),
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS core_workspace_slug_dfa51520_like ON core_workspace (slug varchar_pattern_ops)",
            "DROP INDEX IF EXISTS core_workspace_slug_dfa51520_like",
        ),
        # Sync Django ORM state (no DB operations — columns already exist)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='workspace',
                    name='accent_color',
                    field=models.CharField(blank=True, default='blue', max_length=20),
                ),
                migrations.AddField(
                    model_name='workspace',
                    name='logo',
                    field=models.ImageField(blank=True, null=True, upload_to='workspace_logos/'),
                ),
                migrations.AddField(
                    model_name='workspace',
                    name='slug',
                    field=models.SlugField(blank=True, max_length=120, unique=True),
                ),
            ],
            database_operations=[],
        ),
    ]
