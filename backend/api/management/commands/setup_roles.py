"""
Management command to create default roles and permissions.
Run with: python manage.py setup_roles
"""

from django.core.management.base import BaseCommand
from api.models import Role, Permission


class Command(BaseCommand):
    help = 'Creates default roles and permissions for the application'

    def handle(self, *args, **options):
        self.stdout.write('Setting up roles and permissions...')

        # Define permissions
        permissions_data = [
            # Farms & Fields
            {'codename': 'view_farms', 'name': 'View Farms', 'category': 'farms', 'description': 'Can view farms and fields'},
            {'codename': 'manage_farms', 'name': 'Manage Farms', 'category': 'farms', 'description': 'Can create, edit, delete farms and fields'},

            # Applications
            {'codename': 'view_applications', 'name': 'View Applications', 'category': 'applications', 'description': 'Can view pesticide applications'},
            {'codename': 'create_applications', 'name': 'Create Applications', 'category': 'applications', 'description': 'Can create pesticide applications'},
            {'codename': 'manage_applications', 'name': 'Manage Applications', 'category': 'applications', 'description': 'Can edit and delete applications'},

            # Harvests
            {'codename': 'view_harvests', 'name': 'View Harvests', 'category': 'harvests', 'description': 'Can view harvest records'},
            {'codename': 'manage_harvests', 'name': 'Manage Harvests', 'category': 'harvests', 'description': 'Can create, edit, delete harvests'},

            # Water
            {'codename': 'view_water', 'name': 'View Water Data', 'category': 'water', 'description': 'Can view water sources and tests'},
            {'codename': 'manage_water', 'name': 'Manage Water Data', 'category': 'water', 'description': 'Can manage water sources and tests'},

            # Reports
            {'codename': 'view_reports', 'name': 'View Reports', 'category': 'reports', 'description': 'Can view reports'},
            {'codename': 'export_reports', 'name': 'Export Reports', 'category': 'reports', 'description': 'Can export reports'},

            # Users
            {'codename': 'view_users', 'name': 'View Users', 'category': 'users', 'description': 'Can view team members'},
            {'codename': 'invite_users', 'name': 'Invite Users', 'category': 'users', 'description': 'Can invite new team members'},
            {'codename': 'manage_users', 'name': 'Manage Users', 'category': 'users', 'description': 'Can change roles and remove users'},

            # Settings
            {'codename': 'view_settings', 'name': 'View Settings', 'category': 'settings', 'description': 'Can view company settings'},
            {'codename': 'manage_settings', 'name': 'Manage Settings', 'category': 'settings', 'description': 'Can modify company settings'},
        ]

        # Create permissions
        permissions = {}
        for perm_data in permissions_data:
            perm, created = Permission.objects.get_or_create(
                codename=perm_data['codename'],
                defaults={
                    'name': perm_data['name'],
                    'category': perm_data['category'],
                    'description': perm_data['description'],
                }
            )
            permissions[perm_data['codename']] = perm
            if created:
                self.stdout.write(f'  Created permission: {perm.name}')

        # Define roles with their permissions
        roles_data = [
            {
                'codename': 'owner',
                'name': 'Owner',
                'description': 'Full access to all features including billing and company management',
                'permissions': list(permissions.keys()),  # All permissions
            },
            {
                'codename': 'admin',
                'name': 'Administrator',
                'description': 'Full operational access, can manage users and settings',
                'permissions': [
                    'view_farms', 'manage_farms',
                    'view_applications', 'create_applications', 'manage_applications',
                    'view_harvests', 'manage_harvests',
                    'view_water', 'manage_water',
                    'view_reports', 'export_reports',
                    'view_users', 'invite_users', 'manage_users',
                    'view_settings', 'manage_settings',
                ],
            },
            {
                'codename': 'manager',
                'name': 'Farm Manager',
                'description': 'Day-to-day operations management, can invite users',
                'permissions': [
                    'view_farms', 'manage_farms',
                    'view_applications', 'create_applications', 'manage_applications',
                    'view_harvests', 'manage_harvests',
                    'view_water', 'manage_water',
                    'view_reports', 'export_reports',
                    'view_users', 'invite_users',
                    'view_settings',
                ],
            },
            {
                'codename': 'applicator',
                'name': 'Certified Applicator',
                'description': 'Can record and sign pesticide applications',
                'permissions': [
                    'view_farms',
                    'view_applications', 'create_applications',
                    'view_harvests',
                    'view_water',
                    'view_reports',
                ],
            },
            {
                'codename': 'worker',
                'name': 'Field Worker',
                'description': 'Basic access to view farms and record work',
                'permissions': [
                    'view_farms',
                    'view_applications',
                    'view_harvests',
                ],
            },
            {
                'codename': 'viewer',
                'name': 'View Only',
                'description': 'Read-only access to all operational data',
                'permissions': [
                    'view_farms',
                    'view_applications',
                    'view_harvests',
                    'view_water',
                    'view_reports',
                ],
            },
            {
                'codename': 'pca',
                'name': 'Pest Control Advisor',
                'description': 'Can view data and create recommendations',
                'permissions': [
                    'view_farms',
                    'view_applications', 'create_applications',
                    'view_harvests',
                    'view_water',
                    'view_reports', 'export_reports',
                ],
            },
            {
                'codename': 'accountant',
                'name': 'Accountant',
                'description': 'Access to financial and reporting data',
                'permissions': [
                    'view_farms',
                    'view_harvests',
                    'view_reports', 'export_reports',
                ],
            },
        ]

        # Create roles
        for role_data in roles_data:
            role, created = Role.objects.get_or_create(
                codename=role_data['codename'],
                defaults={
                    'name': role_data['name'],
                    'description': role_data['description'],
                    'is_system_role': True,
                }
            )

            # Update permissions
            role_permissions = [permissions[p] for p in role_data['permissions'] if p in permissions]
            role.permissions.set(role_permissions)

            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created role: {role.name}'))
            else:
                self.stdout.write(f'  Updated role: {role.name}')

        self.stdout.write(self.style.SUCCESS('\nRoles and permissions setup complete!'))
        self.stdout.write(f'  Total permissions: {Permission.objects.count()}')
        self.stdout.write(f'  Total roles: {Role.objects.count()}')
