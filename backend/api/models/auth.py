import uuid

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone


# =============================================================================
# CUSTOM USER MANAGER
# =============================================================================

class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Users must have an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

# =============================================================================
# COMPANY (ORGANIZATION/TENANT) MODEL
# =============================================================================

class Company(models.Model):
    """
    Represents a farming company/organization - the top-level tenant.
    A company can have multiple farms and multiple users.

    Examples:
    - "Smith Family Farms LLC"
    - "Central Valley Citrus Inc."
    - "Johnson Agricultural Services"
    """

    SUBSCRIPTION_TIERS = [
        ('free', 'Free Trial'),
        ('starter', 'Starter'),
        ('professional', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]

    # California counties list for validation/choices
    CALIFORNIA_COUNTIES = [
        ('alameda', 'Alameda'), ('alpine', 'Alpine'), ('amador', 'Amador'),
        ('butte', 'Butte'), ('calaveras', 'Calaveras'), ('colusa', 'Colusa'),
        ('contra_costa', 'Contra Costa'), ('del_norte', 'Del Norte'),
        ('el_dorado', 'El Dorado'), ('fresno', 'Fresno'), ('glenn', 'Glenn'),
        ('humboldt', 'Humboldt'), ('imperial', 'Imperial'), ('inyo', 'Inyo'),
        ('kern', 'Kern'), ('kings', 'Kings'), ('lake', 'Lake'), ('lassen', 'Lassen'),
        ('los_angeles', 'Los Angeles'), ('madera', 'Madera'), ('marin', 'Marin'),
        ('mariposa', 'Mariposa'), ('mendocino', 'Mendocino'), ('merced', 'Merced'),
        ('modoc', 'Modoc'), ('mono', 'Mono'), ('monterey', 'Monterey'),
        ('napa', 'Napa'), ('nevada', 'Nevada'), ('orange', 'Orange'),
        ('placer', 'Placer'), ('plumas', 'Plumas'), ('riverside', 'Riverside'),
        ('sacramento', 'Sacramento'), ('san_benito', 'San Benito'),
        ('san_bernardino', 'San Bernardino'), ('san_diego', 'San Diego'),
        ('san_francisco', 'San Francisco'), ('san_joaquin', 'San Joaquin'),
        ('san_luis_obispo', 'San Luis Obispo'), ('san_mateo', 'San Mateo'),
        ('santa_barbara', 'Santa Barbara'), ('santa_clara', 'Santa Clara'),
        ('santa_cruz', 'Santa Cruz'), ('shasta', 'Shasta'), ('sierra', 'Sierra'),
        ('siskiyou', 'Siskiyou'), ('solano', 'Solano'), ('sonoma', 'Sonoma'),
        ('stanislaus', 'Stanislaus'), ('sutter', 'Sutter'), ('tehama', 'Tehama'),
        ('trinity', 'Trinity'), ('tulare', 'Tulare'), ('tuolumne', 'Tuolumne'),
        ('ventura', 'Ventura'), ('yolo', 'Yolo'), ('yuba', 'Yuba'),
    ]

    # Unique identifier for API/external references
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    # Company Information
    name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=200, blank=True, null=True,
        help_text="Legal business name if different from display name")

    # Contact Information
    primary_contact_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    # Address
    address = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    county = models.CharField(
        max_length=50,
        blank=True,
        help_text="California county - determines County Ag Commissioner for PUR reporting"
    )
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)

    # Business Details (for PUR reporting)
    operator_id = models.CharField(max_length=50, blank=True,
        help_text="California DPR Operator ID Number")
    business_license = models.CharField(max_length=50, blank=True)

    # ==========================================================================
    # NEW: Additional Regulatory IDs for California Compliance
    # ==========================================================================
    pca_license = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="PCA License",
        help_text="Pest Control Advisor license number"
    )
    qal_license = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="QAL License",
        help_text="Qualified Applicator License number"
    )
    qac_license = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="QAC License",
        help_text="Qualified Applicator Certificate number"
    )

    # Optional business identifiers
    federal_tax_id = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="Federal Tax ID",
        help_text="EIN/Federal Tax ID (optional, for internal records)"
    )
    state_tax_id = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="State Tax ID",
        help_text="CA State Tax ID (optional)"
    )

    # Website and notes
    website = models.URLField(blank=True, help_text="Company website URL")
    notes = models.TextField(blank=True, help_text="Internal notes about the company")

    # Subscription/Billing
    subscription_tier = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_TIERS,
        default='free'
    )
    subscription_start = models.DateField(null=True, blank=True)
    subscription_end = models.DateField(null=True, blank=True)

    # Limits based on subscription tier
    max_farms = models.IntegerField(default=3,
        help_text="Maximum farms allowed for this subscription")
    max_users = models.IntegerField(default=5,
        help_text="Maximum users allowed for this subscription")

    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # =========================================================================
    # ONBOARDING TRACKING
    # =========================================================================
    ONBOARDING_STEPS = [
        ('company_info', 'Company Info'),
        ('boundary', 'Farm Boundary'),
        ('fields', 'Fields'),
        ('water', 'Water Sources'),
        ('complete', 'Complete'),
        ('skipped', 'Skipped'),
    ]

    onboarding_completed = models.BooleanField(
        default=False,
        help_text="Whether the company has completed initial setup"
    )
    onboarding_step = models.CharField(
        max_length=50,
        choices=ONBOARDING_STEPS,
        default='company_info',
        help_text="Current step in the onboarding process"
    )
    onboarding_completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When onboarding was completed"
    )

    # Company profile - useful for SaaS tiers
    primary_crop = models.CharField(
        max_length=50,
        blank=True,
        help_text="Primary crop type for this company"
    )
    estimated_total_acres = models.IntegerField(
        null=True,
        blank=True,
        help_text="Estimated total acreage across all farms"
    )

    class Meta:
        verbose_name_plural = "Companies"
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def farm_count(self):
        return self.farms.filter(active=True).count()

    @property
    def user_count(self):
        return self.memberships.filter(is_active=True).count()

    @property
    def county_display(self):
        """Return formatted county name for display."""
        if self.county:
            # Convert stored value to display name
            for code, name in self.CALIFORNIA_COUNTIES:
                if code == self.county.lower().replace(' ', '_'):
                    return name
            # If not found in choices, return as-is (for legacy data)
            return self.county
        return ""

    def can_add_farm(self):
        """Check if company can add another farm based on subscription."""
        return self.farm_count < self.max_farms

    def can_add_user(self):
        """Check if company can add another user based on subscription."""
        return self.user_count < self.max_users

    def complete_onboarding(self):
        """Mark onboarding as complete."""
        self.onboarding_completed = True
        self.onboarding_step = 'complete'
        self.onboarding_completed_at = timezone.now()
        self.save(update_fields=['onboarding_completed', 'onboarding_step', 'onboarding_completed_at'])

    def skip_onboarding(self):
        """Mark onboarding as skipped."""
        self.onboarding_completed = True
        self.onboarding_step = 'skipped'
        self.onboarding_completed_at = timezone.now()
        self.save(update_fields=['onboarding_completed', 'onboarding_step', 'onboarding_completed_at'])

    def reset_onboarding(self):
        """Reset onboarding state."""
        self.onboarding_completed = False
        self.onboarding_step = 'company_info'
        self.onboarding_completed_at = None
        self.save(update_fields=['onboarding_completed', 'onboarding_step', 'onboarding_completed_at'])

