import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from the backend directory
# override=True ensures .env values take precedence over any existing env vars
load_dotenv(BASE_DIR / '.env', override=True)

# =============================================================================
# CORE SETTINGS - Configure via environment variables for production
# =============================================================================

# SECURITY: Generate a new secret key for production
# python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-this-in-production-abc123xyz')

# SECURITY: Set DEBUG=False in production
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

AUTH_USER_MODEL = 'api.User'

# Hosts allowed to serve this site
# In production: Set ALLOWED_HOSTS to your domain (comma-separated)
_allowed_hosts = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts if h.strip()]
# Railway uses random subdomains - allow all .railway.app domains
if os.environ.get('RAILWAY_ENVIRONMENT'):
    ALLOWED_HOSTS.append('.railway.app')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'rest_framework',
    'corsheaders',
    'storages',  # Cloud storage support
    'api',
]


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files in production
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'api.rls_middleware.RowLevelSecurityMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'api.permissions.CompanyMiddleware',
]

ROOT_URLCONF = 'pesticide_tracker.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'api' / 'templates',
        ],
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

WSGI_APPLICATION = 'pesticide_tracker.wsgi.application'

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
# Supports DATABASE_URL (Railway, Render, Heroku) or individual env vars
import dj_database_url

DATABASE_URL = os.environ.get('DATABASE_URL', '')

if DATABASE_URL:
    # Cloud deployment: Parse DATABASE_URL (Railway, Render, Heroku)
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=60,
            conn_health_checks=True,
        )
    }
else:
    # Local development: Use individual env vars
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'farm_tracker'),
            'USER': os.environ.get('DB_USER', 'farm_tracker_user'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }

CACHE_URL = os.environ.get('CACHE_URL', '')
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'farm-tracker-cache',
    }
}

if CACHE_URL:
    CACHES['default'] = {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': CACHE_URL,
    }


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'America/Los_Angeles'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'  # For collectstatic in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# =============================================================================
# MEDIA / FILE STORAGE
# =============================================================================
# Use cloud storage in production (S3, Cloudflare R2, etc.)
# Falls back to local storage for development

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '')
AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL', '')  # For R2/B2

if AWS_ACCESS_KEY_ID and AWS_STORAGE_BUCKET_NAME:
    # Cloud storage (Cloudflare R2, AWS S3, Backblaze B2)
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

    # R2/S3 settings
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'auto')
    AWS_DEFAULT_ACL = None  # Use bucket default
    AWS_S3_FILE_OVERWRITE = False  # Don't overwrite files with same name
    AWS_QUERYSTRING_AUTH = True  # Signed URLs for private files
    AWS_S3_SIGNATURE_VERSION = 's3v4'

    # URL settings
    if AWS_S3_ENDPOINT_URL:
        # Cloudflare R2 or other S3-compatible
        AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN', '')

    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/' if os.environ.get('AWS_S3_CUSTOM_DOMAIN') else None
else:
    # Local storage for development
    MEDIA_URL = 'media/'
    MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =============================================================================
# CORS CONFIGURATION
# =============================================================================
# Add production frontend URL via FRONTEND_URL env var
_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Add production frontend URL if set
_frontend_url = os.environ.get('FRONTEND_URL', '')
if _frontend_url and _frontend_url not in _cors_origins:
    _cors_origins.append(_frontend_url)

CORS_ALLOWED_ORIGINS = _cors_origins

# CSRF trusted origins (required for cross-origin POST requests in production)
CSRF_TRUSTED_ORIGINS = _cors_origins.copy()
# Add Railway domain if deployed there
if os.environ.get('RAILWAY_ENVIRONMENT'):
    _railway_url = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '')
    if _railway_url:
        CSRF_TRUSTED_ORIGINS.append(f'https://{_railway_url}')

CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
        'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

CORS_ALLOW_HEADERS = [
    'accept', 'authorization', 'content-type',
    'x-csrftoken', 'x-company-id',
]

