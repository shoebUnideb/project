"""
auth-service settings.
Owns: accounts.CustomUser, token_blacklist.
Runs on port 8001.
"""

from datetime import timedelta
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production-use-env-var')
DEBUG = config('DEBUG', default=False, cast=bool)
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
    'accounts',
    'accounts_api',
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

ROOT_URLCONF = 'auth_service.urls'
WSGI_APPLICATION = 'auth_service.wsgi.application'
ASGI_APPLICATION = 'auth_service.asgi.application'

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

# Primary auth database — source of truth for all users
_DB_CONN = {'CONN_MAX_AGE': 60, 'CONN_HEALTH_CHECKS': True}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('AUTH_DB_NAME', default='gile_auth'),
        'USER': config('AUTH_DB_USER', default='postgres'),
        'PASSWORD': config('AUTH_DB_PASSWORD', default=''),
        'HOST': config('AUTH_DB_HOST', default='localhost'),
        'PORT': config('AUTH_DB_PORT', default='5432'),
        **_DB_CONN,
    },
    # Shadow connections — auth service writes user changes here so portals
    # always have up-to-date FK-resolvable copies without cross-DB joins.
    'public_shadow': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('PUBLIC_DB_NAME', default='gile_public'),
        'USER': config('PUBLIC_DB_USER', default='postgres'),
        'PASSWORD': config('PUBLIC_DB_PASSWORD', default=''),
        'HOST': config('PUBLIC_DB_HOST', default='localhost'),
        'PORT': config('PUBLIC_DB_PORT', default='5432'),
        **_DB_CONN,
    },
    'internal_shadow': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('INTERNAL_DB_NAME', default='gile_internal'),
        'USER': config('INTERNAL_DB_USER', default='postgres'),
        'PASSWORD': config('INTERNAL_DB_PASSWORD', default=''),
        'HOST': config('INTERNAL_DB_HOST', default='localhost'),
        'PORT': config('INTERNAL_DB_PORT', default='5432'),
        **_DB_CONN,
    },
}

AUTH_USER_MODEL = 'accounts.CustomUser'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = config('STATIC_ROOT', default=str(BASE_DIR / 'staticfiles'))
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

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
    """Read a PEM key file; fall back to SECRET_KEY string for local dev without keys."""
    import os
    if path and os.path.exists(path):
        with open(path) as f:
            return f.read()
    return SECRET_KEY


_PRIVATE_KEY_PATH = config('JWT_PRIVATE_KEY_PATH', default=str(BASE_DIR.parent / 'keys' / 'private.pem'))
_PUBLIC_KEY_PATH  = config('JWT_PUBLIC_KEY_PATH',  default=str(BASE_DIR.parent / 'keys' / 'public.pem'))

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':    timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME':   timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':    True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM':                'RS256',
    'SIGNING_KEY':              _read_key(_PRIVATE_KEY_PATH),   # private key — auth-service only
    'VERIFYING_KEY':            _read_key(_PUBLIC_KEY_PATH),    # public key for verification
    'AUTH_HEADER_TYPES':        ('Bearer',),
    'USER_ID_FIELD':            'id',
    'USER_ID_CLAIM':            'user_id',
    'TOKEN_OBTAIN_SERIALIZER':  'accounts.serializers.CustomTokenObtainPairSerializer',
}

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default=(
        'http://localhost:5173,http://127.0.0.1:5173,'
        'http://localhost:5174,http://127.0.0.1:5174'
    ),
    cast=lambda v: [s.strip() for s in v.split(',')],
)
CORS_ALLOW_CREDENTIALS = False

CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=lambda v: [s.strip() for s in v.split(',')],
)

REDIS_URL = config('REDIS_URL', default='redis://127.0.0.1:6379/2')
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}
