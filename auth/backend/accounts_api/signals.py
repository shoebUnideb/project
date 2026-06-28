import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)

SHADOW_DBS = ('public_shadow', 'internal_shadow')

_UPSERT_SQL = """
    INSERT INTO accounts_customuser
        (id, password, last_login, is_superuser, username, first_name, last_name,
         email, is_staff, is_active, date_joined, role, is_approved,
         message_permission, is_deleted, deleted_at, theme_color,
         font_style, onboarding_complete, has_internal_access)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON CONFLICT (id) DO UPDATE SET
        password            = EXCLUDED.password,
        last_login          = EXCLUDED.last_login,
        is_superuser        = EXCLUDED.is_superuser,
        username            = EXCLUDED.username,
        first_name          = EXCLUDED.first_name,
        last_name           = EXCLUDED.last_name,
        email               = EXCLUDED.email,
        is_staff            = EXCLUDED.is_staff,
        is_active           = EXCLUDED.is_active,
        role                = EXCLUDED.role,
        is_approved         = EXCLUDED.is_approved,
        message_permission  = EXCLUDED.message_permission,
        is_deleted          = EXCLUDED.is_deleted,
        deleted_at          = EXCLUDED.deleted_at,
        theme_color         = EXCLUDED.theme_color,
        font_style          = EXCLUDED.font_style,
        onboarding_complete = EXCLUDED.onboarding_complete,
        has_internal_access = EXCLUDED.has_internal_access
"""

_DELETE_SQL = "DELETE FROM accounts_customuser WHERE id = %s"


def _user_row(instance):
    return [
        instance.id, instance.password, instance.last_login, instance.is_superuser,
        instance.username, instance.first_name, instance.last_name, instance.email,
        instance.is_staff, instance.is_active, instance.date_joined, instance.role,
        instance.is_approved, instance.message_permission, instance.is_deleted,
        instance.deleted_at, instance.theme_color, instance.font_style,
        instance.onboarding_complete, instance.has_internal_access,
    ]


@receiver(post_save, sender='accounts.CustomUser')
def sync_user_to_shadows(sender, instance, **kwargs):
    from django.db import connections
    row = _user_row(instance)
    for db in SHADOW_DBS:
        try:
            with connections[db].cursor() as cur:
                cur.execute(_UPSERT_SQL, row)
        except Exception:
            logger.warning('Shadow sync failed for %s user_id=%s', db, instance.id, exc_info=True)


@receiver(post_delete, sender='accounts.CustomUser')
def delete_user_from_shadows(sender, instance, **kwargs):
    from django.db import connections
    for db in SHADOW_DBS:
        try:
            with connections[db].cursor() as cur:
                cur.execute(_DELETE_SQL, [instance.id])
        except Exception:
            logger.warning('Shadow delete failed for %s user_id=%s', db, instance.id, exc_info=True)
