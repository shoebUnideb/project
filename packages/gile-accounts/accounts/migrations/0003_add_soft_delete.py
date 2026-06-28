from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_add_message_permission'),
    ]

    operations = [
        # Columns already exist in DB — update state only, then fix the DB default
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='customuser',
                    name='is_deleted',
                    field=models.BooleanField(default=False),
                ),
                migrations.AddField(
                    model_name='customuser',
                    name='deleted_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
            ],
            database_operations=[
                # ADD COLUMN IF NOT EXISTS handles both fresh DBs and existing DBs where
                # the columns were created without a migration (legacy monolith case).
                migrations.RunSQL(
                    sql=[
                        "ALTER TABLE accounts_customuser ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;",
                        "ALTER TABLE accounts_customuser ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;",
                    ],
                    reverse_sql=[
                        "ALTER TABLE accounts_customuser DROP COLUMN IF EXISTS is_deleted;",
                        "ALTER TABLE accounts_customuser DROP COLUMN IF EXISTS deleted_at;",
                    ],
                ),
            ],
        ),
    ]
