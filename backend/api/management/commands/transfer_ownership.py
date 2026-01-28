"""
Management command to transfer company ownership from one user to another.

Usage:
    python manage.py transfer_ownership --from=old@email.com --to=new@email.com [--company=company_id]

If --company is not specified and there's only one company, it will use that.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import User, Company, CompanyMembership, Role


class Command(BaseCommand):
    help = 'Transfer company ownership from one user to another'

    def add_arguments(self, parser):
        parser.add_argument(
            '--from',
            dest='from_email',
            required=True,
            help='Email of the current owner'
        )
        parser.add_argument(
            '--to',
            dest='to_email',
            required=True,
            help='Email of the new owner'
        )
        parser.add_argument(
            '--company',
            dest='company_id',
            type=int,
            help='Company ID (optional if only one company exists)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would happen without making changes'
        )

    def handle(self, *args, **options):
        from_email = options['from_email']
        to_email = options['to_email']
        company_id = options.get('company_id')
        dry_run = options['dry_run']

        # Get the owner role
        try:
            owner_role = Role.objects.get(codename='owner')
        except Role.DoesNotExist:
            raise CommandError("Owner role doesn't exist. Run setup_roles first.")

        # Get the admin role (what the old owner will become)
        try:
            admin_role = Role.objects.get(codename='admin')
        except Role.DoesNotExist:
            raise CommandError("Admin role doesn't exist. Run setup_roles first.")

        # Get the current owner user
        try:
            from_user = User.objects.get(email=from_email)
        except User.DoesNotExist:
            raise CommandError(f"User with email '{from_email}' not found.")

        # Get the new owner user
        try:
            to_user = User.objects.get(email=to_email)
        except User.DoesNotExist:
            raise CommandError(f"User with email '{to_email}' not found.")

        # Determine which company
        if company_id:
            try:
                company = Company.objects.get(id=company_id)
            except Company.DoesNotExist:
                raise CommandError(f"Company with ID {company_id} not found.")
        else:
            # Try to find the company where from_user is owner
            owner_memberships = CompanyMembership.objects.filter(
                user=from_user,
                role=owner_role
            ).select_related('company')

            if owner_memberships.count() == 0:
                raise CommandError(f"User '{from_email}' is not an owner of any company.")
            elif owner_memberships.count() > 1:
                companies = [m.company for m in owner_memberships]
                company_list = "\n".join([f"  - ID {c.id}: {c.name}" for c in companies])
                raise CommandError(
                    f"User '{from_email}' owns multiple companies. "
                    f"Please specify --company=ID:\n{company_list}"
                )
            else:
                company = owner_memberships.first().company

        self.stdout.write(f"\nCompany: {company.name} (ID: {company.id})")
        self.stdout.write(f"Current owner: {from_user.email}")
        self.stdout.write(f"New owner: {to_user.email}")

        # Verify current owner membership
        try:
            from_membership = CompanyMembership.objects.get(
                user=from_user,
                company=company
            )
        except CompanyMembership.DoesNotExist:
            raise CommandError(f"User '{from_email}' is not a member of company '{company.name}'.")

        if from_membership.role != owner_role:
            raise CommandError(
                f"User '{from_email}' is not the owner of '{company.name}'. "
                f"Their role is: {from_membership.role.name}"
            )

        # Check if new owner is already a member
        try:
            to_membership = CompanyMembership.objects.get(
                user=to_user,
                company=company
            )
            to_user_exists = True
            self.stdout.write(f"New owner's current role: {to_membership.role.name}")
        except CompanyMembership.DoesNotExist:
            to_user_exists = False
            self.stdout.write("New owner is not currently a member (will be added)")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] No changes made."))
            self.stdout.write("Would do the following:")
            self.stdout.write(f"  1. Change {from_email}'s role from 'owner' to 'admin'")
            if to_user_exists:
                self.stdout.write(f"  2. Change {to_email}'s role from '{to_membership.role.name}' to 'owner'")
            else:
                self.stdout.write(f"  2. Add {to_email} as 'owner' of the company")
            return

        # Perform the transfer
        with transaction.atomic():
            # Change old owner to admin
            from_membership.role = admin_role
            from_membership.save()
            self.stdout.write(f"  ✓ Changed {from_email} from owner to admin")

            # Change or create new owner membership
            if to_user_exists:
                to_membership.role = owner_role
                to_membership.save()
                self.stdout.write(f"  ✓ Changed {to_email} to owner")
            else:
                CompanyMembership.objects.create(
                    user=to_user,
                    company=company,
                    role=owner_role,
                    is_active=True
                )
                self.stdout.write(f"  ✓ Added {to_email} as owner")

        self.stdout.write(self.style.SUCCESS(f"\n✓ Ownership transferred successfully!"))
        self.stdout.write(f"  New owner: {to_user.email}")
        self.stdout.write(f"  Previous owner ({from_user.email}) is now an admin")