# =============================================================================
# EMAIL CONFIGURATION
# =============================================================================

# Email backend selection based on environment
EMAIL_BACKEND_TYPE = os.environ.get('EMAIL_BACKEND', 'console')

if EMAIL_BACKEND_TYPE == 'sendgrid':
    # SendGrid via SMTP (simpler than API, no extra package needed)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp.sendgrid.net'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = 'apikey'  # This is literal 'apikey' for SendGrid
    EMAIL_HOST_PASSWORD = os.environ.get('SENDGRID_API_KEY', '')

elif EMAIL_BACKEND_TYPE == 'ses':
    # Amazon SES
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('AWS_SES_REGION_ENDPOINT', 'email-smtp.us-west-2.amazonaws.com')
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.environ.get('AWS_SES_ACCESS_KEY', '')
    EMAIL_HOST_PASSWORD = os.environ.get('AWS_SES_SECRET_KEY', '')

elif EMAIL_BACKEND_TYPE == 'smtp':
    # Generic SMTP (Gmail, Outlook, etc.)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

else:
    # Console backend for development (prints emails to console)
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Common email settings
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'Grove Master <noreply@grovemaster.com>')
EMAIL_SUBJECT_PREFIX = '[Grove Master] '

# Frontend URL for email links
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# Password reset token validity (in seconds) - 24 hours
PASSWORD_RESET_TIMEOUT = 86400

# =============================================================================
# ANTHROPIC API CONFIGURATION (for PDF extraction)
# =============================================================================
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# =============================================================================
# CIMIS (California Irrigation Management Information System) Configuration
# =============================================================================
# Register for API key at: https://et.water.ca.gov/Home/Register
CIMIS_APP_KEY = os.environ.get('CIMIS_APP_KEY', '')
CIMIS_API_BASE_URL = 'https://et.water.ca.gov/api/data'

# =============================================================================
# CELERY CONFIGURATION
# =============================================================================
# Redis as message broker for async task processing (tree detection, etc.)
# Install Redis: https://redis.io/download or use Docker: docker run -d -p 6379:6379 redis

# Broker URL - where Celery sends/receives messages
# Railway provides REDIS_URL automatically
_redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', _redis_url)

# Result backend - where Celery stores task results
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', _redis_url)

# Serialization settings
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Timezone (match Django TIME_ZONE)
CELERY_TIMEZONE = 'America/Los_Angeles'

# Track task state (started, success, failure)
CELERY_TASK_TRACK_STARTED = True

# Task time limits
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max (for large imagery processing)
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit (allows cleanup)

# Task result expiration (24 hours)
CELERY_RESULT_EXPIRES = 86400

# Prevent task from being executed more than once in case of broker failure
CELERY_TASK_ACKS_LATE = True