# =============================================================================
# CUSTOM USER MODEL
# =============================================================================

class User(AbstractUser):
    """
    Custom user model with email as the primary identifier.
    Users can belong to multiple companies with different roles.
    """

    # Remove username, use email instead
    username = None
    email = models.EmailField('email address', unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []  # Email & password are required by default

    objects = UserManager()

    # Profile Information
    phone = models.CharField(max_length=20, blank=True)
    job_title = models.CharField(max_length=100, blank=True)

    # Certifications (for applicators)
    applicator_license = models.CharField(max_length=50, blank=True,
        help_text="CA Qualified Applicator License number")
    license_expiration = models.DateField(null=True, blank=True)
    pca_license = models.CharField(max_length=50, blank=True,
        help_text="Pest Control Advisor license number")

    # Current active company (for users in multiple companies)
    current_company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_users'
    )

    # Preferences
    timezone = models.CharField(max_length=50, default='America/Los_Angeles')

    # Timestamps
    last_activity = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['email']

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_companies(self):
        """Get all companies this user belongs to."""
        return Company.objects.filter(
            memberships__user=self,
            memberships__is_active=True
        )

    def get_role_in_company(self, company):
        """Get user's role in a specific company."""
        try:
            membership = self.company_memberships.get(company=company, is_active=True)
            return membership.role
        except CompanyMembership.DoesNotExist:
            return None

    def has_permission(self, permission_codename, company=None):
        """Check if user has a specific permission in their current/specified company."""
        if self.is_superuser:
            return True

        company = company or self.current_company
        if not company:
            return False

        try:
            membership = self.company_memberships.get(company=company, is_active=True)
            return membership.role.permissions.filter(codename=permission_codename).exists()
        except CompanyMembership.DoesNotExist:
            return False


# =============================================================================
# ROLE MODEL
# =============================================================================

