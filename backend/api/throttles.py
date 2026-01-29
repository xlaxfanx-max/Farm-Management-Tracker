# =============================================================================
# CUSTOM THROTTLING CLASSES
# =============================================================================
#
# Rate limiting for authentication endpoints to prevent brute force attacks.
#

from rest_framework.throttling import AnonRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    """
    Strict rate limiting for authentication endpoints.

    Applies to:
    - Login attempts
    - Registration
    - Password reset requests

    Default: 5 requests per minute per IP address.
    """
    scope = 'auth'


class PasswordResetThrottle(AnonRateThrottle):
    """
    Very strict rate limiting for password reset requests.

    Prevents email enumeration and spam.
    Default: 3 requests per hour per IP address.
    """
    scope = 'password_reset'
    rate = '3/hour'
