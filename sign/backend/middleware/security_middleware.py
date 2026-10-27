"""Response security headers.

These headers cost nothing and remove whole classes of browser-side attack from
the table. They are applied on the API responses as well as the ones served by
the interactive docs, which is where a stray inline script would actually run.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.core.conf import settings


# Swagger UI and ReDoc bootstrap themselves from an inline <script> block and
# ReDoc spawns a blob: worker. The strict API policy blocks both, which renders
# the docs as a blank page - so those two paths get their own, narrower
# exception instead of weakening the policy everywhere.
_DOCS_CSP = (
    "default-src 'self'; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; "
    "worker-src 'self' blob:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


def _is_docs_path(path: str) -> bool:
    return path.endswith(('/docs', '/redocs', '/redoc', '/docs/oauth2-redirect'))


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add the standard hardening headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Never let a browser guess a JSON body is HTML and execute it.
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        # The API is not meant to be framed; the 3D client is same-origin.
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        # No API endpoint needs a camera, a microphone or geolocation.
        response.headers.setdefault(
            'Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()'
        )
        response.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
        response.headers.setdefault('Cross-Origin-Resource-Policy', 'same-site')

        if settings.SECURITY_CSP:
            policy = _DOCS_CSP if _is_docs_path(request.url.path) else settings.SECURITY_CSP
            response.headers.setdefault('Content-Security-Policy', policy)

        # HSTS only makes sense once traffic is actually HTTPS; sending it from
        # a dev server over http would lock developers out of localhost.
        if settings.ENVIRONMENT != 'dev':
            response.headers.setdefault(
                'Strict-Transport-Security',
                f'max-age={settings.SECURITY_HSTS_SECONDS}; includeSubDomains',
            )

        return response
