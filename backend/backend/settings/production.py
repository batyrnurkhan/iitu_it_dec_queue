"""
Production settings
"""
from .base import *

# Production overrides
DEBUG = False

ALLOWED_HOSTS = ['*', '198.211.99.20', 'localhost', '127.0.0.1', 'queue.iitu.edu.kz', '10.8.1.53', '0.0.0.0']

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

# Production Redis
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('redis', 6379)],
        },
    },
}

# Production security settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = ['https://queue.iitu.edu.kz/']
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True