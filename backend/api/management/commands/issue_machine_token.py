"""Mint or revoke a machine API token for an unattended pipeline.

The secret is printed exactly once and never stored — only its SHA-256 hash.
On the machine that will use it, store it in Windows Credential Manager
(``python -m pickhaul.credentials set-platform``), never in a config file.

    python manage.py issue_machine_token --company "Finch Farms" --name "pickhaul local"
    python manage.py issue_machine_token --list
    python manage.py issue_machine_token --revoke pht_ab12cd34
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from api.models import Company, CompanyMembership, MachineApiToken, Role

SERVICE_EMAIL_TEMPLATE = 'machine-sync+{company_id}@platform.local'


class Command(BaseCommand):
    help = 'Mint or revoke a machine API token (e.g. for the pick & haul local pipeline).'

    def add_arguments(self, parser):
        parser.add_argument('--company', help='Company name (icontains match)')
        parser.add_argument('--name', help="Token label, e.g. 'pickhaul local pipeline'")
        parser.add_argument('--scope', default='pickhaul:push')
        parser.add_argument('--revoke', metavar='PREFIX',
                            help='Revoke the token whose prefix matches')
        parser.add_argument('--list', action='store_true', dest='list_tokens')

    def handle(self, *args, **options):
        if options['list_tokens']:
            return self._list()
        if options['revoke']:
            return self._revoke(options['revoke'])
        if not options['company'] or not options['name']:
            raise CommandError('Provide --company and --name to mint, or --revoke/--list.')
        return self._mint(options['company'], options['name'], options['scope'])

    # ------------------------------------------------------------------ mint --
    def _mint(self, company_name, name, scope):
        try:
            company = Company.objects.get(name__icontains=company_name)
        except Company.DoesNotExist:
            raise CommandError(f'No company matching {company_name!r}.')
        except Company.MultipleObjectsReturned:
            raise CommandError(f'Multiple companies match {company_name!r}; be more specific.')

        user = self._service_user(company)
        token, secret = MachineApiToken.mint(company, user, name, scope)

        self.stdout.write(self.style.SUCCESS(
            f'Minted token {token.token_prefix}… for {company.name} (scope {scope}).'
        ))
        self.stdout.write('')
        self.stdout.write('The secret below is shown ONCE and is not stored anywhere:')
        self.stdout.write('')
        self.stdout.write(f'    {secret}')
        self.stdout.write('')
        self.stdout.write(
            'On the pipeline machine run  python -m pickhaul.credentials set-platform  '
            'and paste it there (Windows Credential Manager). Never put it in config.toml.'
        )

    def _service_user(self, company):
        """A per-company service account so RLS middleware and audit logs work."""
        User = get_user_model()
        email = SERVICE_EMAIL_TEMPLATE.format(company_id=company.pk)
        user = User.objects.filter(email=email).first()
        if not user:
            user = User.objects.create_user(
                email=email, password=None,
                first_name='Machine', last_name='Sync',
            )
            user.set_unusable_password()
        user.current_company = company
        user.is_active = True
        user.save()

        viewer, _ = Role.objects.get_or_create(
            codename='viewer', defaults={'name': 'Viewer', 'is_system_role': True},
        )
        CompanyMembership.objects.get_or_create(
            user=user, company=company, defaults={'role': viewer, 'is_active': True},
        )
        return user

    # ---------------------------------------------------------------- revoke --
    def _revoke(self, prefix):
        tokens = MachineApiToken.objects.filter(token_prefix__startswith=prefix,
                                                revoked_at__isnull=True)
        if not tokens.exists():
            raise CommandError(f'No active token with prefix {prefix!r}.')
        count = tokens.update(revoked_at=timezone.now())
        self.stdout.write(self.style.SUCCESS(f'Revoked {count} token(s).'))

    # ------------------------------------------------------------------ list --
    def _list(self):
        rows = MachineApiToken.objects.select_related('company').order_by('company', '-created_at')
        if not rows:
            self.stdout.write('No machine tokens.')
            return
        for t in rows:
            state = 'REVOKED' if t.revoked_at else 'active'
            last = t.last_used_at.strftime('%Y-%m-%d %H:%M') if t.last_used_at else 'never'
            self.stdout.write(
                f'{t.token_prefix:14s} {t.company.name:20s} {t.scope:16s} '
                f'{state:8s} last used {last}  {t.name}'
            )
