"""Machine-token authentication for unattended pushes.

The platform's human auth is cookie-JWT with 60-minute access tokens — unusable
for a scheduled task on another machine. A :class:`~api.models.MachineApiToken`
is the machine counterpart: long-lived, revocable, scope-limited, and stored
only as a hash.

The containment model is deliberate: only the pick & haul sync view lists
``MachineTokenAuthentication`` in its ``authentication_classes``, so a machine
token is useless against every other endpoint — and because that view lists
nothing else, a human's JWT cookie cannot push. The token authenticates as a
service User whose ``current_company`` is set, which keeps the RLS middleware
and audit logging working unmodified.
"""

import hashlib

from django.utils import timezone
from rest_framework import authentication, exceptions, permissions

from .models import MachineApiToken


class MachineTokenAuthentication(authentication.BaseAuthentication):
    """``Authorization: Token pht_<secret>`` → (service user, MachineApiToken)."""

    keyword = 'Token'

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode('utf-8', 'ignore')
        if not header:
            return None
        parts = header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            return None
        secret = parts[1]
        if not secret.startswith('pht_'):
            return None

        token_hash = hashlib.sha256(secret.encode()).hexdigest()
        try:
            token = MachineApiToken.objects.select_related('user', 'company').get(
                token_hash=token_hash
            )
        except MachineApiToken.DoesNotExist:
            raise exceptions.AuthenticationFailed('Invalid machine token.')

        if token.revoked_at is not None:
            raise exceptions.AuthenticationFailed('Machine token has been revoked.')

        MachineApiToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword


class HasMachineScope(permissions.BasePermission):
    """Requires the request to be machine-token authenticated with the view's scope.

    Usage:
        permission_classes = [HasMachineScope]
        required_scope = 'pickhaul:push'
    """

    message = 'A machine token with the required scope is needed.'

    def has_permission(self, request, view):
        token = getattr(request, 'auth', None)
        if not isinstance(token, MachineApiToken):
            return False
        required = getattr(view, 'required_scope', None)
        return required is None or token.scope == required