class Role(models.Model):
    """
    Defines roles that can be assigned to users within a company.
    Each role has a set of permissions.
    """

    # Predefined system roles
    SYSTEM_ROLES = [
        ('owner', 'Owner'),
        ('admin', 'Administrator'),
        ('manager', 'Farm Manager'),
        ('applicator', 'Certified Applicator'),
        ('worker', 'Field Worker'),
        ('viewer', 'View Only'),
        ('pca', 'Pest Control Advisor'),
        ('accountant', 'Accountant'),
    ]

    name = models.CharField(max_length=50)
    codename = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    # If True, this is a system-defined role that can't be deleted
    is_system_role = models.BooleanField(default=False)

    # Permissions assigned to this role
    permissions = models.ManyToManyField(
        'Permission',
        related_name='roles',
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# =============================================================================
# PERMISSION MODEL
# =============================================================================

class Permission(models.Model):
    """
    Granular permissions for controlling access to features.
    """

    PERMISSION_CATEGORIES = [
        ('farms', 'Farms & Fields'),
        ('applications', 'Pesticide Applications'),
        ('harvests', 'Harvests'),
        ('water', 'Water Quality'),
        ('reports', 'Reports'),
        ('users', 'User Management'),
        ('settings', 'Settings'),
    ]

    name = models.CharField(max_length=100)
    codename = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=PERMISSION_CATEGORIES)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.category}: {self.name}"


# =============================================================================
# COMPANY MEMBERSHIP (User <-> Company relationship)
# =============================================================================

class CompanyMembership(models.Model):
    """
    Through table connecting Users to Companies with their role.
    A user can be a member of multiple companies with different roles.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='company_memberships'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='memberships'
    )

    # Invitation tracking
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_invitations'
    )
    invited_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)

    # Optional: Restrict user to specific farms within the company
    # If empty, user has access to all farms in the company
    allowed_farms = models.ManyToManyField(
        'Farm',
        blank=True,
        related_name='allowed_members',
        help_text="If set, restricts user to only these farms"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'company']
        ordering = ['company', 'user']

    def __str__(self):
        return f"{self.user.email} - {self.company.name} ({self.role.name})"


# =============================================================================
# INVITATION MODEL (for inviting new users)
# =============================================================================

class Invitation(models.Model):
    """
    Pending invitations for users who haven't registered yet.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
    ]

    email = models.EmailField()
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='invitations'
    )

    # Invitation token (sent in email link)
    token = models.UUIDField(default=uuid.uuid4, unique=True)

    # Who sent the invitation
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='invitations_sent'
    )

    # Personal message from inviter
    message = models.TextField(blank=True)

    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    expires_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation to {self.email} for {self.company.name}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def save(self, *args, **kwargs):
        # Set default expiration to 7 days from creation
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(days=7)
        super().save(*args, **kwargs)


# =============================================================================
# PASSWORD RESET TOKEN MODEL
# =============================================================================

class PasswordResetToken(models.Model):
    """
    Stores password reset tokens in the database for reliable persistence.
    Tokens expire after 24 hours.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Password reset for {self.user.email}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.used and not self.is_expired

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        super().save(*args, **kwargs)

    @classmethod
    def create_for_user(cls, user):
        """Create a new reset token for a user, invalidating any existing ones."""
        import secrets
        # Mark old tokens as used
        cls.objects.filter(user=user, used=False).update(used=True)
        # Create new token
        token = secrets.token_urlsafe(32)
        return cls.objects.create(user=user, token=token)

    @classmethod
    def get_valid_token(cls, token):
        """Get a valid (unused, not expired) token or None."""
        try:
            reset_token = cls.objects.select_related('user').get(token=token)
            if reset_token.is_valid:
                return reset_token
        except cls.DoesNotExist:
            pass
        return None


# =============================================================================
# AUDIT LOG MODEL
# =============================================================================

class AuditLog(models.Model):
    """
    Tracks important actions for compliance and security.
    """

    ACTION_TYPES = [
        ('create', 'Created'),
        ('update', 'Updated'),
        ('delete', 'Deleted'),
        ('login', 'Logged In'),
        ('logout', 'Logged Out'),
        ('export', 'Exported Data'),
        ('submit', 'Submitted Report'),
        ('invite', 'Sent Invitation'),
        ('invite_accept', 'Accepted Invitation'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )

    action = models.CharField(max_length=20, choices=ACTION_TYPES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=50, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)

    # JSON field for storing changes
    changes = models.JSONField(default=dict, blank=True)

    # Request metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['company', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['model_name', 'object_id']),
        ]

    def __str__(self):
        return f"{self.user} {self.action} {self.model_name} at {self.timestamp}"
