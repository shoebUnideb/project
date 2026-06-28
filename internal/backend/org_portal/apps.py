from django.apps import AppConfig


class OrgPortalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'org_portal'

    def ready(self):
        import org_portal.signals  # noqa: F401