# Prefetch one task at a time (better for long-running tasks)
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# Celery Beat Schedule - periodic tasks for compliance automation
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Daily compliance checks at 6 AM Pacific
    'check-compliance-deadlines': {
        'task': 'api.tasks.compliance_tasks.check_compliance_deadlines',
        'schedule': crontab(hour=6, minute=0),
    },
    'check-license-expirations': {
        'task': 'api.tasks.compliance_tasks.check_license_expirations',
        'schedule': crontab(hour=6, minute=5),
    },
    'check-wps-training-expirations': {
        'task': 'api.tasks.compliance_tasks.check_wps_training_expirations',
        'schedule': crontab(hour=6, minute=10),
    },
    'send-compliance-reminder-emails': {
        'task': 'api.tasks.compliance_tasks.send_compliance_reminder_emails',
        'schedule': crontab(hour=7, minute=0),
    },
    'send-daily-compliance-digest': {
        'task': 'api.tasks.compliance_tasks.send_daily_compliance_digest',
        'schedule': crontab(hour=7, minute=30),
    },

    # REI checks every 2 hours during work hours (6 AM - 8 PM)
    'check-active-reis': {
        'task': 'api.tasks.compliance_tasks.check_active_reis',
        'schedule': crontab(hour='6,8,10,12,14,16,18,20', minute=0),
    },

    # Generate REI posting records hourly (for new applications)
    'generate-rei-posting-records': {
        'task': 'api.tasks.compliance_tasks.generate_rei_posting_records',
        'schedule': crontab(minute=30),  # Every hour at :30
    },

    # Monthly PUR report generation on 1st of each month at 5 AM
    'auto-generate-monthly-pur': {
        'task': 'api.tasks.compliance_tasks.auto_generate_monthly_pur_report',
        'schedule': crontab(day_of_month=1, hour=5, minute=0),
    },

    # Generate recurring deadlines weekly on Sundays at 3 AM
    'generate-recurring-deadlines': {
        'task': 'api.tasks.compliance_tasks.generate_recurring_deadlines',
        'schedule': crontab(day_of_week=0, hour=3, minute=0),
    },

    # Cleanup old alerts monthly on 15th at 2 AM
    'cleanup-old-alerts': {
        'task': 'api.tasks.compliance_tasks.cleanup_old_alerts',
        'schedule': crontab(day_of_month=15, hour=2, minute=0),
    },

    # ==========================================================================
    # DISEASE PREVENTION TASKS
    # ==========================================================================

    # Sync CDFA data daily at 5 AM (before proximity check)
    'sync-cdfa-detections': {
        'task': 'api.tasks.disease_tasks.sync_external_detections',
        'schedule': crontab(hour=5, minute=0),
    },

    # Check proximity alerts daily at 6 AM (after CDFA sync)
    # Note: Also triggered after sync_external_detections completes
    'check-proximity-alerts': {
        'task': 'api.tasks.disease_tasks.check_proximity_alerts',
        'schedule': crontab(hour=6, minute=0),
    },

    # Send disease alert digest daily at 7 AM
    'send-disease-alert-digest': {
        'task': 'api.tasks.disease_tasks.send_disease_alert_digest',
        'schedule': crontab(hour=7, minute=0),
    },

    # ==========================================================================
    # FSMA COMPLIANCE TASKS
    # ==========================================================================

    # Check facility cleaning compliance daily at 7 AM
    'check-cleaning-compliance': {
        'task': 'api.tasks.fsma_tasks.check_cleaning_compliance',
        'schedule': crontab(hour=7, minute=0),
    },

    # Check quarterly FSMA meeting compliance on 1st of each month at 8 AM
    'check-quarterly-meeting-compliance': {
        'task': 'api.tasks.fsma_tasks.check_quarterly_meeting_compliance',
        'schedule': crontab(day_of_month=1, hour=8, minute=0),
    },

    # Generate monthly inventory snapshot on 1st of each month at 1 AM
    'generate-monthly-inventory-snapshot': {
        'task': 'api.tasks.fsma_tasks.generate_monthly_inventory_snapshot',
        'schedule': crontab(day_of_month=1, hour=1, minute=0),
    },

    # Check low inventory alerts daily at 8 AM
    'check-low-inventory-alerts': {
        'task': 'api.tasks.fsma_tasks.check_low_inventory_alerts',
        'schedule': crontab(hour=8, minute=0),
    },

    # Check PHI compliance for upcoming harvests daily at 6 AM
    'check-phi-upcoming-harvests': {
        'task': 'api.tasks.fsma_tasks.check_phi_compliance_for_upcoming_harvests',
        'schedule': crontab(hour=6, minute=0),
    },

    # Send FSMA daily reminders at 7:15 AM
    'send-fsma-daily-reminder': {
        'task': 'api.tasks.fsma_tasks.send_fsma_daily_reminder',
        'schedule': crontab(hour=7, minute=15),
    },

    # Cleanup old FSMA data monthly on the 1st at 3 AM
    'cleanup-old-fsma-data': {
        'task': 'api.tasks.fsma_tasks.cleanup_old_fsma_data',
        'schedule': crontab(day_of_month=1, hour=3, minute=0),
    },
}
