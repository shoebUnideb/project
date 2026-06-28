"""
public-portal settings.
Owns: core (workspace, tasks, mentoring).
Reads accounts from auth_db via AuthRouter.
Runs on port 8002.
"""

from datetime import timedelta
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ─────────────────────────────────────────────────────────────────
# Must match auth-service SECRET_KEY (same HS256 signing secret in Phase 3)
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production-use-env-var')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='127.0.0.1,localhost',
    cast=lambda v: [s.strip() for s in v.split(',')],
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'channels',
    'accounts',
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'public_platform.urls'
WSGI_APPLICATION = 'public_platform.wsgi.application'
ASGI_APPLICATION = 'public_platform.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ── Databases ─────────────────────────────────────────────────────────────────
# default → gile_public (core models)
# auth_db → gile_auth  (accounts + token_blacklist, shared with auth-service)
_DB_CONN = {'CONN_MAX_AGE': 60, 'CONN_HEALTH_CHECKS': True}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('PUBLIC_DB_NAME', default='gile_public'),
        'USER': config('PUBLIC_DB_USER', default='postgres'),
        'PASSWORD': config('PUBLIC_DB_PASSWORD', default=''),
        'HOST': config('PUBLIC_DB_HOST', default='localhost'),
        'PORT': config('PUBLIC_DB_PORT', default='5432'),
        **_DB_CONN,
    },
    'auth_db': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('AUTH_DB_NAME', default='gile_auth'),
        'USER': config('AUTH_DB_USER', default='postgres'),
        'PASSWORD': config('AUTH_DB_PASSWORD', default=''),
        'HOST': config('AUTH_DB_HOST', default='localhost'),
        'PORT': config('AUTH_DB_PORT', default='5432'),
        **_DB_CONN,
    },
}

DATABASE_ROUTERS = ['public_platform.routers.AuthRouter']

AUTH_USER_MODEL = 'accounts.CustomUser'

# ── Channels ─────────────────────────────────────────────────────────────────
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://127.0.0.1:6379/0')],
            'capacity': 1500,
            'expiry': 10,
        },
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

MEDIA_URL = '/media/'
MEDIA_ROOT = config('MEDIA_ROOT', default=str(BASE_DIR.parent / 'media'))

STATIC_URL = '/static/'
STATIC_ROOT = config('STATIC_ROOT', default=str(BASE_DIR / 'staticfiles'))
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── DRF + JWT ────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

def _read_key(path):
    import os
    if path and os.path.exists(path):
        with open(path) as f:
            return f.read()
    return None


_PUBLIC_KEY_PATH = config('JWT_PUBLIC_KEY_PATH', default=str(BASE_DIR.parent / 'keys' / 'public.pem'))

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':    timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME':   timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':    True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM':                'RS256',
    'SIGNING_KEY':              None,                           # portals never issue tokens
    'VERIFYING_KEY':            _read_key(_PUBLIC_KEY_PATH),   # public key — verify only
    'AUTH_HEADER_TYPES':        ('Bearer',),
    'USER_ID_FIELD':            'id',
    'USER_ID_CLAIM':            'user_id',
    # No TOKEN_OBTAIN_SERIALIZER — login lives exclusively on auth-service
}

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=lambda v: [s.strip() for s in v.split(',')],
)
CORS_ALLOW_CREDENTIALS = False
