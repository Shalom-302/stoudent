from functools import lru_cache
import os
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from backend.core.path_conf import ApiV2Path


class Settings(BaseSettings):
    """Global settings.

    Every field has a sane development default so the app boots out of the box
    (e.g. ``docker-run.sh up`` with the bundled docker-compose). Override via the
    ``.env`` file for your own setup, and ALWAYS set real secrets in production.
    """

    model_config = SettingsConfigDict(
        env_file=f'{ApiV2Path}/.env', env_file_encoding='utf-8', extra='ignore'
    )

    APP_NAME: str = 'sign'

    # Env Config
    ENVIRONMENT: Literal['dev', 'preprod', 'prod'] = 'dev'

    # Database schema bootstrap: in dev, tables are auto-created on startup for a
    # zero-friction first run. In production set DB_AUTO_CREATE=false and rely on
    # Alembic migrations (`shaapi db generate` / `shaapi db apply`).
    DB_AUTO_CREATE: bool = True

    # Observability (opt-in). When disabled, the OpenTelemetry/Prometheus stack
    # is never imported, keeping the lean core lightweight.
    OBSERVABILITY_ENABLED: bool = False
    OTLP_GRPC_ENDPOINT: str | None = None

    # Postgres
    POSTGRES_HOST: str = 'localhost'
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = 'postgres'
    POSTGRES_PASSWORD: str = 'postgres'
    POSTGRES_ECHO: bool = False
    POSTGRES_DATABASE: str = 'sign'

    CLIENT_URL: str = 'http://localhost:3000'

    # Redis
    REDIS_HOST: str = 'localhost'
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None
    REDIS_DATABASE: int = 0
    REDIS_TIMEOUT: int = 5

    # Object storage (MinIO / S3-compatible)
    MINIO_ENDPOINT: str = 'localhost:9000'
    MINIO_PORT: int = 9000
    MINIO_ACCESS_KEY: str = 'minioadmin'
    MINIO_SECRET_KEY: str = 'minioadmin'
    MINIO_BUCKET_NAME: str = 'sign'
    MINIO_CLOUD_URL: str = 'http://localhost:9000'

    # SMTP / email (optional: leave blank to disable outgoing mail)
    SMTP_TLS: str = 'True'
    SMTP_PORT: str = '587'
    SMTP_HOST: str = ''
    SMTP_USER: str = ''
    EMAILS_FROM_EMAIL: str = ''
    EMAILS_FROM_NAME: str = ''
    SMTP_PASSWORD: str = ''
    EMAIL_TEMPLATES_DIR: str = os.getcwd() + '/templates/build'

    # Token / crypto secrets — CHANGE THESE IN PRODUCTION
    # Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    TOKEN_SECRET_KEY: str = 'dev-insecure-change-me-token-secret-key'
    # Generate with: python -c "import os; print(os.urandom(32).hex())"
    OPERA_LOG_ENCRYPT_SECRET_KEY: str = 'dev-insecure-change-me-opera-log-key'

    # Google SSO (optional)
    GOOGLE_CLIENT_ID: str = ''
    GOOGLE_SECRET_KEY: str = ''
    GOOGLE_WEBHOOK_OAUTH_REDIRECT_URI: str = ''

    # FastAPI
    FASTAPI_API_V1_PATH: str = '/api/v1'
    FASTAPI_TITLE: str = 'sign'
    FASTAPI_VERSION: str = '0.0.1'
    FASTAPI_DESCRIPTION: str = 'A lean, batteries-included FastAPI backend.'
    FASTAPI_DOCS_URL: str | None = f'{FASTAPI_API_V1_PATH}/docs'
    FASTAPI_REDOCS_URL: str | None = f'{FASTAPI_API_V1_PATH}/redocs'
    FASTAPI_OPENAPI_URL: str | None = f'{FASTAPI_API_V1_PATH}/openapi'
    FASTAPI_STATIC_FILES: bool = False

    # Token
    TOKEN_ALGORITHM: str = 'HS256'
    TOKEN_EXPIRE_SECONDS: int = 60 * 60 * 24 * 1  # access token lifetime
    # STOUDENT keeps members signed in: the refresh token is rotated on every
    # use, so this is the idle limit, not a hard one (60 days without a visit).
    TOKEN_REFRESH_EXPIRE_SECONDS: int = 60 * 60 * 24 * 60  # refresh token lifetime
    # One session per device: signing in on the phone must not sign the laptop out.
    TOKEN_MULTI_LOGIN: bool = True
    TOKEN_REDIS_PREFIX: str = 'sign:token'
    USER_SECURE_TOKEN_REDIS_PREFIX: str = 'sign:user:token'
    ADMIN_SECURE_TOKEN_REDIS_PREFIX: str = 'sign:admin:token'
    TOKEN_REFRESH_REDIS_PREFIX: str = 'sign:refresh_token'
    CAPTCHA_LOGIN_REDIS_PREFIX: str = 'sign:captcha:login'
    TOKEN_REQUEST_PATH_EXCLUDE: list[str] = [  # JWT / RBAC whitelist
        f'/admin{FASTAPI_API_V1_PATH}/auth/login',
        f'/admin{FASTAPI_API_V1_PATH}/auth/token/new',
        # Student-facing (client sub-app, mounted at the site root)
        f'{FASTAPI_API_V1_PATH}/auth/login',
        f'{FASTAPI_API_V1_PATH}/auth/register',
        f'{FASTAPI_API_V1_PATH}/auth/refresh',
        f'{FASTAPI_API_V1_PATH}/auth/verify-otp',
        f'{FASTAPI_API_V1_PATH}/auth/resend-otp',
        f'{FASTAPI_API_V1_PATH}/auth/forgot-password',
        f'{FASTAPI_API_V1_PATH}/auth/reset-password',
    ]

    # JWT
    JWT_USER_REDIS_PREFIX: str = 'sign:user'
    JWT_ADMIN_REDIS_PREFIX: str = 'sign:admin'
    JWT_USER_REDIS_EXPIRE_SECONDS: int = 60 * 60 * 24 * 7

    # Permission (RBAC)
    PERMISSION_MODE: Literal['casbin', 'role-menu'] = 'casbin'
    PERMISSION_REDIS_PREFIX: str = 'sign:permission'

    # Casbin RBAC whitelist
    RBAC_CASBIN_EXCLUDE: set[tuple[str, str]] = {
        ('POST', f'/admin{FASTAPI_API_V1_PATH}/auth/logout'),
        ('POST', f'/admin{FASTAPI_API_V1_PATH}/auth/token/new'),
        ('POST', f'{FASTAPI_API_V1_PATH}/auth/logout'),
        ('POST', f'{FASTAPI_API_V1_PATH}/auth/refresh'),
    }

    # Role-Menu
    RBAC_ROLE_MENU_EXCLUDE: list[str] = [
        'sys:monitor:redis',
        'sys:monitor:server',
    ]

    # Cookies
    COOKIE_REFRESH_TOKEN_KEY: str = 'sign_refresh_token'
    COOKIE_REFRESH_TOKEN_EXPIRE_SECONDS: int = TOKEN_REFRESH_EXPIRE_SECONDS
    # Secure cookie flags. 'lax' works for a same-site front/back (e.g.
    # localhost:3000 -> localhost:8000); use 'none' + secure for cross-domain.
    # COOKIE_SECURE is forced on outside dev (see auth_service), so the refresh
    # token is never sent over plain HTTP in production.
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: Literal['lax', 'strict', 'none'] = 'lax'

    # WhatsApp OTP at sign-up (via gowa / go-whatsapp-web-multidevice), ported
    # from shaapi. When OTP_ENABLED is true, a self-service registration creates
    # an UNVERIFIED account and sends a code; tokens are only issued by
    # /auth/verify-otp. Off by default so a dev stack without gowa still works.
    OTP_ENABLED: bool = False
    OTP_LENGTH: int = 6
    OTP_TTL_SECONDS: int = 600          # code lifetime
    OTP_MAX_ATTEMPTS: int = 5           # wrong tries before the code is burned
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    # Anti-spam: per phone number, independent of the (CI-carrier-shared) IP.
    OTP_MAX_SENDS_PER_PHONE_HOUR: int = 3
    OTP_REDIS_PREFIX: str = 'stoudent:otp'
    # Prepended to a local number typed without its country code (07 88 ...).
    PHONE_DEFAULT_COUNTRY_CODE: str = '225'
    GOWA_URL: str = ''
    GOWA_BASIC_USER: str = ''
    GOWA_BASIC_PASS: str = ''
    GOWA_TIMEOUT: int = 20

    # Per-account brute-force guard, on top of the per-IP limit (which a
    # botnet or a shared carrier IP makes useless on its own).
    LOGIN_MAX_FAILURES: int = 8
    LOGIN_LOCK_SECONDS: int = 15 * 60
    LOGIN_FAIL_REDIS_PREFIX: str = 'stoudent:login_fail'

    # Shared resources (links): closed for the launch.
    COMMUNITY_RESOURCES_ENABLED: bool = False

    # Log
    LOG_ROOT_LEVEL: str = 'NOTSET'
    LOG_STD_FORMAT: str = (
        '<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</> | <lvl>{level: <8}</> | '
        '<cyan> {correlation_id} </> | <lvl>{message}</>'
    )
    LOG_LOGURU_FORMAT: str = (
        '<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</> | <lvl>{level: <8}</> | '
        '<cyan> {correlation_id} </> | <lvl>{message}</>'
    )
    LOG_CID_DEFAULT_VALUE: str = '-'
    LOG_CID_UUID_LENGTH: int = 32  # must <= 32
    LOG_STDOUT_LEVEL: str = 'INFO'
    LOG_STDERR_LEVEL: str = 'ERROR'
    LOG_STDOUT_FILENAME: str = 'sign_access.log'
    LOG_STDERR_FILENAME: str = 'sign_error.log'

    # Middleware
    MIDDLEWARE_CORS: bool = True
    MIDDLEWARE_ACCESS: bool = True

    # Trace ID
    TRACE_ID_REQUEST_HEADER_KEY: str = 'X-Request-ID'

    # CORS
    CORS_ALLOWED_ORIGINS: list[str] = [
        'http://localhost:3000',  # Front-end address, no trailing '/'
    ]
    CORS_EXPOSE_HEADERS: list[str] = [
        TRACE_ID_REQUEST_HEADER_KEY,
    ]

    # DateTime
    DATETIME_TIMEZONE: str = 'Africa/Abidjan'
    DATETIME_FORMAT: str = '%Y-%m-%d %H:%M:%S'

    # Request limiter
    REQUEST_LIMITER_REDIS_PREFIX: str = 'sign:limiter'

    # Demo mode (only GET, OPTIONS requests are allowed)
    DEMO_MODE: bool = False
    DEMO_MODE_EXCLUDE: set[tuple[str, str]] = {
        ('POST', f'{FASTAPI_API_V1_PATH}/auth/login'),
        ('POST', f'{FASTAPI_API_V1_PATH}/auth/logout'),
        ('GET', f'{FASTAPI_API_V1_PATH}/auth/captcha'),
    }

    # IP geolocation of requests. Default 'false' (no external call). 'online'
    # sends each client IP to ip-api.com over HTTP (privacy + latency — opt in
    # explicitly). 'offline' needs ip2region.xdb in backend/static/ (~11MB, not
    # shipped): download from https://github.com/lionsoul2014/ip2region
    IP_LOCATION_PARSE: Literal['online', 'offline', 'false'] = 'false'
    IP_LOCATION_REDIS_PREFIX: str = 'sign:ip:location'
    IP_LOCATION_EXPIRE_SECONDS: int = 60 * 60 * 24 * 1

    # Opera log
    OPERA_LOG_PATH_EXCLUDE: list[str] = [
        '/favicon.ico',
        FASTAPI_DOCS_URL,
        FASTAPI_REDOCS_URL,
        FASTAPI_OPENAPI_URL,
        f'{FASTAPI_API_V1_PATH}/auth/login/swagger',
    ]
    OPERA_LOG_ENCRYPT_TYPE: int = 1  # 0: AES; 1: md5; 2: ItsDangerous; 3: plain; other: ******
    OPERA_LOG_ENCRYPT_KEY_INCLUDE: list[str] = [  # values to encrypt in request bodies
        'password',
        'old_password',
        'new_password',
        'confirm_password',
    ]

    # ------------------------------------------------------------------
    # Transport & browser security
    # ------------------------------------------------------------------

    # Response hardening headers (see middleware/security_middleware.py).
    SECURITY_HEADERS: bool = True
    SECURITY_HSTS_SECONDS: int = 60 * 60 * 24 * 365
    # The API returns JSON and serves Swagger; the 3D client is a separate
    # origin with its own policy. 'none' for everything the API itself never
    # needs, relaxed just enough for the docs bundle.
    SECURITY_CSP: str | None = (
        "default-src 'self'; "
        "img-src 'self' data: https://fastapi.tiangolo.com; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    # Host header validation. Empty means "accept anything", which is only
    # acceptable in dev; the production-safety validator enforces that.
    TRUSTED_HOSTS: list[str] = []

    # Response compression. Signal traces are long float arrays that gzip by
    # roughly 10x, so this is the single cheapest latency win in the API.
    GZIP_ENABLED: bool = True
    GZIP_MINIMUM_SIZE: int = 1024

    # CORS: a regex is the only sane way to allow preview deployments without
    # widening the list to '*' (which is invalid with credentials anyway).
    CORS_ALLOWED_ORIGIN_REGEX: str | None = None

    # Password policy applied on registration and password changes.
    PASSWORD_MIN_LENGTH: int = 10
    PASSWORD_MAX_LENGTH: int = 128

    @model_validator(mode='after')
    def _enforce_production_safety(self) -> 'Settings':
        """Refuse to boot in a non-dev environment with insecure defaults.

        In ``dev`` everything boots out of the box for a zero-friction first
        run. In ``preprod``/``prod``, leaving a development secret or a default
        infra credential in place is a critical vulnerability (forgeable JWTs,
        world-readable storage), so fail fast with an actionable message instead
        of starting a compromised server.
        """
        if self.ENVIRONMENT == 'dev':
            return self

        insecure: list[str] = []
        if self.TOKEN_SECRET_KEY == 'dev-insecure-change-me-token-secret-key':
            insecure.append(
                'TOKEN_SECRET_KEY  '
                '(generate: python -c "import secrets; print(secrets.token_urlsafe(32))")'
            )
        if self.OPERA_LOG_ENCRYPT_SECRET_KEY == 'dev-insecure-change-me-opera-log-key':
            insecure.append(
                'OPERA_LOG_ENCRYPT_SECRET_KEY  '
                '(generate: python -c "import os; print(os.urandom(32).hex())")'
            )
        if self.POSTGRES_PASSWORD == 'postgres':
            insecure.append('POSTGRES_PASSWORD  (still the default "postgres")')
        if self.MINIO_SECRET_KEY == 'minioadmin':
            insecure.append('MINIO_SECRET_KEY  (still the default "minioadmin")')
        if not self.TRUSTED_HOSTS:
            insecure.append(
                'TRUSTED_HOSTS  (empty: the app would accept any Host header, '
                'enabling host-header poisoning of links and cache keys)'
            )
        if any(origin.startswith('http://') for origin in self.CORS_ALLOWED_ORIGINS):
            insecure.append('CORS_ALLOWED_ORIGINS  (contains a plain-http origin)')
        # COOKIE_SECURE is not checked here: auth_service already forces the
        # flag on outside dev, so a false value cannot reach the browser.

        if insecure:
            raise ValueError(
                f'ENVIRONMENT={self.ENVIRONMENT!r} but insecure development defaults '
                'are still in use:\n'
                + '\n'.join(f'  - {item}' for item in insecure)
                + '\nSet real values in your .env before deploying. '
                '(This check only runs outside dev.)'
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the cached global settings instance."""
    return Settings()


# Configuration instance
settings = get_settings()
