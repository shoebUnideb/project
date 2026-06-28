"""
Database router for internal-portal.

Routes accounts and token_blacklist reads/writes to auth_db (shared with auth-service).
Everything else (org_portal models) goes to the default database (gile_internal).

Migration strategy: accounts tables are created on BOTH default and auth_db so that
PostgreSQL FK constraints from org_portal_* tables to accounts_customuser resolve locally.
At runtime, all account reads/writes are routed to auth_db — the shadow tables on
gile_internal remain empty and are never read. token_blacklist migrates on auth_db only.
"""

ACCOUNTS_APPS = {'accounts', 'token_blacklist'}


class AuthRouter:
    def db_for_read(self, model, **hints):
        if model._meta.app_label in ACCOUNTS_APPS:
            return 'auth_db'
        return 'default'

    def db_for_write(self, model, **hints):
        if model._meta.app_label in ACCOUNTS_APPS:
            return 'auth_db'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == 'token_blacklist':
            # token_blacklist only exists on auth_db
            return db == 'auth_db'
        if app_label == 'accounts':
            # Shadow accounts tables on default so FK constraints resolve locally;
            # runtime reads/writes go to auth_db via db_for_read/write above.
            return db in ('default', 'auth_db')
        return db == 'default'
