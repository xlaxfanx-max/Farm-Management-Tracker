"""
Custom JWT Authentication using HttpOnly cookies.

Reads JWT access tokens from HttpOnly cookies instead of the Authorization header.
Falls back to the Authorization header for backward compatibility (e.g., mobile clients).
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings


# Cookie names
ACCESS_COOKIE_NAME = 'access_token'
REFRESH_COOKIE_NAME = 'refresh_token'


class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT authentication that reads from HttpOnly cookies first,
    then falls back to the Authorization header.
    """

    def authenticate(self, request):
        # Try cookie first
        raw_token = request.COOKIES.get(ACCESS_COOKIE_NAME)
        if raw_token:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token

        # Fall back to Authorization header (for backward compatibility)
        return super().authenticate(request)


def set_auth_cookies(response, access_token, refresh_token=None):
    """
    Set HttpOnly, Secure cookies for JWT tokens on a response.

    Args:
        response: DRF Response object
        access_token: JWT access token string
        refresh_token: JWT refresh token string (optional)
    """
    secure = not settings.DEBUG  # Secure=True in production (HTTPS)
    samesite = 'Lax'

    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=str(access_token),
        max_age=int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path='/',
    )

    if refresh_token:
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=str(refresh_token),
            max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            httponly=True,
            secure=secure,
            samesite=samesite,
            path='/api/auth/',  # Only sent to auth endpoints
        )


def clear_auth_cookies(response):
    """Remove auth cookies from the response."""
    response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/api/auth/')
