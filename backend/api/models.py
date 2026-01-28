from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone
import uuid
from decimal import Decimal
import requests


# =============================================================================
# HELPER FUNCTIONS FOR MODEL DEFAULTS
# =============================================================================

def default_deadline_reminder_days():
    """Default days before deadline to send reminders."""
    return [30, 14, 7, 1]


def default_license_reminder_days():
    """Default days before license expiration to send reminders."""
    return [90, 60, 30, 14]


# =============================================================================
# LOCATION MIXIN (GPS + PLSS Abstract Base Class)
# =============================================================================

class LocationMixin(models.Model):
    """
    Abstract base class providing GPS and PLSS (Public Land Survey System) fields.
    Used by: Farm, Field, WaterSource
    """
    
    # GPS Coordinates
    gps_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        verbose_name="Latitude",
        help_text="GPS latitude coordinate (e.g., 34.428500)"
    )
    gps_longitude = models.DecimalField(
        max_digits=10, 
        decimal_places=7, 
        null=True, 
        blank=True,
        verbose_name="Longitude",
        help_text="GPS longitude coordinate (e.g., -119.229000)"
    )
    
    # PLSS (Public Land Survey System) - Required for California PUR reports
    plss_section = models.CharField(
        max_length=10, 
        blank=True,
        verbose_name="Section",
        help_text="Section number (1-36)"
    )
    plss_township = models.CharField(
        max_length=10, 
        blank=True,
        verbose_name="Township",
        help_text="Township (e.g., '4N' for Township 4 North)"
    )
    plss_range = models.CharField(
        max_length=10, 
        blank=True,
        verbose_name="Range",
        help_text="Range (e.g., '22W' for Range 22 West)"
    )
    plss_meridian = models.CharField(
        max_length=50, 
        blank=True, 
        default='San Bernardino',
        verbose_name="Meridian",
        help_text="Base meridian (San Bernardino for Southern CA)"
    )
    
    class Meta:
        abstract = True
    
    @property
    def has_coordinates(self):
        """Check if GPS coordinates are set."""
        return self.gps_latitude is not None and self.gps_longitude is not None
    
    @property
    def has_plss(self):
        """Check if PLSS data is complete."""
        return bool(self.plss_section and self.plss_township and self.plss_range)
    
    @property
    def coordinates_tuple(self):
        """Return coordinates as (lat, lng) tuple or None."""
        if self.has_coordinates:
            return (float(self.gps_latitude), float(self.gps_longitude))
        return None
    
    @property
    def plss_display(self):
        """Format PLSS as human-readable string for PUR reports."""
        if self.has_plss:
            return f"Sec {self.plss_section}, T{self.plss_township}, R{self.plss_range}, {self.plss_meridian} M"
        return ""
    
    def lookup_plss_from_coordinates(self, save=True):
        """
        Call BLM PLSS service to populate PLSS fields from GPS coordinates.
        """
        if not self.has_coordinates:
            return None
        
        try:
            url = "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/identify"
            params = {
                'geometry': f'{self.gps_longitude},{self.gps_latitude}',
                'geometryType': 'esriGeometryPoint',
                'sr': '4326',
                'layers': 'all',
                'tolerance': '1',
                'mapExtent': f'{float(self.gps_longitude)-0.01},{float(self.gps_latitude)-0.01},{float(self.gps_longitude)+0.01},{float(self.gps_latitude)+0.01}',
                'imageDisplay': '100,100,96',
                'returnGeometry': 'false',
                'f': 'json'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            for result in data.get('results', []):
                attrs = result.get('attributes', {})
                if 'FRSTDIVNO' in attrs:
                    self.plss_section = str(attrs.get('FRSTDIVNO', ''))
                    self.plss_township = str(attrs.get('TWNSHPNO', '')) + attrs.get('TWNSHPDIR', '')
                    self.plss_range = str(attrs.get('RANGENO', '')) + attrs.get('RANGEDIR', '')
                    self.plss_meridian = attrs.get('PRINESSION', 'San Bernardino')
                    
                    if save:
                        self.save(update_fields=['plss_section', 'plss_township', 'plss_range', 'plss_meridian'])
                    
                    return {
                        'section': self.plss_section,
                        'township': self.plss_township,
                        'range': self.plss_range,
                        'meridian': self.plss_meridian
                    }
            return None
        except Exception as e:
            print(f"PLSS lookup failed: {e}")
            return None


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


class Farm(LocationMixin, models.Model):
    """
    Farm/Ranch information.
    Inherits GPS/PLSS fields from LocationMixin.
    """
    name = models.CharField(max_length=200)
    farm_number = models.CharField(max_length=50, blank=True, help_text="Internal farm ID or permit number")
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='farms',
        null=True,
        blank=True
    )

    # Owner/Operator information
    owner_name = models.CharField(max_length=200, blank=True)
    operator_name = models.CharField(max_length=200, blank=True)
    
    # Primary location
    address = models.TextField(blank=True)
    county = models.CharField(max_length=100)
    
    # NOTE: GPS fields (gps_latitude, gps_longitude) and PLSS fields
    # (plss_section, plss_township, plss_range, plss_meridian) 
    # are inherited from LocationMixin
    
    # Contact info
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    # FSMA Environmental Factors
    nearest_animal_operation_ft = models.IntegerField(
        null=True,
        blank=True,
        help_text="Distance to nearest animal operation in feet"
    )
    adjacent_land_uses = models.JSONField(
        default=list,
        blank=True,
        help_text="List of adjacent/nearby land uses for FSMA assessment"
    )
    flooding_history = models.BooleanField(
        default=False,
        help_text="Has this farm experienced flooding in production areas?"
    )
    septic_nearby = models.BooleanField(
        null=True,
        blank=True,
        help_text="Are septic systems located near production areas?"
    )

    # Status
    active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def apn_list(self):
        """Returns a comma-separated string of all APNs."""
        return ', '.join(self.parcels.values_list('apn', flat=True))

    @property
    def total_parcel_acreage(self):
        """Sum of all parcel acreages."""
        result = self.parcels.aggregate(total=models.Sum('acreage'))
        return result['total'] or Decimal('0')

    @property
    def parcel_count(self):
        """Number of parcels."""
        return self.parcels.count()
    
class FarmParcel(models.Model):
    """
    Assessor Parcel Numbers (APNs) associated with a farm.
    A farm can span multiple parcels, each with its own APN.
    """
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        related_name='parcels'
    )
    apn = models.CharField(
        max_length=50,
        verbose_name="Assessor Parcel Number",
        help_text="County assessor parcel number (e.g., 123-0-456-789)"
    )
    acreage = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Acreage of this parcel"
    )
    ownership_type = models.CharField(
        max_length=20,
        choices=[
            ('owned', 'Owned'),
            ('leased', 'Leased'),
            ('managed', 'Managed'),
        ],
        default='owned'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Farm Parcel"
        verbose_name_plural = "Farm Parcels"
        unique_together = ['farm', 'apn']
        ordering = ['apn']

    def __str__(self):
        return f"{self.farm.name} - APN: {self.apn}"

    @staticmethod
    def format_apn(apn_string, county=None):
        """Format APN based on county conventions."""
        if not apn_string:
            return ''
        digits = ''.join(filter(str.isdigit, apn_string))
        
        # Ventura County: XXX-X-XXX-XXX (10 digits)
        if county and county.lower() == 'ventura' and len(digits) == 10:
            return f"{digits[:3]}-{digits[3]}-{digits[4:7]}-{digits[7:]}"
        
        # Standard CA: XXX-XXX-XXX (9 digits)
        if len(digits) == 9:
            return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
        
        return apn_string

# =============================================================================
# CROP AND ROOTSTOCK REFERENCE MODELS
# =============================================================================

class CropCategory(models.TextChoices):
    """Categories for organizing crops."""
    CITRUS = 'citrus', 'Citrus'
    DECIDUOUS_FRUIT = 'deciduous_fruit', 'Deciduous Fruit'
    SUBTROPICAL = 'subtropical', 'Subtropical'
    VINE = 'vine', 'Vine'
    ROW_CROP = 'row_crop', 'Row Crop'
    VEGETABLE = 'vegetable', 'Vegetable'
    NUT = 'nut', 'Nut'
    BERRY = 'berry', 'Berry'
    OTHER = 'other', 'Other'


class CropType(models.TextChoices):
    """Plant type classification affecting field management."""
    TREE = 'tree', 'Tree'
    VINE = 'vine', 'Vine'
    BUSH = 'bush', 'Bush'
    ROW = 'row', 'Row Crop'
    PERENNIAL = 'perennial', 'Perennial'
    ANNUAL = 'annual', 'Annual'


class SeasonType(models.TextChoices):
    """Season type classifications determining how season dates are calculated."""
    CALENDAR_YEAR = 'calendar_year', 'Calendar Year (Jan-Dec)'
    CITRUS = 'citrus', 'Citrus Season (Oct-Sep)'
    AVOCADO = 'avocado', 'Avocado Season (Nov-Oct)'
    ALMOND = 'almond', 'Almond Season (Feb-Oct)'
    GRAPE = 'grape', 'Grape Season (Mar-Dec)'
    MULTIPLE_CYCLE = 'multiple_cycle', 'Multiple Cycles Per Year'
    CUSTOM = 'custom', 'Custom Date Range'


class SeasonTemplate(models.Model):
    """
    Season templates defining date calculation rules for different crop types.
    System-wide defaults (company=null) can be customized per company.

    Examples:
    - California Citrus: starts Oct 1, duration 12 months, crosses calendar year
    - Calendar Year: starts Jan 1, duration 12 months
    - Almond: starts Feb 1, duration 9 months (Feb-Oct harvest window)
    """

    name = models.CharField(
        max_length=100,
        help_text="Template name (e.g., 'California Citrus', 'Calendar Year')"
    )
    season_type = models.CharField(
        max_length=30,
        choices=SeasonType.choices,
        default=SeasonType.CALENDAR_YEAR,
        help_text="Season calculation type"
    )

    # Date calculation fields
    start_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text="Month season starts (1=January, 12=December)"
    )
    start_day = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Day of month season starts"
    )
    duration_months = models.PositiveSmallIntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(24)],
        help_text="Duration in months (typically 12)"
    )

    # Cross-year indicator
    crosses_calendar_year = models.BooleanField(
        default=False,
        help_text="True if season spans two calendar years (e.g., citrus Oct-Sep)"
    )

    # Label format for display
    label_format = models.CharField(
        max_length=50,
        default='{start_year}',
        help_text="Label format using {start_year} and/or {end_year} placeholders"
    )

    # Applicable crop categories (JSON list)
    applicable_categories = models.JSONField(
        default=list,
        blank=True,
        help_text="List of CropCategory values this template applies to (e.g., ['citrus', 'subtropical'])"
    )

    # Ownership - null for system defaults
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='season_templates',
        help_text="Null for system defaults, set for company-specific templates"
    )

    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Season Template"
        verbose_name_plural = "Season Templates"
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'company'],
                name='unique_season_template_per_company'
            )
        ]
        indexes = [
            models.Index(fields=['company', 'active']),
            models.Index(fields=['season_type']),
        ]

    def __str__(self):
        company_str = f" ({self.company.name})" if self.company else " (System)"
        return f"{self.name}{company_str}"

    @classmethod
    def get_system_defaults(cls):
        """Get all system default season templates (company=null)."""
        return cls.objects.filter(company__isnull=True, active=True)

    @classmethod
    def get_for_category(cls, category: str, company=None):
        """
        Get the best matching template for a crop category.
        Priority: company-specific > system default > calendar year fallback.
        """
        # Try company-specific first
        if company:
            template = cls.objects.filter(
                company=company,
                applicable_categories__contains=[category],
                active=True
            ).first()
            if template:
                return template

        # Try system default for category
        template = cls.objects.filter(
            company__isnull=True,
            applicable_categories__contains=[category],
            active=True
        ).first()
        if template:
            return template

        # Fall back to calendar year
        return cls.objects.filter(
            company__isnull=True,
            season_type=SeasonType.CALENDAR_YEAR,
            active=True
        ).first()


class Crop(models.Model):
    """
    Master reference table for crop varieties.
    Supports both system defaults (company=null) and company-specific custom crops.
    """

    # === IDENTIFICATION ===
    name = models.CharField(
        max_length=100,
        help_text="Common name (e.g., 'Navel Orange', 'Hass Avocado')"
    )
    scientific_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Scientific/botanical name"
    )
    variety = models.CharField(
        max_length=100,
        blank=True,
        help_text="Specific variety or cultivar"
    )

    # === CLASSIFICATION ===
    category = models.CharField(
        max_length=30,
        choices=CropCategory.choices,
        default=CropCategory.OTHER,
        help_text="Crop category for grouping"
    )
    crop_type = models.CharField(
        max_length=20,
        choices=CropType.choices,
        default=CropType.TREE,
        help_text="Plant type (tree, vine, row crop, etc.)"
    )

    # === AGRONOMIC CHARACTERISTICS ===
    typical_spacing_row_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Typical row spacing in feet"
    )
    typical_spacing_tree_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Typical in-row/tree spacing in feet"
    )
    typical_root_depth_inches = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical root depth for irrigation calculations"
    )
    years_to_maturity = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical years from planting to full production"
    )
    productive_lifespan_years = models.IntegerField(
        null=True,
        blank=True,
        help_text="Expected productive lifespan"
    )

    # === WATER/IRRIGATION ===
    kc_mature = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Mature crop coefficient (Kc) for ET calculations"
    )
    kc_young = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Young tree/vine crop coefficient"
    )

    # === HARVEST INFO ===
    typical_harvest_months = models.CharField(
        max_length=100,
        blank=True,
        help_text="Typical harvest window (e.g., 'Nov-Apr')"
    )
    default_bin_weight_lbs = models.IntegerField(
        default=900,
        help_text="Default bin weight for harvest calculations"
    )

    # === SEASON CONFIGURATION ===
    season_template = models.ForeignKey(
        SeasonTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crops',
        help_text="Default season template for this crop type"
    )
    supports_multiple_cycles = models.BooleanField(
        default=False,
        help_text="True for crops with multiple harvests per year (lettuce, strawberries)"
    )
    typical_cycles_per_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Typical number of growing cycles per year (for multi-cycle crops)"
    )
    typical_days_to_maturity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Typical days from planting to harvest"
    )

    # === OWNERSHIP & STATUS ===
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='crops',
        help_text="Null for system defaults, set for custom company crops"
    )
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = "Crop"
        verbose_name_plural = "Crops"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['category']),
            models.Index(fields=['active']),
        ]

    def __str__(self):
        if self.variety:
            return f"{self.name} ({self.variety})"
        return self.name

    @classmethod
    def get_system_defaults(cls):
        """Get all system default crops (company=null)."""
        return cls.objects.filter(company__isnull=True, active=True)


class Rootstock(models.Model):
    """
    Rootstock varieties, linked to compatible crops.
    Important for tree/vine crops (citrus, grapes, avocados, etc.)
    """

    VIGOR_CHOICES = [
        ('dwarf', 'Dwarf'),
        ('semi_dwarf', 'Semi-Dwarf'),
        ('standard', 'Standard'),
        ('vigorous', 'Vigorous'),
    ]

    DROUGHT_TOLERANCE_CHOICES = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
    ]

    # === IDENTIFICATION ===
    name = models.CharField(
        max_length=100,
        help_text="Rootstock name (e.g., 'Carrizo Citrange', '1103P')"
    )
    code = models.CharField(
        max_length=50,
        blank=True,
        help_text="Common abbreviation or code"
    )

    # === CROP COMPATIBILITY ===
    compatible_crops = models.ManyToManyField(
        Crop,
        related_name='compatible_rootstocks',
        blank=True,
        help_text="Crops this rootstock is typically used with"
    )
    primary_category = models.CharField(
        max_length=30,
        choices=CropCategory.choices,
        default=CropCategory.CITRUS,
        help_text="Primary crop category"
    )

    # === CHARACTERISTICS ===
    vigor = models.CharField(
        max_length=20,
        choices=VIGOR_CHOICES,
        blank=True,
        help_text="Growth vigor classification"
    )
    disease_resistance = models.TextField(
        blank=True,
        help_text="Known disease resistances"
    )
    soil_tolerance = models.TextField(
        blank=True,
        help_text="Soil condition tolerances (salinity, pH, drainage)"
    )
    cold_hardiness = models.CharField(
        max_length=50,
        blank=True,
        help_text="Cold hardiness rating"
    )
    drought_tolerance = models.CharField(
        max_length=20,
        choices=DROUGHT_TOLERANCE_CHOICES,
        blank=True
    )

    # === OWNERSHIP & STATUS ===
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='rootstocks',
        help_text="Null for system defaults"
    )
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['primary_category', 'name']
        verbose_name = "Rootstock"
        verbose_name_plural = "Rootstocks"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['primary_category']),
        ]

    def __str__(self):
        if self.code:
            return f"{self.name} ({self.code})"
        return self.name


# =============================================================================
# FIELD MODEL
# =============================================================================

class Field(LocationMixin, models.Model):
    """
    Farm field/block information with detailed agricultural data.
    Inherits GPS/PLSS fields from LocationMixin.
    """

    ROW_ORIENTATION_CHOICES = [
        ('ns', 'North-South'),
        ('ew', 'East-West'),
        ('ne_sw', 'Northeast-Southwest'),
        ('nw_se', 'Northwest-Southeast'),
    ]

    TRELLIS_SYSTEM_CHOICES = [
        ('none', 'None'),
        ('vertical_shoot', 'Vertical Shoot Position (VSP)'),
        ('lyre', 'Lyre/U-Shape'),
        ('geneva_double', 'Geneva Double Curtain'),
        ('high_wire', 'High Wire'),
        ('pergola', 'Pergola/Arbor'),
        ('espalier', 'Espalier'),
        ('stake', 'Stake'),
        ('other', 'Other'),
    ]

    SOIL_TYPE_CHOICES = [
        ('sandy', 'Sandy'),
        ('sandy_loam', 'Sandy Loam'),
        ('loam', 'Loam'),
        ('clay_loam', 'Clay Loam'),
        ('clay', 'Clay'),
        ('silty_loam', 'Silty Loam'),
        ('silty_clay', 'Silty Clay'),
    ]

    IRRIGATION_TYPE_CHOICES = [
        ('drip', 'Drip'),
        ('micro_sprinkler', 'Micro-Sprinkler'),
        ('sprinkler', 'Sprinkler'),
        ('flood', 'Flood'),
        ('furrow', 'Furrow'),
        ('none', 'None/Dryland'),
    ]

    ORGANIC_STATUS_CHOICES = [
        ('conventional', 'Conventional'),
        ('transitional', 'Transitional'),
        ('certified', 'Certified Organic'),
    ]

    # === BASIC INFO ===
    name = models.CharField(max_length=200)
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='fields', null=True, blank=True)
    field_number = models.CharField(max_length=50, blank=True)

    # Location data - county stays separate (often different from farm county)
    county = models.CharField(max_length=100)

    # NOTE: PLSS fields (plss_section, plss_township, plss_range, plss_meridian)
    # and GPS fields (gps_latitude, gps_longitude) are inherited from LocationMixin

    boundary_geojson = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Boundary GeoJSON",
        help_text="Field boundary polygon in GeoJSON format"
    )
    calculated_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Calculated Acres",
        help_text="Acreage calculated from drawn boundary"
    )

    # Field characteristics
    total_acres = models.DecimalField(max_digits=10, decimal_places=2)

    # === LEGACY CROP FIELD (kept for backward compatibility) ===
    current_crop = models.CharField(
        max_length=100,
        blank=True,
        help_text="Legacy text field - use 'crop' ForeignKey instead"
    )

    # === NEW CROP FIELDS ===
    crop = models.ForeignKey(
        Crop,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields',
        help_text="Primary crop planted in this field"
    )
    rootstock = models.ForeignKey(
        Rootstock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields',
        help_text="Rootstock variety (for tree/vine crops)"
    )

    # === SEASON CONFIGURATION ===
    season_template = models.ForeignKey(
        SeasonTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields',
        help_text="Override season template for this field (defaults to crop's template)"
    )
    current_growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Currently active growing cycle (for multi-cycle crops)"
    )

    # === PLANTING DATA ===
    planting_date = models.DateField(null=True, blank=True)
    year_planted = models.IntegerField(
        null=True,
        blank=True,
        help_text="Year trees/vines were planted (alternative to planting_date)"
    )

    # === SPACING & DENSITY ===
    row_spacing_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Row spacing in feet"
    )
    tree_spacing_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="In-row/tree spacing in feet"
    )
    tree_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Total number of trees/plants"
    )
    trees_per_acre = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Tree/plant density (calculated or manual)"
    )

    # === ORIENTATION & TRELLIS ===
    row_orientation = models.CharField(
        max_length=10,
        choices=ROW_ORIENTATION_CHOICES,
        blank=True,
        help_text="Row orientation for sun exposure"
    )
    trellis_system = models.CharField(
        max_length=30,
        choices=TRELLIS_SYSTEM_CHOICES,
        default='none',
        blank=True
    )

    # === SOIL & IRRIGATION ===
    soil_type = models.CharField(
        max_length=30,
        choices=SOIL_TYPE_CHOICES,
        blank=True,
        help_text="Predominant soil type"
    )
    irrigation_type = models.CharField(
        max_length=20,
        choices=IRRIGATION_TYPE_CHOICES,
        blank=True,
        help_text="Primary irrigation method"
    )

    # FSMA Water Assessment Fields
    typical_days_before_harvest = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical days between last irrigation and harvest"
    )
    water_contacts_harvestable = models.BooleanField(
        null=True,
        blank=True,
        help_text="Does irrigation water directly contact harvestable portion?"
    )

    # === PRODUCTION & YIELD ===
    expected_yield_per_acre = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected yield per acre (crop-appropriate units)"
    )
    yield_unit = models.CharField(
        max_length=30,
        blank=True,
        default='bins',
        help_text="Unit for yield (bins, lbs, tons, boxes, etc.)"
    )

    # === CERTIFICATION STATUS ===
    organic_status = models.CharField(
        max_length=20,
        choices=ORGANIC_STATUS_CHOICES,
        default='conventional'
    )
    organic_certifier = models.CharField(
        max_length=100,
        blank=True,
        help_text="Organic certification agency"
    )
    organic_cert_number = models.CharField(
        max_length=50,
        blank=True
    )
    organic_cert_expiration = models.DateField(
        null=True,
        blank=True
    )

    # === SATELLITE TREE DETECTION DATA ===
    # These fields are populated by tree detection runs
    latest_satellite_tree_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="Tree count from most recent satellite detection"
    )
    latest_satellite_trees_per_acre = models.FloatField(
        null=True,
        blank=True,
        help_text="Tree density from satellite detection"
    )
    satellite_canopy_coverage_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Canopy coverage percentage from satellite detection"
    )
    latest_detection_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of imagery used for latest tree detection"
    )
    latest_detection_run = models.ForeignKey(
        'TreeDetectionRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Most recent approved tree detection run"
    )

    # === LIDAR-DERIVED DATA ===
    lidar_tree_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="Tree count from LiDAR detection"
    )
    lidar_trees_per_acre = models.FloatField(
        null=True,
        blank=True,
        help_text="Tree density from LiDAR detection"
    )
    lidar_avg_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Average tree height from LiDAR (meters)"
    )
    lidar_canopy_coverage_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Canopy coverage percentage from LiDAR"
    )
    lidar_detection_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of LiDAR data used for detection"
    )
    latest_lidar_run = models.ForeignKey(
        'LiDARProcessingRun',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        help_text="Most recent approved LiDAR processing run"
    )

    # === TERRAIN DATA ===
    avg_slope_degrees = models.FloatField(
        null=True,
        blank=True,
        help_text="Average slope in degrees from LiDAR terrain analysis"
    )
    primary_aspect = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Primary slope aspect (N, NE, E, SE, S, SW, W, NW, FLAT)"
    )
    frost_risk_level = models.CharField(
        max_length=20,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
        ],
        null=True,
        blank=True,
        help_text="Frost risk level based on terrain analysis"
    )

    # === NOTES ===
    notes = models.TextField(blank=True)

    # === STATUS ===
    active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.field_number})"

    @property
    def crop_age_years(self):
        """Calculate crop age from planting date or year planted."""
        from datetime import date
        if self.planting_date:
            return (date.today() - self.planting_date).days // 365
        elif self.year_planted:
            return date.today().year - self.year_planted
        return None

    @property
    def calculated_trees_per_acre(self):
        """Calculate tree density from spacing."""
        if self.row_spacing_ft and self.tree_spacing_ft:
            sq_ft_per_tree = float(self.row_spacing_ft * self.tree_spacing_ft)
            if sq_ft_per_tree > 0:
                return round(43560 / sq_ft_per_tree, 2)
        return None

    def calculate_centroid_from_boundary(self):
        """Calculate the centroid of the boundary polygon."""
        if not self.boundary_geojson:
            return None
        try:
            coords = self.boundary_geojson.get('coordinates', [[]])[0]
            if not coords:
                return None
            lats = [c[1] for c in coords]
            lngs = [c[0] for c in coords]
            self.gps_latitude = Decimal(str(sum(lats) / len(lats)))
            self.gps_longitude = Decimal(str(sum(lngs) / len(lngs)))
            return (float(self.gps_latitude), float(self.gps_longitude))
        except (KeyError, IndexError, TypeError):
            return None

    def save(self, *args, **kwargs):
        """Auto-calculate values on save."""
        # Auto-calculate trees per acre if not set
        if not self.trees_per_acre and self.row_spacing_ft and self.tree_spacing_ft:
            self.trees_per_acre = self.calculated_trees_per_acre

        # Auto-calculate tree count if not set
        if not self.tree_count and self.trees_per_acre and self.total_acres:
            self.tree_count = int(float(self.trees_per_acre) * float(self.total_acres))

        # Auto-calculate centroid from boundary
        if self.boundary_geojson and not self.has_coordinates:
            self.calculate_centroid_from_boundary()

        super().save(*args, **kwargs)

    def get_season_template(self):
        """
        Get the applicable season template for this field.
        Priority: Field override > Crop default > Category default > Calendar year
        """
        # Field-level override
        if self.season_template:
            return self.season_template

        # Crop-level default
        if self.crop and self.crop.season_template:
            return self.crop.season_template

        # Look up by crop category
        if self.crop and self.crop.category:
            company = self.farm.company if self.farm else None
            return SeasonTemplate.get_for_category(self.crop.category, company)

        # Fall back to calendar year (will be created in migration)
        return SeasonTemplate.objects.filter(
            company__isnull=True,
            season_type=SeasonType.CALENDAR_YEAR,
            active=True
        ).first()


class GrowingCycleStatus(models.TextChoices):
    """Status choices for growing cycles."""
    PLANNED = 'planned', 'Planned'
    PLANTED = 'planted', 'Planted'
    GROWING = 'growing', 'Growing'
    HARVESTING = 'harvesting', 'Harvesting'
    COMPLETE = 'complete', 'Complete'
    ABANDONED = 'abandoned', 'Abandoned'


class GrowingCycle(models.Model):
    """
    Represents a specific growing cycle for crops that have multiple
    harvests per year (lettuce, strawberries, tomatoes, etc.)

    Each cycle tracks planting to harvest for one crop rotation.
    Applications and harvests can optionally link to a specific cycle.
    """

    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='growing_cycles'
    )

    # Cycle identification
    cycle_number = models.PositiveSmallIntegerField(
        default=1,
        help_text="Cycle number within the year (1, 2, 3...)"
    )
    year = models.PositiveIntegerField(
        help_text="Calendar year this cycle occurs in"
    )

    # Crop for this cycle (may differ from field's primary crop for rotation)
    crop = models.ForeignKey(
        'Crop',
        on_delete=models.PROTECT,
        related_name='growing_cycles',
        null=True,
        blank=True,
        help_text="Crop for this cycle (optional, defaults to field's crop)"
    )

    # Cycle dates
    planting_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual or planned planting date"
    )
    expected_harvest_start = models.DateField(
        null=True,
        blank=True,
        help_text="Expected start of harvest window"
    )
    expected_harvest_end = models.DateField(
        null=True,
        blank=True,
        help_text="Expected end of harvest window"
    )
    actual_harvest_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual harvest completion date"
    )

    # Growing parameters
    days_to_maturity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Expected days from planting to harvest (can override crop default)"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=GrowingCycleStatus.choices,
        default=GrowingCycleStatus.PLANNED
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['year', 'cycle_number']
        verbose_name = "Growing Cycle"
        verbose_name_plural = "Growing Cycles"
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'year', 'cycle_number'],
                name='unique_cycle_per_field_year'
            )
        ]
        indexes = [
            models.Index(fields=['field', 'year']),
            models.Index(fields=['status', 'year']),
            models.Index(fields=['planting_date']),
        ]

    def __str__(self):
        crop_name = self.crop.name if self.crop else (
            self.field.crop.name if self.field.crop else 'Unknown'
        )
        return f"{self.field.name} - {crop_name} Cycle {self.cycle_number} ({self.year})"

    @property
    def is_active(self) -> bool:
        """Check if this cycle is currently active."""
        return self.status in (
            GrowingCycleStatus.PLANTED,
            GrowingCycleStatus.GROWING,
            GrowingCycleStatus.HARVESTING
        )

    @property
    def effective_crop(self):
        """Get the crop for this cycle, defaulting to field's crop."""
        return self.crop or self.field.crop

    @property
    def duration_days(self):
        """Calculate actual or expected duration in days."""
        if self.planting_date and self.actual_harvest_date:
            return (self.actual_harvest_date - self.planting_date).days
        if self.planting_date and self.expected_harvest_end:
            return (self.expected_harvest_end - self.planting_date).days
        return self.days_to_maturity

    def get_season_context(self) -> dict:
        """Return season-like context for this cycle (for compliance checking)."""
        return {
            'label': f"{self.year} Cycle {self.cycle_number}",
            'start_date': self.planting_date,
            'end_date': self.actual_harvest_date or self.expected_harvest_end,
            'type': 'growing_cycle',
            'cycle_id': self.id,
        }

    def save(self, *args, **kwargs):
        # Auto-calculate expected harvest if planting date and days to maturity known
        if self.planting_date and not self.expected_harvest_start:
            days = self.days_to_maturity
            if not days and self.effective_crop:
                days = self.effective_crop.typical_days_to_maturity
            if days:
                from datetime import timedelta
                self.expected_harvest_start = self.planting_date + timedelta(days=days)
        super().save(*args, **kwargs)


class PesticideProduct(models.Model):
    """
    Complete pesticide product database for California PUR compliance.
    Based on California DPR requirements and product label information.
    """
    
    # EXISTING FIELDS (keep these)
    epa_registration_number = models.CharField(
        max_length=50, 
        unique=True,
        help_text="EPA Registration Number (e.g., 12345-678)"
    )
    product_name = models.CharField(
        max_length=200,
        help_text="Product trade name"
    )
    manufacturer = models.CharField(
        max_length=200,
        blank=True,
        help_text="Manufacturer/registrant name"
    )
    active_ingredients = models.TextField(
        blank=True,
        help_text="Active ingredient(s) and percentages"
    )
    formulation_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., EC, WP, G, etc."
    )
    restricted_use = models.BooleanField(
        default=False,
        help_text="Restricted Use Pesticide (RUP)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # NEW FIELDS FOR ENHANCED PUR COMPLIANCE
    
    # Product Classification
    product_type = models.CharField(  # NEW
        max_length=50,
        blank=True,
        choices=[
            ('insecticide', 'Insecticide'),
            ('herbicide', 'Herbicide'),
            ('fungicide', 'Fungicide'),
            ('fumigant', 'Fumigant'),
            ('adjuvant', 'Adjuvant'),
            ('plant_growth_regulator', 'Plant Growth Regulator'),
            ('rodenticide', 'Rodenticide'),
            ('other', 'Other'),
        ],
        help_text="Primary product type"
    )
    
    is_fumigant = models.BooleanField(  # NEW
        default=False,
        help_text="Is this a fumigant product?"
    )
    
    # Signal Word (Toxicity)
    signal_word = models.CharField(  # NEW
        max_length=20,
        blank=True,
        choices=[
            ('DANGER', 'Danger'),
            ('WARNING', 'Warning'),
            ('CAUTION', 'Caution'),
            ('NONE', 'None'),
        ],
        help_text="Signal word from label"
    )
    
    # Re-Entry Interval (REI)
    rei_hours = models.DecimalField(  # NEW
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Re-Entry Interval in hours (e.g., 12, 24, 48)"
    )
    
    rei_days = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Alternative REI in days (some products use days)"
    )
    
    # Pre-Harvest Interval (PHI)
    phi_days = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Pre-Harvest Interval in days"
    )
    
    # Application Restrictions
    max_applications_per_season = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Maximum number of applications per season"
    )
    
    max_rate_per_application = models.DecimalField(  # NEW
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum rate per application"
    )
    
    max_rate_unit = models.CharField(  # NEW
        max_length=20,
        blank=True,
        choices=[
            ('lbs/acre', 'lbs/acre'),
            ('gal/acre', 'gal/acre'),
            ('oz/acre', 'oz/acre'),
            ('fl oz/acre', 'fl oz/acre'),
            ('kg/ha', 'kg/ha'),
            ('L/ha', 'L/ha'),
        ],
        help_text="Unit for max rate"
    )
    
    # California Specific
    california_registration_number = models.CharField(  # NEW
        max_length=50,
        blank=True,
        help_text="California DPR registration number (if different from EPA)"
    )
    
    active_status_california = models.BooleanField(  # NEW
        default=True,
        help_text="Currently registered for use in California?"
    )
    
    # Product Details
    formulation_code = models.CharField(  # NEW
        max_length=10,
        blank=True,
        help_text="EPA formulation code (e.g., EC, WP, G)"
    )
    
    density_specific_gravity = models.DecimalField(  # NEW
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Specific gravity or density (for conversions)"
    )
    
    # Approved Crops/Sites
    approved_crops = models.TextField(  # NEW
        blank=True,
        help_text="Comma-separated list of approved crops/sites"
    )
    
    # Environmental/Safety Notes
    groundwater_advisory = models.BooleanField(  # NEW
        default=False,
        help_text="Has groundwater advisory?"
    )
    
    endangered_species_restrictions = models.BooleanField(  # NEW
        default=False,
        help_text="Has endangered species restrictions?"
    )
    
    buffer_zone_required = models.BooleanField(  # NEW
        default=False,
        help_text="Requires buffer zones?"
    )
    
    buffer_zone_feet = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Buffer zone distance in feet"
    )
    
    # Product Availability
    product_status = models.CharField(  # NEW
        max_length=20,
        default='active',
        choices=[
            ('active', 'Active'),
            ('discontinued', 'Discontinued'),
            ('suspended', 'Suspended'),
            ('cancelled', 'Cancelled'),
        ],
        help_text="Current product status"
    )
    
    # Cost Tracking (Optional but useful)
    unit_size = models.CharField(  # NEW
        max_length=50,
        blank=True,
        help_text="Standard unit size (e.g., '2.5 gallon jug', '50 lb bag')"
    )
    
    cost_per_unit = models.DecimalField(  # NEW
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Cost per unit (for cost tracking)"
    )
    
    # Additional Information
    label_url = models.URLField(  # NEW
        blank=True,
        help_text="URL to product label PDF"
    )
    
    sds_url = models.URLField(  # NEW
        blank=True,
        help_text="URL to Safety Data Sheet"
    )
    
    notes = models.TextField(  # NEW
        blank=True,
        help_text="Additional notes or special instructions"
    )
    
    # Metadata for management
    active = models.BooleanField(  # NEW (if not already present)
        default=True,
        help_text="Is this product actively used on your farm?"
    )
    
    # Search optimization
    search_keywords = models.TextField(  # NEW
        blank=True,
        help_text="Additional keywords for searching (auto-populated)"
    )
    
    class Meta:
        ordering = ['product_name']
        verbose_name = "Pesticide Product"
        verbose_name_plural = "Pesticide Products"
        indexes = [
            models.Index(fields=['epa_registration_number']),
            models.Index(fields=['product_name']),
            models.Index(fields=['product_type']),
            models.Index(fields=['active']),
        ]
    
    def __str__(self):
        return f"{self.product_name} ({self.epa_registration_number})"
    
    def save(self, *args, **kwargs):
        # Auto-populate search keywords
        keywords = [
            self.product_name,
            self.manufacturer,
            self.epa_registration_number,
            self.active_ingredients,
        ]
        self.search_keywords = ' '.join(filter(None, keywords)).lower()
        super().save(*args, **kwargs)
    
    def get_rei_display_hours(self):
        """Get REI in hours for display"""
        if self.rei_hours:
            return self.rei_hours
        elif self.rei_days:
            return self.rei_days * 24
        return None
    
    def is_rei_expired(self, application_date, check_date):
        """Check if REI has expired for an application"""
        from datetime import timedelta
        
        rei_hours = self.get_rei_display_hours()
        if not rei_hours:
            return True  # No REI means safe to enter
        
        rei_end = application_date + timedelta(hours=float(rei_hours))
        return check_date >= rei_end
    
    def is_phi_met(self, application_date, harvest_date):
        """Check if PHI is met for harvest"""
        if not self.phi_days:
            return True  # No PHI restriction
        
        from datetime import timedelta
        phi_end = application_date + timedelta(days=self.phi_days)
        return harvest_date >= phi_end
    
    @property
    def is_high_toxicity(self):
        """Check if product is high toxicity"""
        return self.signal_word == 'DANGER'
    
    @property
    def requires_license(self):
        """Check if product requires licensed applicator"""
        return self.restricted_use or self.is_fumigant


class PesticideApplication(models.Model):
    """Pesticide application records"""
    
    STATUS_CHOICES = [
        ('pending_signature', 'Pending Signature'),
        ('complete', 'Complete'),
        ('submitted', 'Submitted to PUR'),
    ]
    
    # Application date and time
    application_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # Field information
    field = models.ForeignKey(Field, on_delete=models.PROTECT, related_name='applications')
    acres_treated = models.DecimalField(max_digits=10, decimal_places=2)

    # Growing cycle (optional, for multi-cycle crops)
    growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='applications',
        help_text="Associated growing cycle (for multi-cycle crops like lettuce)"
    )

    # Product information
    product = models.ForeignKey(PesticideProduct, on_delete=models.PROTECT, related_name='applications')
    
    # Application details
    amount_used = models.DecimalField(max_digits=10, decimal_places=2)
    
    UNIT_CHOICES = [
        ('gal', 'Gallons'),
        ('lbs', 'Pounds'),
        ('oz', 'Ounces'),
        ('pt', 'Pints'),
        ('qt', 'Quarts'),
    ]
    unit_of_measure = models.CharField(max_length=20, choices=UNIT_CHOICES)
    
    METHOD_CHOICES = [
        ('Ground Spray', 'Ground Spray'),
        ('Aerial Application', 'Aerial Application'),
        ('Chemigation', 'Chemigation'),
        ('Soil Injection', 'Soil Injection'),
        ('Broadcast', 'Broadcast Application'),
    ]
    application_method = models.CharField(max_length=100, choices=METHOD_CHOICES)
    
    target_pest = models.CharField(max_length=200, blank=True)
    
    # Applicator information
    applicator_name = models.CharField(max_length=200)

    # Applicator license number
    applicator_license_no = models.CharField(
        max_length=50, 
        blank=True,
        help_text="California Department of Pesticide Regulation license number"
    )
    
    # Weather conditions
    temperature = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    wind_speed = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    
    WIND_DIRECTION_CHOICES = [
        ('N', 'North'),
        ('NE', 'Northeast'),
        ('E', 'East'),
        ('SE', 'Southeast'),
        ('S', 'South'),
        ('SW', 'Southwest'),
        ('W', 'West'),
        ('NW', 'Northwest'),
    ]
    wind_direction = models.CharField(max_length=2, choices=WIND_DIRECTION_CHOICES, blank=True)
    
    # Additional tracking
    notes = models.TextField(blank=True)
    
    # PUR submission tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_signature')
    submitted_to_pur = models.BooleanField(default=False)
    pur_submission_date = models.DateField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-application_date', '-created_at']

    def __str__(self):
        return f"{self.field.name} - {self.product.product_name} on {self.application_date}"


# =============================================================================
# WATER & IRRIGATION MANAGEMENT
# =============================================================================

# -----------------------------------------------------------------------------
# SGMA / WELL CHOICE CONSTANTS
# (Must be defined before WaterSource model)
# -----------------------------------------------------------------------------

GSA_CHOICES = [
    ('obgma', 'Ojai Basin Groundwater Management Agency (OBGMA)'),
    ('uwcd', 'United Water Conservation District (UWCD)'),
    ('fpbgsa', 'Fillmore and Piru Basins GSA'),
    ('uvrga', 'Upper Ventura River Groundwater Agency'),
    ('fcgma', 'Fox Canyon Groundwater Management Agency'),
    ('other', 'Other'),
    ('none', 'Not in GSA Jurisdiction'),
]

# Default fee rates by GSA (used to pre-populate when GSA is selected)
GSA_FEE_DEFAULTS = {
    'obgma': {
        'base_extraction_rate': Decimal('25.00'),
        'gsp_rate': Decimal('100.00'),
        'fixed_quarterly_fee': Decimal('70.00'),
        'domestic_rate': None,
    },
    'uwcd': {
        'base_extraction_rate': Decimal('192.34'),
        'gsp_rate': None,
        'fixed_quarterly_fee': None,
        'domestic_rate': Decimal('214.22'),
    },
    'fpbgsa': {
        'base_extraction_rate': None,
        'gsp_rate': None,
        'fixed_quarterly_fee': None,
        'domestic_rate': None,
    },
}

GROUNDWATER_BASIN_CHOICES = [
    ('ojai_valley', 'Ojai Valley (4-002)'),
    ('upper_ventura_river', 'Upper Ventura River (4-003.01)'),
    ('lower_ventura_river', 'Lower Ventura River (4-003.02)'),
    ('fillmore', 'Santa Clara River Valley - Fillmore (4-004.05)'),
    ('piru', 'Santa Clara River Valley - Piru (4-004.06)'),
    ('santa_paula', 'Santa Clara River Valley - Santa Paula (4-004.04)'),
    ('oxnard', 'Santa Clara River Valley - Oxnard (4-004.02)'),
    ('pleasant_valley', 'Pleasant Valley (4-006)'),
    ('las_posas', 'Las Posas Valley (4-008)'),
    ('arroyo_santa_rosa', 'Arroyo Santa Rosa Valley (4-007)'),
    ('mound', 'Mound (4-004.01)'),
    ('other', 'Other'),
]

BASIN_PRIORITY_CHOICES = [
    ('critical', 'Critically Overdrafted'),
    ('high', 'High Priority'),
    ('medium', 'Medium Priority'),
    ('low', 'Low Priority'),
    ('very_low', 'Very Low Priority'),
]

PUMP_TYPE_CHOICES = [
    ('submersible', 'Submersible'),
    ('turbine', 'Vertical Turbine'),
    ('jet', 'Jet Pump'),
    ('centrifugal', 'Centrifugal'),
    ('other', 'Other'),
]

POWER_SOURCE_CHOICES = [
    ('electric_utility', 'Electric - Utility'),
    ('electric_solar', 'Electric - Solar'),
    ('diesel', 'Diesel Engine'),
    ('natural_gas', 'Natural Gas Engine'),
    ('propane', 'Propane Engine'),
    ('other', 'Other'),
]

FLOWMETER_UNIT_CHOICES = [
    ('acre_feet', 'Acre-Feet'),
    ('gallons', 'Gallons'),
    ('hundred_gallons', 'Hundred Gallons'),
    ('thousand_gallons', 'Thousand Gallons'),
    ('cubic_feet', 'Cubic Feet'),
    ('hundred_cubic_feet', 'Hundred Cubic Feet (CCF)'),
]

WELL_STATUS_CHOICES = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
    ('standby', 'Standby/Emergency'),
    ('destroyed', 'Destroyed/Abandoned'),
    ('monitoring', 'Monitoring Only'),
]


class WaterSource(LocationMixin, models.Model):
    """
    Unified water source model combining WaterSource and Well.
    
    For wells (source_type='well'), SGMA compliance fields are populated.
    For other sources (municipal, surface, other), well-specific fields are null.
    
    Inherits GPS/PLSS fields from LocationMixin.
    """
    
    SOURCE_TYPE_CHOICES = [
        ('well', 'Groundwater Well'),
        ('municipal', 'Municipal/Public'),
        ('surface', 'Surface Water (pond, stream, etc.)'),
        ('recycled', 'Recycled Water'),
        ('other', 'Other'),
    ]
    
    # -------------------------------------------------------------------------
    # Base WaterSource Fields
    # -------------------------------------------------------------------------
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='water_sources')
    name = models.CharField(max_length=200, help_text="e.g., 'Well #1', 'North Pond'")
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default='well')
    
    # Location description (for non-GPS locations)
    location_description = models.TextField(blank=True, help_text="Physical location description")
    
    # Inherit location from farm option
    inherit_location_from_farm = models.BooleanField(
        default=True,
        help_text="If true, use farm's GPS/PLSS; if false, use this record's location"
    )
    
    # Usage flags
    used_for_irrigation = models.BooleanField(default=True)
    used_for_washing = models.BooleanField(default=False)
    used_for_pesticide_mixing = models.BooleanField(default=False)
    
    # Fields that use this water source
    fields_served = models.ManyToManyField(Field, blank=True, related_name='water_sources')
    
    # Testing requirements
    test_frequency_days = models.IntegerField(
        default=365,
        help_text="How often to test (365 = annually, 90 = quarterly)"
    )
    
    # Status
    active = models.BooleanField(default=True)
    
    # -------------------------------------------------------------------------
    # Well-Specific Fields (nullable for non-wells)
    # -------------------------------------------------------------------------
    
    # === WELL IDENTIFICATION ===
    well_name = models.CharField(max_length=100, blank=True, help_text="Common name for the well")
    state_well_number = models.CharField(max_length=50, blank=True, help_text="California DWR State Well Number")
    local_well_id = models.CharField(max_length=50, blank=True, help_text="County well permit number")
    gsa_well_id = models.CharField(max_length=50, blank=True, help_text="GSA-assigned well identifier")
    
    # === GSA / BASIN INFORMATION ===
    gsa = models.CharField(max_length=20, choices=GSA_CHOICES, blank=True, help_text="Groundwater Sustainability Agency")
    gsa_account_number = models.CharField(max_length=50, blank=True, help_text="Account number with the GSA")
    basin = models.CharField(max_length=30, choices=GROUNDWATER_BASIN_CHOICES, blank=True, help_text="DWR Bulletin 118 basin")
    basin_priority = models.CharField(max_length=20, choices=BASIN_PRIORITY_CHOICES, blank=True)
    
    # === WELL PHYSICAL CHARACTERISTICS ===
    well_depth_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True, help_text="Total well depth in feet")
    casing_diameter_inches = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    screen_interval_top_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    screen_interval_bottom_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    static_water_level_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    static_level_date = models.DateField(null=True, blank=True)
    aquifer_name = models.CharField(max_length=100, blank=True)
    
    # === WELL LOCATION (APN) ===
    parcel_apn = models.CharField(max_length=20, blank=True, help_text="Assessor's Parcel Number")
    quarter_quarter = models.CharField(max_length=10, blank=True, help_text="Quarter-quarter section (e.g., NE/SW)")
    
    # === PUMP INFORMATION ===
    pump_type = models.CharField(max_length=20, choices=PUMP_TYPE_CHOICES, blank=True)
    pump_horsepower = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    pump_flow_rate_gpm = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="GPM")
    pump_efficiency = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    pump_installation_date = models.DateField(null=True, blank=True)
    pump_manufacturer = models.CharField(max_length=100, blank=True)
    pump_model = models.CharField(max_length=100, blank=True)
    
    # === POWER SOURCE ===
    power_source = models.CharField(max_length=20, choices=POWER_SOURCE_CHOICES, blank=True)
    utility_meter_number = models.CharField(max_length=50, blank=True)
    
    # === FLOWMETER INFORMATION ===
    has_flowmeter = models.BooleanField(default=False)
    flowmeter_make = models.CharField(max_length=100, blank=True)
    flowmeter_model = models.CharField(max_length=100, blank=True)
    flowmeter_serial_number = models.CharField(max_length=100, blank=True)
    flowmeter_size_inches = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    flowmeter_installation_date = models.DateField(null=True, blank=True)
    flowmeter_units = models.CharField(max_length=20, choices=FLOWMETER_UNIT_CHOICES, default='acre_feet')
    flowmeter_multiplier = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)
    flowmeter_decimal_places = models.IntegerField(default=2)
    
    # === AMI (Automated Meter Infrastructure) ===
    has_ami = models.BooleanField(default=False)
    ami_vendor = models.CharField(max_length=100, blank=True)
    ami_device_id = models.CharField(max_length=100, blank=True)
    ami_installation_date = models.DateField(null=True, blank=True)
    
    # === WELL DATES & STATUS ===
    well_construction_date = models.DateField(null=True, blank=True)
    well_permit_date = models.DateField(null=True, blank=True)
    well_permit_number = models.CharField(max_length=50, blank=True)
    driller_name = models.CharField(max_length=100, blank=True)
    driller_license = models.CharField(max_length=50, blank=True)
    well_log_available = models.BooleanField(default=False)
    well_log_file = models.FileField(upload_to='well_logs/', null=True, blank=True)
    well_status = models.CharField(max_length=20, choices=WELL_STATUS_CHOICES, default='active')
    
    # === DE MINIMIS EXEMPTION ===
    is_de_minimis = models.BooleanField(default=False, help_text="Domestic well < 2 AF/year")

    # === GSA FEE CONFIGURATION ===
    base_extraction_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Base extraction rate $/AF (e.g., OBGMA $25, UWCD $192.34)"
    )
    gsp_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="GSP/SGMA fee rate $/AF (e.g., OBGMA $100)"
    )
    domestic_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Domestic usage rate $/AF (e.g., UWCD $214.22)"
    )
    fixed_quarterly_fee = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Fixed quarterly fee (e.g., OBGMA $70)"
    )
    is_domestic_well = models.BooleanField(
        default=False,
        help_text="Well is primarily for domestic use (different rate applies)"
    )
    owner_code = models.CharField(
        max_length=20, blank=True,
        help_text="Owner identifier code (e.g., JPF, FF, RMLF)"
    )

    # === COMPLIANCE TRACKING ===
    registered_with_gsa = models.BooleanField(default=False)
    gsa_registration_date = models.DateField(null=True, blank=True)
    meter_calibration_current = models.BooleanField(default=False)
    next_calibration_due = models.DateField(null=True, blank=True)

    # === FSMA WATER ASSESSMENT FIELDS ===
    FSMA_WELLHEAD_CONDITION_CHOICES = [
        ('good', 'Good - No deficiencies'),
        ('fair', 'Fair - Minor issues'),
        ('poor', 'Poor - Significant deficiencies'),
        ('na', 'N/A - Not a well'),
    ]
    FSMA_DISTRIBUTION_TYPE_CHOICES = [
        ('closed', 'Closed (Piped)'),
        ('open', 'Open (Canal/Ditch)'),
        ('mixed', 'Mixed'),
    ]

    fsma_wellhead_condition = models.CharField(
        max_length=20,
        choices=FSMA_WELLHEAD_CONDITION_CHOICES,
        default='na',
        blank=True,
        help_text="Physical condition of wellhead for FSMA assessment"
    )
    fsma_well_cap_secure = models.BooleanField(
        null=True,
        blank=True,
        help_text="Is the well cap securely in place?"
    )
    fsma_well_casing_intact = models.BooleanField(
        null=True,
        blank=True,
        help_text="Is the well casing intact without cracks?"
    )
    fsma_backflow_prevention = models.BooleanField(
        null=True,
        blank=True,
        help_text="Is backflow prevention device installed?"
    )
    fsma_last_physical_inspection = models.DateField(
        null=True,
        blank=True,
        help_text="Date of last physical inspection"
    )
    fsma_distribution_type = models.CharField(
        max_length=20,
        choices=FSMA_DISTRIBUTION_TYPE_CHOICES,
        default='closed',
        blank=True,
        help_text="Type of water distribution system"
    )
    fsma_animal_access_possible = models.BooleanField(
        default=False,
        help_text="Can animals access the water source?"
    )
    fsma_debris_present = models.BooleanField(
        default=False,
        help_text="Is debris present at or near the water source?"
    )

    # === NOTES ===
    notes = models.TextField(blank=True)
    
    # === TIMESTAMPS ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm', 'name']
        verbose_name = "Water Source"
        verbose_name_plural = "Water Sources"

    def __str__(self):
        return f"{self.farm.name} - {self.name}"
    
    @property
    def is_well(self):
        """Check if this is a groundwater well."""
        return self.source_type == 'well'
    
    @property
    def effective_location(self):
        """Get effective GPS coordinates - from this record or inherited from farm."""
        if not self.inherit_location_from_farm and self.has_coordinates:
            return self.coordinates_tuple
        elif self.farm and self.farm.has_coordinates:
            return self.farm.coordinates_tuple
        return None
    
    @property
    def effective_plss(self):
        """Get effective PLSS data - from this record or inherited from farm."""
        if not self.inherit_location_from_farm and self.has_plss:
            return {
                'section': self.plss_section,
                'township': self.plss_township,
                'range': self.plss_range,
                'meridian': self.plss_meridian
            }
        elif self.farm and self.farm.has_plss:
            return {
                'section': self.farm.plss_section,
                'township': self.farm.plss_township,
                'range': self.farm.plss_range,
                'meridian': self.farm.plss_meridian
            }
        return None
    
    def next_test_due(self):
        """Calculate next test due date based on most recent test."""
        latest_test = self.water_tests.filter(test_date__isnull=False).order_by('-test_date').first()
        if latest_test:
            from datetime import timedelta
            return latest_test.test_date + timedelta(days=self.test_frequency_days)
        return None
    
    def is_test_overdue(self):
        """Check if test is overdue."""
        next_due = self.next_test_due()
        if next_due:
            from django.utils import timezone
            return timezone.now().date() > next_due
        return True
    
    def get_latest_reading(self):
        """Get the most recent meter reading (for wells)."""
        if not self.is_well:
            return None
        return self.readings.order_by('-reading_date', '-reading_time').first()
    
    def get_ytd_extraction_af(self):
        """Get year-to-date extraction in acre-feet for current water year."""
        if not self.is_well:
            return Decimal('0')
        from django.db.models import Sum
        from datetime import date
        today = date.today()
        if today.month >= 10:
            wy_start = date(today.year, 10, 1)
        else:
            wy_start = date(today.year - 1, 10, 1)
        total = self.readings.filter(reading_date__gte=wy_start).aggregate(Sum('extraction_acre_feet'))['extraction_acre_feet__sum']
        return total or Decimal('0')
    
    def get_allocation_for_year(self, water_year=None):
        """Get total allocation for a water year."""
        if not self.is_well:
            return Decimal('0')
        from django.db.models import Sum
        if not water_year:
            from datetime import date
            today = date.today()
            if today.month >= 10:
                water_year = f"{today.year}-{today.year + 1}"
            else:
                water_year = f"{today.year - 1}-{today.year}"
        total = self.allocations.filter(water_year=water_year).exclude(allocation_type='transferred_out').aggregate(Sum('allocated_acre_feet'))['allocated_acre_feet__sum']
        return total or Decimal('0')
    
    def is_calibration_due(self, days_warning=30):
        """Check if calibration is due or coming due soon."""
        if not self.is_well or not self.next_calibration_due:
            return True
        from datetime import date, timedelta
        warning_date = date.today() + timedelta(days=days_warning)
        return self.next_calibration_due <= warning_date
    
    def save(self, *args, **kwargs):
        """Clear well-specific fields if not a well."""
        if not self.is_well:
            self.gsa = ''
            self.basin = ''
            self.well_depth_ft = None
            self.has_flowmeter = False
            self.registered_with_gsa = False
            self.is_de_minimis = False
        super().save(*args, **kwargs)


class WaterTest(models.Model):
    """Water quality test results"""
    
    TEST_TYPE_CHOICES = [
        ('microbial', 'Microbial (E. coli/Coliform)'),
        ('chemical', 'Chemical Analysis'),
        ('both', 'Microbial & Chemical'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Results'),
        ('pass', 'Pass'),
        ('fail', 'Fail - Action Required'),
    ]
    
    water_source = models.ForeignKey(WaterSource, on_delete=models.CASCADE, related_name='water_tests')
    
    # Test details
    test_date = models.DateField()
    test_type = models.CharField(max_length=20, choices=TEST_TYPE_CHOICES)
    lab_name = models.CharField(max_length=200, blank=True, help_text="Testing laboratory")
    lab_certification_number = models.CharField(max_length=100, blank=True)
    
    # Microbial results (CFU/100mL or MPN/100mL)
    ecoli_result = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="E. coli count (CFU or MPN per 100mL)"
    )
    total_coliform_result = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Total coliform count"
    )
    
    # FSMA Thresholds:
    # Agricultural water: Generic E. coli GM ≤ 126 CFU or MPN per 100 mL
    # and STV ≤ 410 CFU or MPN per 100 mL
    
    # Chemical results
    ph_level = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    nitrate_level = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="mg/L")
    
    # Overall status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Actions taken if failed
    corrective_actions = models.TextField(
        blank=True,
        help_text="Actions taken if test failed (e.g., stopped use, re-treatment, re-test)"
    )
    retest_date = models.DateField(null=True, blank=True)
    
    # Attachments
    lab_report_file = models.FileField(upload_to='water_tests/', null=True, blank=True)
    
    # Notes
    notes = models.TextField(blank=True)
    
    # Who recorded this
    recorded_by = models.CharField(max_length=200, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-test_date']

    def __str__(self):
        return f"{self.water_source.name} - {self.test_date} - {self.status}"
    
    def auto_determine_status(self):
        """Auto-determine pass/fail based on FSMA thresholds"""
        if self.ecoli_result is not None:
            # FSMA threshold: E. coli should be ≤ 126 CFU/100mL (geometric mean)
            # For simplicity, we'll use single sample threshold of 235 CFU/100mL
            if self.ecoli_result > 235:
                return 'fail'
            elif self.ecoli_result <= 126:
                return 'pass'
        return 'pending'
    
# -----------------------------------------------------------------------------
# CHOICES
# -----------------------------------------------------------------------------

BUYER_TYPE_CHOICES = [
    ('packing_house', 'Packing House'),
    ('processor', 'Processor'),
    ('direct_sale', 'Direct Sale'),
    ('farmers_market', 'Farmers Market'),
    ('distributor', 'Distributor'),
    ('export', 'Export'),
]

GRADE_CHOICES = [
    ('fancy', 'Fancy'),
    ('choice', 'Choice'),
    ('standard', 'Standard'),
    ('juice', 'Juice Grade'),
    ('reject', 'Reject/Cull'),
]

# Standard citrus size grades (count per carton)
SIZE_GRADE_CHOICES = [
    ('48', '48'),
    ('56', '56'),
    ('72', '72'),
    ('88', '88'),
    ('113', '113'),
    ('138', '138'),
    ('163', '163'),
    ('180', '180'),
    ('200', '200'),
    ('235', '235'),
    ('mixed', 'Mixed'),
]

PRICE_UNIT_CHOICES = [
    ('per_bin', 'Per Bin'),
    ('per_lb', 'Per Pound'),
    ('per_ton', 'Per Ton'),
    ('per_box', 'Per Box'),
    ('per_carton', 'Per Carton'),
    ('flat_rate', 'Flat Rate'),
]

PAYMENT_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('invoiced', 'Invoiced'),
    ('partial', 'Partially Paid'),
    ('paid', 'Paid'),
    ('disputed', 'Disputed'),
]

HARVEST_STATUS_CHOICES = [
    ('in_progress', 'In Progress'),
    ('complete', 'Complete'),
    ('verified', 'Verified'),
]

PAY_TYPE_CHOICES = [
    ('hourly', 'Hourly'),
    ('piece_rate', 'Piece Rate (per bin)'),
    ('contract', 'Contract/Flat Rate'),
]

CROP_VARIETY_CHOICES = [
    ('navel_orange', 'Navel Orange'),
    ('valencia_orange', 'Valencia Orange'),
    ('cara_cara', 'Cara Cara Orange'),
    ('blood_orange', 'Blood Orange'),
    ('meyer_lemon', 'Meyer Lemon'),
    ('eureka_lemon', 'Eureka Lemon'),
    ('lisbon_lemon', 'Lisbon Lemon'),
    ('lime', 'Lime'),
    ('grapefruit_white', 'White Grapefruit'),
    ('grapefruit_ruby', 'Ruby Red Grapefruit'),
    ('mandarin', 'Mandarin'),
    ('tangerine', 'Tangerine'),
    ('clementine', 'Clementine'),
    ('satsuma', 'Satsuma'),
    ('tangelo', 'Tangelo'),
    ('kumquat', 'Kumquat'),
    ('other', 'Other'),
]

# Default bin weights by crop type (in lbs)
DEFAULT_BIN_WEIGHTS = {
    'navel_orange': 900,
    'valencia_orange': 900,
    'cara_cara': 900,
    'blood_orange': 900,
    'meyer_lemon': 900,
    'eureka_lemon': 900,
    'lisbon_lemon': 900,
    'lime': 850,
    'grapefruit_white': 800,
    'grapefruit_ruby': 800,
    'mandarin': 800,
    'tangerine': 800,
    'clementine': 800,
    'satsuma': 800,
    'tangelo': 850,
    'kumquat': 800,
    'other': 900,
}


# -----------------------------------------------------------------------------
# BUYER MODEL
# -----------------------------------------------------------------------------

class Buyer(models.Model):
    """
    Represents a buyer/destination for harvested crops.
    Packing houses, processors, direct sale contacts, etc.
    """
    # Multi-tenancy
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='buyers',
        null=True,
        blank=True,
        help_text='Company that owns this buyer record'
    )

    name = models.CharField(max_length=200)
    buyer_type = models.CharField(
        max_length=20,
        choices=BUYER_TYPE_CHOICES,
        default='packing_house'
    )
    
    # Contact Information
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
    # Address
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)
    
    # Business Details
    license_number = models.CharField(
        max_length=50, 
        blank=True,
        help_text="Packer/shipper license number if applicable"
    )
    payment_terms = models.CharField(
        max_length=100, 
        blank=True,
        help_text="e.g., Net 30, COD, etc."
    )
    
    # Status
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Buyers"
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_buyer_co_active'),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_buyer_type_display()})"


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR MODEL
# -----------------------------------------------------------------------------

class LaborContractor(models.Model):
    """
    Represents a harvest labor contractor/crew company.
    """
    # Multi-tenancy
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='labor_contractors',
        null=True,
        blank=True,
        help_text='Company that owns this labor contractor record'
    )

    company_name = models.CharField(max_length=200)
    
    # Contact Information
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
    # Address
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)
    
    # Business/Compliance Details
    contractor_license = models.CharField(
        max_length=50,
        blank=True,
        help_text="Farm Labor Contractor License Number"
    )
    license_expiration = models.DateField(null=True, blank=True)
    insurance_carrier = models.CharField(max_length=200, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    insurance_expiration = models.DateField(null=True, blank=True)
    workers_comp_carrier = models.CharField(max_length=200, blank=True)
    workers_comp_policy = models.CharField(max_length=100, blank=True)
    workers_comp_expiration = models.DateField(null=True, blank=True)
    
    # GAP/GHP Training
    food_safety_training_current = models.BooleanField(
        default=False,
        help_text="Crew has current food safety training"
    )
    training_expiration = models.DateField(null=True, blank=True)
    
    # Rates (defaults, can be overridden per harvest)
    default_hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True
    )
    default_piece_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Rate per bin"
    )
    
    # Status
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['company_name']
        verbose_name = "Labor Contractor"
        verbose_name_plural = "Labor Contractors"
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_contr_co_active'),
        ]
    
    def __str__(self):
        return self.company_name
    
    @property
    def is_license_valid(self):
        if not self.license_expiration:
            return None
        from datetime import date
        return self.license_expiration >= date.today()
    
    @property
    def is_insurance_valid(self):
        if not self.insurance_expiration:
            return None
        from datetime import date
        return self.insurance_expiration >= date.today()


# -----------------------------------------------------------------------------
# HARVEST MODEL
# -----------------------------------------------------------------------------

class Harvest(models.Model):
    """
    Represents a single harvest event on a field.
    A field can have multiple harvests per season.
    """
    # Link to field (required)
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='harvests'
    )

    # Growing cycle (optional, for multi-cycle crops)
    growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='harvests',
        help_text="Associated growing cycle (for multi-cycle crops)"
    )

    # Basic Harvest Info
    harvest_date = models.DateField()
    harvest_number = models.PositiveIntegerField(
        default=1,
        help_text="Pick number this season (1st, 2nd, 3rd pick)"
    )
    crop_variety = models.CharField(
        max_length=30,
        choices=CROP_VARIETY_CHOICES,
        default='navel_orange'
    )
    
    # Quantity
    acres_harvested = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    total_bins = models.PositiveIntegerField(default=0)
    bin_weight_lbs = models.PositiveIntegerField(
        default=900,
        help_text="Weight per bin in pounds"
    )
    estimated_weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated from bins × bin_weight"
    )
    
    # PHI Compliance (auto-populated)
    phi_verified = models.BooleanField(
        default=False,
        help_text="User confirms PHI compliance check performed"
    )
    last_application_date = models.DateField(
        null=True,
        blank=True,
        help_text="Auto-populated from most recent application"
    )
    last_application_product = models.CharField(
        max_length=200,
        blank=True,
        help_text="Auto-populated"
    )
    days_since_last_application = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Auto-calculated"
    )
    phi_required_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="PHI from product label"
    )
    phi_compliant = models.BooleanField(
        null=True,
        blank=True,
        help_text="Auto-calculated: days_since >= phi_required"
    )
    
    # GAP/GHP Traceability
    lot_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        help_text="Auto-generated if blank"
    )
    field_conditions = models.TextField(
        blank=True,
        help_text="Weather, ground conditions, etc."
    )
    equipment_cleaned = models.BooleanField(
        default=False,
        help_text="Harvest equipment sanitation verified"
    )
    no_contamination_observed = models.BooleanField(
        default=False,
        help_text="No glass, metal, animal intrusion observed"
    )
    
    # Supervisor
    supervisor_name = models.CharField(max_length=200, blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=HARVEST_STATUS_CHOICES,
        default='in_progress'
    )
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-harvest_date', '-created_at']
        verbose_name_plural = "Harvests"
        indexes = [
            models.Index(fields=['crop_variety'], name='idx_harv_crop_var'),
            models.Index(fields=['harvest_date'], name='idx_harv_date'),
            models.Index(fields=['field', 'harvest_date'], name='idx_harv_field_date'),
        ]
    
    def __str__(self):
        return f"{self.field.name} - {self.harvest_date} (Pick #{self.harvest_number})"
    
    def save(self, *args, **kwargs):
        # Auto-generate lot number if not provided
        if not self.lot_number:
            self.lot_number = self._generate_lot_number()
        
        # Set default bin weight based on crop variety
        if not self.bin_weight_lbs or self.bin_weight_lbs == 900:
            self.bin_weight_lbs = DEFAULT_BIN_WEIGHTS.get(self.crop_variety, 900)
        
        # Calculate estimated weight
        if self.total_bins and self.bin_weight_lbs:
            self.estimated_weight_lbs = self.total_bins * self.bin_weight_lbs
        
        # Auto-populate PHI information
        self._populate_phi_info()
        
        super().save(*args, **kwargs)
    
    def _generate_lot_number(self):
        """Generate lot number: FARM-FIELD-YYYYMMDD-SEQ"""
        from datetime import date
        
        # Get farm initials (first letter of each word, max 4 chars)
        farm_name = self.field.farm.name if self.field.farm else "XX"
        initials = ''.join(word[0].upper() for word in farm_name.split()[:4])
        
        # Get field number or name abbreviation
        field_id = self.field.field_number or self.field.name[:3].upper()
        
        # Date portion
        date_str = self.harvest_date.strftime('%Y%m%d') if self.harvest_date else date.today().strftime('%Y%m%d')
        
        # Sequence number (count existing harvests on same field/date)
        base_lot = f"{initials}-{field_id}-{date_str}"
        existing_count = Harvest.objects.filter(
            lot_number__startswith=base_lot
        ).count()
        
        return f"{base_lot}-{existing_count + 1:02d}"
    
    def _populate_phi_info(self):
        """Auto-populate PHI compliance information from recent applications."""
        if not self.field_id:
            return
            
        # Get most recent application on this field
        from django.apps import apps
        PesticideApplication = apps.get_model('api', 'PesticideApplication')
        
        last_app = PesticideApplication.objects.filter(
            field_id=self.field_id
        ).select_related('product').order_by('-application_date').first()
        
        if last_app:
            self.last_application_date = last_app.application_date
            if last_app.product:
                self.last_application_product = last_app.product.product_name
                self.phi_required_days = last_app.product.phi_days
            
            # Calculate days since application
            if self.harvest_date and self.last_application_date:
                delta = self.harvest_date - self.last_application_date
                self.days_since_last_application = delta.days
                
                # Determine compliance
                if self.phi_required_days:
                    self.phi_compliant = self.days_since_last_application >= self.phi_required_days
    
    @property
    def total_revenue(self):
        """Calculate total revenue from all loads."""
        return sum(load.total_revenue or 0 for load in self.loads.all())
    
    @property
    def total_labor_cost(self):
        """Calculate total labor cost from all labor records."""
        return sum(labor.total_labor_cost or 0 for labor in self.labor_records.all())
    
    @property
    def yield_per_acre(self):
        """Calculate bins per acre."""
        if self.acres_harvested and self.total_bins:
            return round(self.total_bins / float(self.acres_harvested), 1)
        return None


# -----------------------------------------------------------------------------
# HARVEST LOAD MODEL
# -----------------------------------------------------------------------------

class HarvestLoad(models.Model):
    """
    Represents a single load/delivery from a harvest.
    Supports split loads to multiple buyers.
    """
    harvest = models.ForeignKey(
        Harvest,
        on_delete=models.CASCADE,
        related_name='loads'
    )
    
    load_number = models.PositiveIntegerField(
        default=1,
        help_text="Load number within this harvest"
    )
    
    # Quantity
    bins = models.PositiveIntegerField(default=0)
    weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Scale weight"
    )
    weight_ticket_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="Scale ticket reference"
    )
    
    # Destination
    buyer = models.ForeignKey(
        Buyer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loads'
    )
    destination_address = models.CharField(
        max_length=255,
        blank=True,
        help_text="Override buyer address if different"
    )
    
    # Grade & Quality
    grade = models.CharField(
        max_length=20,
        choices=GRADE_CHOICES,
        default='choice'
    )
    size_grade = models.CharField(
        max_length=10,
        choices=SIZE_GRADE_CHOICES,
        blank=True
    )
    quality_notes = models.TextField(
        blank=True,
        help_text="Brix, color, defects, etc."
    )
    
    # Revenue
    price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    price_unit = models.CharField(
        max_length=20,
        choices=PRICE_UNIT_CHOICES,
        default='per_bin'
    )
    total_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated or manual override"
    )
    
    # Payment Tracking
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    payment_date = models.DateField(null=True, blank=True)
    payment_due_date = models.DateField(
        null=True,
        blank=True,
        help_text='Expected payment date based on buyer payment terms'
    )
    invoice_number = models.CharField(max_length=50, blank=True)
    
    # GAP/GHP Transportation Traceability
    truck_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="License plate or truck number"
    )
    trailer_id = models.CharField(max_length=50, blank=True)
    driver_name = models.CharField(max_length=200, blank=True)
    departure_time = models.DateTimeField(null=True, blank=True)
    arrival_time = models.DateTimeField(null=True, blank=True)
    temperature_at_loading = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="°F at time of loading"
    )
    seal_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="Trailer seal number if applicable"
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['harvest', 'load_number']
        verbose_name = "Harvest Load"
        verbose_name_plural = "Harvest Loads"
        indexes = [
            models.Index(fields=['payment_status'], name='idx_load_pay_status'),
            models.Index(fields=['buyer'], name='idx_load_buyer'),
        ]
    
    def __str__(self):
        buyer_name = self.buyer.name if self.buyer else "Unknown"
        return f"Load #{self.load_number} - {self.bins} bins to {buyer_name}"
    
    def save(self, *args, **kwargs):
        # Auto-calculate revenue if not manually set
        if self.price_per_unit and not self.total_revenue:
            self.total_revenue = self._calculate_revenue()
        
        # Auto-increment load number
        if not self.load_number:
            existing = HarvestLoad.objects.filter(harvest=self.harvest).count()
            self.load_number = existing + 1
        
        super().save(*args, **kwargs)
    
    def _calculate_revenue(self):
        """Calculate total revenue based on price unit."""
        if not self.price_per_unit:
            return None

        if self.price_unit == 'per_bin':
            return self.bins * self.price_per_unit
        elif self.price_unit == 'per_lb' and self.weight_lbs:
            return self.weight_lbs * self.price_per_unit
        elif self.price_unit == 'per_ton' and self.weight_lbs:
            return (self.weight_lbs / 2000) * self.price_per_unit
        elif self.price_unit == 'flat_rate':
            return self.price_per_unit

        return None

    @property
    def days_overdue(self):
        """Calculate days overdue if payment is past due date."""
        if not self.payment_due_date:
            return None
        if self.payment_status in ['paid', 'cancelled']:
            return None

        from datetime import date
        today = date.today()
        if today > self.payment_due_date:
            return (today - self.payment_due_date).days
        return 0


# -----------------------------------------------------------------------------
# HARVEST LABOR MODEL
# -----------------------------------------------------------------------------

class HarvestLabor(models.Model):
    """
    Tracks labor/crew information for a harvest.
    Supports GAP/GHP worker compliance documentation.
    """
    harvest = models.ForeignKey(
        Harvest,
        on_delete=models.CASCADE,
        related_name='labor_records'
    )
    
    # Crew Information
    contractor = models.ForeignKey(
        LaborContractor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='harvest_jobs'
    )
    crew_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Crew identifier or name"
    )
    foreman_name = models.CharField(max_length=200, blank=True)
    worker_count = models.PositiveIntegerField(default=1)
    
    # Time Tracking
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    total_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated or manual entry"
    )
    
    # Cost Tracking
    pay_type = models.CharField(
        max_length=20,
        choices=PAY_TYPE_CHOICES,
        default='piece_rate'
    )
    rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="$/hour or $/bin depending on pay_type"
    )
    bins_picked = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="For piece rate calculation"
    )
    total_labor_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated or manual entry"
    )
    
    # GAP/GHP Compliance
    training_verified = models.BooleanField(
        default=False,
        help_text="Workers have current food safety training"
    )
    hygiene_facilities_available = models.BooleanField(
        default=False,
        help_text="Handwashing stations and toilets available"
    )
    illness_check_performed = models.BooleanField(
        default=False,
        help_text="Workers checked for illness/symptoms"
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['harvest', '-start_time']
        verbose_name = "Harvest Labor Record"
        verbose_name_plural = "Harvest Labor Records"
        indexes = [
            models.Index(fields=['contractor'], name='idx_labor_contractor'),
        ]
    
    def __str__(self):
        contractor_name = self.contractor.company_name if self.contractor else self.crew_name
        return f"{contractor_name} - {self.worker_count} workers"
    
    def save(self, *args, **kwargs):
        # Auto-calculate hours from start/end time
        if self.start_time and self.end_time and not self.total_hours:
            delta = self.end_time - self.start_time
            self.total_hours = round(delta.total_seconds() / 3600, 2)
        
        # Auto-calculate labor cost
        if not self.total_labor_cost:
            self.total_labor_cost = self._calculate_cost()
        
        super().save(*args, **kwargs)
    
    def _calculate_cost(self):
        """Calculate total labor cost based on pay type."""
        if not self.rate:
            return None
            
        if self.pay_type == 'hourly' and self.total_hours:
            return self.total_hours * self.rate * self.worker_count
        elif self.pay_type == 'piece_rate' and self.bins_picked:
            return self.bins_picked * self.rate
        elif self.pay_type == 'contract':
            return self.rate  # Flat rate
        
        return None
    
    @property
    def cost_per_bin(self):
        """Calculate labor cost per bin for analysis."""
        if self.total_labor_cost and self.bins_picked and self.bins_picked > 0:
            return round(float(self.total_labor_cost) / self.bins_picked, 2)
        return None

# -----------------------------------------------------------------------------
# SGMA CHOICES
# -----------------------------------------------------------------------------

GSA_CHOICES = [
    ('obgma', 'Ojai Basin Groundwater Management Agency (OBGMA)'),
    ('fpbgsa', 'Fillmore and Piru Basins GSA'),
    ('uvrga', 'Upper Ventura River Groundwater Agency'),
    ('fcgma', 'Fox Canyon Groundwater Management Agency'),
    ('other', 'Other'),
    ('none', 'Not in GSA Jurisdiction'),
]

GROUNDWATER_BASIN_CHOICES = [
    ('ojai_valley', 'Ojai Valley (4-002)'),
    ('upper_ventura_river', 'Upper Ventura River (4-003.01)'),
    ('lower_ventura_river', 'Lower Ventura River (4-003.02)'),
    ('fillmore', 'Santa Clara River Valley - Fillmore (4-004.05)'),
    ('piru', 'Santa Clara River Valley - Piru (4-004.06)'),
    ('santa_paula', 'Santa Clara River Valley - Santa Paula (4-004.04)'),
    ('oxnard', 'Santa Clara River Valley - Oxnard (4-004.02)'),
    ('pleasant_valley', 'Pleasant Valley (4-006)'),
    ('las_posas', 'Las Posas Valley (4-008)'),
    ('arroyo_santa_rosa', 'Arroyo Santa Rosa Valley (4-007)'),
    ('mound', 'Mound (4-004.01)'),
    ('other', 'Other'),
]

BASIN_PRIORITY_CHOICES = [
    ('critical', 'Critically Overdrafted'),
    ('high', 'High Priority'),
    ('medium', 'Medium Priority'),
    ('low', 'Low Priority'),
    ('very_low', 'Very Low Priority'),
]

PUMP_TYPE_CHOICES = [
    ('submersible', 'Submersible'),
    ('turbine', 'Vertical Turbine'),
    ('jet', 'Jet Pump'),
    ('centrifugal', 'Centrifugal'),
    ('other', 'Other'),
]

POWER_SOURCE_CHOICES = [
    ('electric_utility', 'Electric - Utility'),
    ('electric_solar', 'Electric - Solar'),
    ('diesel', 'Diesel Engine'),
    ('natural_gas', 'Natural Gas Engine'),
    ('propane', 'Propane Engine'),
    ('other', 'Other'),
]

FLOWMETER_UNIT_CHOICES = [
    ('acre_feet', 'Acre-Feet'),
    ('gallons', 'Gallons'),
    ('hundred_gallons', 'Hundred Gallons'),
    ('thousand_gallons', 'Thousand Gallons'),
    ('cubic_feet', 'Cubic Feet'),
    ('hundred_cubic_feet', 'Hundred Cubic Feet (CCF)'),
]

WELL_STATUS_CHOICES = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
    ('standby', 'Standby/Emergency'),
    ('destroyed', 'Destroyed/Abandoned'),
    ('monitoring', 'Monitoring Only'),
]

READING_TYPE_CHOICES = [
    ('manual', 'Manual Reading'),
    ('ami_automatic', 'AMI Automatic'),
    ('estimated', 'Estimated'),
    ('initial', 'Initial Reading'),
    ('final', 'Final Reading'),
]

CALIBRATION_TYPE_CHOICES = [
    ('field', 'Field Calibration'),
    ('shop', 'Shop/Bench Calibration'),
    ('replacement', 'Meter Replacement'),
    ('initial', 'Initial Installation'),
]

ALLOCATION_TYPE_CHOICES = [
    ('base', 'Base Allocation'),
    ('historical', 'Historical Use Allocation'),
    ('supplemental', 'Supplemental Allocation'),
    ('carryover', 'Carryover from Previous Year'),
    ('purchased', 'Purchased (Water Market)'),
    ('transferred_in', 'Transferred In'),
    ('transferred_out', 'Transferred Out'),
]

ALLOCATION_SOURCE_CHOICES = [
    ('gsa', 'GSA Base Allocation'),
    ('water_market', 'Water Market Purchase'),
    ('transfer', 'Direct Transfer'),
    ('recharge_credit', 'Recharge Credit'),
]

REPORT_PERIOD_TYPE_CHOICES = [
    ('semi_annual_1', 'Semi-Annual Period 1 (Oct-Mar)'),
    ('semi_annual_2', 'Semi-Annual Period 2 (Apr-Sep)'),
    ('annual', 'Annual (Full Water Year)'),
    ('monthly', 'Monthly'),
    ('quarterly', 'Quarterly'),
]

REPORT_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('ready', 'Ready to Submit'),
    ('submitted', 'Submitted to GSA'),
    ('confirmed', 'Confirmed by GSA'),
    ('revision_needed', 'Revision Needed'),
]

REPORT_PAYMENT_STATUS_CHOICES = [
    ('not_due', 'Not Yet Due'),
    ('pending', 'Pending'),
    ('paid', 'Paid'),
    ('overdue', 'Overdue'),
]

IRRIGATION_METHOD_CHOICES = [
    ('drip', 'Drip'),
    ('micro_sprinkler', 'Micro-Sprinkler'),
    ('sprinkler', 'Sprinkler'),
    ('flood', 'Flood/Furrow'),
    ('pivot', 'Center Pivot'),
    ('hand_water', 'Hand Watering'),
    ('other', 'Other'),
]

MEASUREMENT_METHOD_CHOICES = [
    ('meter', 'Flowmeter Reading'),
    ('calculated', 'Calculated (flow rate × time)'),
    ('estimated', 'Estimated'),
]


# -----------------------------------------------------------------------------
# WELL READING MODEL (References WaterSource instead of Well)
# -----------------------------------------------------------------------------

class WellReading(models.Model):
    """
    Individual meter readings for tracking groundwater extraction.
    Now references WaterSource directly (merged Well model).
    """
    
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.CASCADE,
        related_name='readings',
        limit_choices_to={'source_type': 'well'}
    )
    
    # === READING DETAILS ===
    reading_date = models.DateField()
    reading_time = models.TimeField(null=True, blank=True)
    
    meter_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        help_text="Actual meter totalizer reading"
    )
    
    # === CALCULATED EXTRACTION ===
    previous_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Previous meter reading (auto-populated)"
    )
    previous_reading_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of previous reading"
    )
    extraction_native_units = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Extraction in meter's native units"
    )
    extraction_acre_feet = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Extraction converted to acre-feet"
    )
    extraction_gallons = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Extraction converted to gallons"
    )
    
    # === READING TYPE ===
    reading_type = models.CharField(
        max_length=20,
        choices=READING_TYPE_CHOICES,
        default='manual'
    )
    
    # === DOCUMENTATION ===
    meter_photo = models.ImageField(
        upload_to='meter_readings/',
        null=True,
        blank=True,
        help_text="Photo of meter face showing reading"
    )
    
    # === OPERATIONAL DATA ===
    pump_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Pump runtime hours (if hour meter installed)"
    )
    water_level_ft = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Water level at time of reading (ft below surface)"
    )
    
    # === METER ROLLOVER ===
    meter_rollover = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Meter rollover value if meter reset (e.g., 1000000)"
    )

    # === DOMESTIC/IRRIGATION SPLIT ===
    domestic_extraction_af = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Domestic portion of extraction (acre-feet)"
    )
    irrigation_extraction_af = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Irrigation portion of extraction (acre-feet)"
    )

    # === CALCULATED FEES ===
    base_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated base extraction fee"
    )
    gsp_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated GSP/SGMA fee"
    )
    domestic_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated domestic fee"
    )
    fixed_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Fixed quarterly fee"
    )
    total_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total fees due this period"
    )

    # === METADATA ===
    recorded_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reading_date', '-reading_time']
        indexes = [
            models.Index(fields=['water_source', '-reading_date']),
        ]

    def __str__(self):
        return f"{self.water_source.name} - {self.reading_date}: {self.meter_reading}"

    def save(self, *args, **kwargs):
        """Auto-calculate extraction and fees on save."""
        # Get previous reading if not set
        if self.previous_reading is None:
            prev = WellReading.objects.filter(
                water_source=self.water_source,
                reading_date__lt=self.reading_date
            ).order_by('-reading_date', '-reading_time').first()

            if prev:
                self.previous_reading = prev.meter_reading
                self.previous_reading_date = prev.reading_date

        # Calculate extraction
        if self.previous_reading is not None and self.meter_reading is not None:
            multiplier = self.water_source.flowmeter_multiplier or Decimal('1.0')

            # Handle meter rollover
            if self.meter_rollover:
                # Meter rolled over: usage = (rollover - previous) + current
                raw_extraction = ((self.meter_rollover - self.previous_reading) + self.meter_reading) * multiplier
            else:
                raw_extraction = (self.meter_reading - self.previous_reading) * multiplier

            self.extraction_native_units = raw_extraction
            self.extraction_acre_feet = self._convert_to_acre_feet(raw_extraction)
            if self.extraction_acre_feet:
                self.extraction_gallons = self.extraction_acre_feet * Decimal('325851')

            # Split domestic/irrigation extraction
            self._calculate_usage_split()

            # Calculate fees
            self._calculate_fees()

        super().save(*args, **kwargs)

    def _calculate_usage_split(self):
        """Split extraction into domestic and irrigation based on well type."""
        if self.extraction_acre_feet is None:
            return

        ws = self.water_source
        if ws.is_domestic_well:
            # All extraction is domestic for domestic wells
            self.domestic_extraction_af = self.extraction_acre_feet
            self.irrigation_extraction_af = Decimal('0')
        else:
            # All extraction is irrigation for non-domestic wells
            # (user can manually override domestic_extraction_af if needed)
            if self.domestic_extraction_af is None:
                self.domestic_extraction_af = Decimal('0')
            if self.irrigation_extraction_af is None:
                # Irrigation = total - domestic
                self.irrigation_extraction_af = self.extraction_acre_feet - (self.domestic_extraction_af or Decimal('0'))

    def _calculate_fees(self):
        """Auto-calculate fees based on water source rate configuration."""
        ws = self.water_source

        # Reset fees
        self.base_fee = Decimal('0')
        self.gsp_fee = Decimal('0')
        self.domestic_fee = Decimal('0')
        self.fixed_fee = Decimal('0')

        # Calculate base fee (irrigation extraction * base rate)
        irrigation_af = self.irrigation_extraction_af or Decimal('0')
        if ws.base_extraction_rate and irrigation_af > 0:
            self.base_fee = irrigation_af * ws.base_extraction_rate

        # Calculate GSP/SGMA fee (total extraction * gsp rate)
        total_af = self.extraction_acre_feet or Decimal('0')
        if ws.gsp_rate and total_af > 0:
            self.gsp_fee = total_af * ws.gsp_rate

        # Calculate domestic fee (domestic extraction * domestic rate)
        domestic_af = self.domestic_extraction_af or Decimal('0')
        if ws.domestic_rate and domestic_af > 0:
            self.domestic_fee = domestic_af * ws.domestic_rate

        # Fixed quarterly fee
        if ws.fixed_quarterly_fee:
            self.fixed_fee = ws.fixed_quarterly_fee

        # Total fees
        self.total_fee = (
            (self.base_fee or Decimal('0')) +
            (self.gsp_fee or Decimal('0')) +
            (self.domestic_fee or Decimal('0')) +
            (self.fixed_fee or Decimal('0'))
        )

    def _convert_to_acre_feet(self, value):
        """Convert native units to acre-feet."""
        unit = self.water_source.flowmeter_units
        if unit == 'acre_feet':
            return value
        elif unit == 'gallons':
            return value / Decimal('325851')
        elif unit == 'hundred_gallons':
            return (value * 100) / Decimal('325851')
        elif unit == 'thousand_gallons':
            return (value * 1000) / Decimal('325851')
        elif unit == 'cubic_feet':
            return value / Decimal('43560')
        elif unit == 'hundred_cubic_feet':
            return (value * 100) / Decimal('43560')
        return value


# -----------------------------------------------------------------------------
# METER CALIBRATION MODEL
# -----------------------------------------------------------------------------

class MeterCalibration(models.Model):
    """
    Flowmeter calibration records. Required every 3 years for most GSAs.
    Accuracy must be within +/- 5%.
    Now references WaterSource directly (merged Well model).
    """
    
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.CASCADE,
        related_name='calibrations',
        limit_choices_to={'source_type': 'well'}
    )
    
    # === CALIBRATION DETAILS ===
    calibration_date = models.DateField()
    next_calibration_due = models.DateField(
        help_text="Typically 3 years from calibration date"
    )
    calibration_type = models.CharField(
        max_length=20,
        choices=CALIBRATION_TYPE_CHOICES,
        default='field'
    )
    
    # === CALIBRATION RESULTS ===
    pre_calibration_accuracy = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Accuracy percentage before calibration"
    )
    post_calibration_accuracy = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Accuracy percentage after calibration (must be within +/- 5%)"
    )
    passed = models.BooleanField(
        default=False,
        help_text="Did calibration meet required accuracy standards?"
    )
    
    # === METER STATUS ===
    meter_reading_before = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True
    )
    meter_reading_after = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True
    )
    meter_replaced = models.BooleanField(default=False)
    new_meter_serial = models.CharField(
        max_length=100,
        blank=True,
        help_text="If meter was replaced, new serial number"
    )
    new_meter_make = models.CharField(max_length=100, blank=True)
    new_meter_model = models.CharField(max_length=100, blank=True)
    
    # === SERVICE PROVIDER ===
    calibration_company = models.CharField(max_length=200, blank=True)
    technician_name = models.CharField(max_length=100, blank=True)
    technician_license = models.CharField(max_length=50, blank=True)
    technician_phone = models.CharField(max_length=20, blank=True)
    
    # === DOCUMENTATION ===
    calibration_report = models.FileField(
        upload_to='calibration_reports/',
        null=True,
        blank=True,
        help_text="Upload calibration test report PDF"
    )
    invoice = models.FileField(
        upload_to='calibration_invoices/',
        null=True,
        blank=True
    )
    
    # === COST TRACKING ===
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # === METADATA ===
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-calibration_date']
        verbose_name = "Meter Calibration"
        verbose_name_plural = "Meter Calibrations"
    
    def __str__(self):
        status = "✓ Passed" if self.passed else "✗ Failed"
        return f"{self.water_source.name} - {self.calibration_date} - {status}"
    
    def save(self, *args, **kwargs):
        """Update water source's calibration status on save."""
        super().save(*args, **kwargs)
        
        if self.passed:
            self.water_source.meter_calibration_current = True
            self.water_source.next_calibration_due = self.next_calibration_due
            
            if self.meter_replaced and self.new_meter_serial:
                self.water_source.flowmeter_serial_number = self.new_meter_serial
                if self.new_meter_make:
                    self.water_source.flowmeter_make = self.new_meter_make
                if self.new_meter_model:
                    self.water_source.flowmeter_model = self.new_meter_model
            
            self.water_source.save()


# -----------------------------------------------------------------------------
# WATER ALLOCATION MODEL
# -----------------------------------------------------------------------------

class WaterAllocation(models.Model):
    """
    Water extraction allocations assigned by GSA.
    Tracks annual/seasonal limits and allocation sources.
    Now references WaterSource directly (merged Well model).
    """
    
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.CASCADE,
        related_name='allocations',
        limit_choices_to={'source_type': 'well'}
    )
    
    # === ALLOCATION PERIOD ===
    water_year = models.CharField(
        max_length=9,
        help_text="Water year (e.g., '2024-2025' for Oct 2024 - Sep 2025)"
    )
    period_start = models.DateField()
    period_end = models.DateField()
    
    # === ALLOCATION AMOUNTS ===
    allocation_type = models.CharField(
        max_length=20,
        choices=ALLOCATION_TYPE_CHOICES,
        default='base'
    )
    allocated_acre_feet = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Allocated extraction amount in acre-feet"
    )
    
    # === ALLOCATION SOURCE ===
    source = models.CharField(
        max_length=20,
        choices=ALLOCATION_SOURCE_CHOICES,
        default='gsa'
    )
    source_well_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Source well ID if transferred/purchased"
    )
    transfer_agreement_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="GSA transfer/water market agreement number"
    )
    
    # === COST ===
    cost_per_acre_foot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # === DOCUMENTATION ===
    allocation_notice = models.FileField(
        upload_to='allocation_notices/',
        null=True,
        blank=True
    )
    
    # === METADATA ===
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-water_year', 'water_source']
        verbose_name = "Water Allocation"
        verbose_name_plural = "Water Allocations"
    
    def __str__(self):
        return f"{self.well} - {self.water_year}: {self.allocated_acre_feet} AF ({self.get_allocation_type_display()})"
    
    def save(self, *args, **kwargs):
        """Auto-calculate total cost if rate is provided."""
        if self.cost_per_acre_foot and not self.total_cost:
            self.total_cost = self.cost_per_acre_foot * self.allocated_acre_feet
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# EXTRACTION REPORT MODEL
# -----------------------------------------------------------------------------

class ExtractionReport(models.Model):
    """
    Extraction reports for GSA compliance.
    Aggregates well readings for reporting periods.
    Now references WaterSource directly (merged Well model).
    """
    
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.CASCADE,
        related_name='extraction_reports',
        limit_choices_to={'source_type': 'well'}
    )
    
    # === REPORTING PERIOD ===
    period_type = models.CharField(
        max_length=20,
        choices=REPORT_PERIOD_TYPE_CHOICES,
        default='semi_annual_1'
    )
    reporting_period = models.CharField(
        max_length=20,
        help_text="Period identifier (e.g., '2024-1' for Oct 2023 - Mar 2024)"
    )
    period_start_date = models.DateField()
    period_end_date = models.DateField()
    
    # === METER READINGS ===
    beginning_meter_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        help_text="Meter reading at start of period"
    )
    beginning_reading_date = models.DateField(
        null=True,
        blank=True
    )
    ending_meter_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        help_text="Meter reading at end of period"
    )
    ending_reading_date = models.DateField(
        null=True,
        blank=True
    )
    
    # === EXTRACTION TOTALS ===
    total_extraction_native = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Total extraction in meter's native units"
    )
    total_extraction_af = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Total extraction in acre-feet"
    )
    total_extraction_gallons = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # === ALLOCATION COMPARISON ===
    period_allocation_af = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Allocation for this period"
    )
    allocation_remaining_af = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True
    )
    over_allocation = models.BooleanField(
        default=False,
        help_text="Did extraction exceed allocation?"
    )
    over_allocation_af = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Amount over allocation"
    )
    
    # === FEES ===
    extraction_fee_rate = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Fee rate per acre-foot"
    )
    base_extraction_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    surcharge_rate = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Surcharge rate for over-allocation"
    )
    surcharge_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    administrative_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Any additional administrative fees"
    )
    total_fees_due = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # === REPORT STATUS ===
    status = models.CharField(
        max_length=20,
        choices=REPORT_STATUS_CHOICES,
        default='draft'
    )
    submitted_date = models.DateField(null=True, blank=True)
    gsa_confirmation_number = models.CharField(max_length=50, blank=True)
    gsa_confirmation_date = models.DateField(null=True, blank=True)
    
    # === PAYMENT ===
    payment_status = models.CharField(
        max_length=20,
        choices=REPORT_PAYMENT_STATUS_CHOICES,
        default='not_due'
    )
    payment_due_date = models.DateField(null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    payment_confirmation = models.CharField(max_length=100, blank=True)
    payment_method = models.CharField(
        max_length=50,
        blank=True,
        help_text="Check, ACH, credit card, etc."
    )
    
    # === DOCUMENTATION ===
    submitted_report = models.FileField(
        upload_to='extraction_reports/',
        null=True,
        blank=True
    )
    gsa_receipt = models.FileField(
        upload_to='extraction_receipts/',
        null=True,
        blank=True
    )
    
    # === METADATA ===
    prepared_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-period_start_date', 'water_source']
        unique_together = ['water_source', 'reporting_period']
        verbose_name = "Extraction Report"
        verbose_name_plural = "Extraction Reports"
    
    def __str__(self):
        return f"{self.water_source.name} - {self.reporting_period}: {self.total_extraction_af} AF"
    
    def calculate_extraction(self):
        """Calculate extraction from meter readings."""
        if self.beginning_meter_reading and self.ending_meter_reading:
            multiplier = self.water_source.flowmeter_multiplier or Decimal('1.0')
            raw = (self.ending_meter_reading - self.beginning_meter_reading) * multiplier
            self.total_extraction_native = raw
            
            # Convert based on meter units
            unit = self.water_source.flowmeter_units
            if unit == 'acre_feet':
                self.total_extraction_af = raw
            elif unit == 'gallons':
                self.total_extraction_af = raw / Decimal('325851')
            elif unit == 'hundred_gallons':
                self.total_extraction_af = (raw * 100) / Decimal('325851')
            elif unit == 'thousand_gallons':
                self.total_extraction_af = (raw * 1000) / Decimal('325851')
            elif unit == 'cubic_feet':
                self.total_extraction_af = raw / Decimal('43560')
            elif unit == 'hundred_cubic_feet':
                self.total_extraction_af = (raw * 100) / Decimal('43560')
            
            if self.total_extraction_af:
                self.total_extraction_gallons = self.total_extraction_af * Decimal('325851')
    
    def calculate_fees(self):
        """Calculate fees based on extraction and rates."""
        if self.total_extraction_af and self.extraction_fee_rate:
            self.base_extraction_fee = self.total_extraction_af * self.extraction_fee_rate
            
            # Calculate surcharge if over allocation
            if self.over_allocation and self.over_allocation_af and self.surcharge_rate:
                self.surcharge_amount = self.over_allocation_af * self.surcharge_rate
            
            # Total fees
            self.total_fees_due = (self.base_extraction_fee or Decimal('0')) + \
                                  (self.surcharge_amount or Decimal('0')) + \
                                  (self.administrative_fee or Decimal('0'))
    
    def save(self, *args, **kwargs):
        """Auto-calculate values on save."""
        self.calculate_extraction()
        
        # Check allocation
        if self.period_allocation_af and self.total_extraction_af:
            self.allocation_remaining_af = self.period_allocation_af - self.total_extraction_af
            if self.allocation_remaining_af < 0:
                self.over_allocation = True
                self.over_allocation_af = abs(self.allocation_remaining_af)
            else:
                self.over_allocation = False
                self.over_allocation_af = None
        
        self.calculate_fees()
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# IRRIGATION EVENT MODEL
# -----------------------------------------------------------------------------

class IrrigationEvent(models.Model):
    """
    Optional tracking of irrigation events to link water usage to specific fields.
    Useful for water budgeting and crop water use analysis.
    Now uses unified WaterSource model (which includes wells).
    Can also link to IrrigationZone for scheduling module.
    """

    METHOD_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('manual', 'Manual'),
        ('rainfall', 'Rainfall (Natural)'),
    ]

    SOURCE_CHOICES = [
        ('manual', 'Manual Entry'),
        ('recommendation', 'From Recommendation'),
        ('sensor', 'Sensor Triggered'),
        ('schedule', 'Automated Schedule'),
    ]

    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='irrigation_events',
        null=True,
        blank=True,
        help_text="Field irrigated (optional if zone is set)"
    )
    zone = models.ForeignKey(
        'IrrigationZone',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='irrigation_events',
        help_text="Irrigation zone (for scheduling module)"
    )
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='irrigation_events',
        help_text="Water source used (well, municipal, surface, etc.)"
    )
    recommendation = models.ForeignKey(
        'IrrigationRecommendation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events',
        help_text="Recommendation this event fulfills"
    )
    
    # === EVENT DETAILS ===
    irrigation_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    duration_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # === WATER APPLIED ===
    measurement_method = models.CharField(
        max_length=20,
        choices=MEASUREMENT_METHOD_CHOICES,
        default='calculated'
    )
    water_applied_af = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Water applied in acre-feet"
    )
    water_applied_gallons = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    acre_inches = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Inches of water applied across field"
    )
    
    # === IRRIGATION METHOD ===
    irrigation_method = models.CharField(
        max_length=20,
        choices=IRRIGATION_METHOD_CHOICES,
        blank=True
    )
    
    # === ZONES ===
    zone_or_block = models.CharField(
        max_length=50,
        blank=True,
        help_text="Specific zone or block irrigated"
    )
    acres_irrigated = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Acres irrigated (may be less than total field acres)"
    )

    # === IRRIGATION SCHEDULING FIELDS ===
    date = models.DateField(
        null=True,
        blank=True,
        help_text="Alias for irrigation_date (for scheduling module)"
    )
    depth_inches = models.DecimalField(
        max_digits=5,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Application depth (inches) for scheduling"
    )
    method = models.CharField(
        max_length=20,
        choices=METHOD_CHOICES,
        default='manual',
        help_text="How irrigation was triggered"
    )
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default='manual',
        help_text="Source of irrigation event record"
    )

    # === METADATA ===
    recorded_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-irrigation_date', '-start_time']
        verbose_name = "Irrigation Event"
        verbose_name_plural = "Irrigation Events"

    def __str__(self):
        if self.zone:
            return f"{self.zone.name} - {self.date or self.irrigation_date}: {self.depth_inches or 0} in"
        return f"{self.field} - {self.irrigation_date}: {self.water_applied_af or 0} AF"
    
    def save(self, *args, **kwargs):
        """Auto-calculate duration, water conversions, and sync date fields."""
        # Sync date fields (date is alias for irrigation_date for scheduling module)
        if self.date and not self.irrigation_date:
            self.irrigation_date = self.date
        elif self.irrigation_date and not self.date:
            self.date = self.irrigation_date

        # Auto-set field from zone if zone is set
        if self.zone and not self.field:
            self.field = self.zone.field

        # Calculate depth from duration and application rate (for zone-based events)
        if self.zone and self.duration_hours and not self.depth_inches:
            if self.zone.application_rate:
                self.depth_inches = self.duration_hours * self.zone.application_rate

        # Calculate duration from times
        if self.start_time and self.end_time and not self.duration_hours:
            from datetime import datetime, timedelta
            ref_date = self.irrigation_date or self.date
            if ref_date:
                start = datetime.combine(ref_date, self.start_time)
                end = datetime.combine(ref_date, self.end_time)
                if end < start:  # Crossed midnight
                    end += timedelta(days=1)
                delta = end - start
                self.duration_hours = Decimal(str(round(delta.total_seconds() / 3600, 2)))

        # Calculate water applied from flow rate and duration (for wells)
        if self.water_source and self.water_source.is_well and self.duration_hours and not self.water_applied_af:
            if self.water_source.pump_flow_rate_gpm:
                gallons = self.water_source.pump_flow_rate_gpm * self.duration_hours * 60
                self.water_applied_gallons = gallons
                self.water_applied_af = gallons / Decimal('325851')

        # Convert between AF and gallons if one is set
        if self.water_applied_af and not self.water_applied_gallons:
            self.water_applied_gallons = self.water_applied_af * Decimal('325851')
        elif self.water_applied_gallons and not self.water_applied_af:
            self.water_applied_af = self.water_applied_gallons / Decimal('325851')

        # Calculate acre-inches if acres known
        if self.water_applied_af and self.acres_irrigated:
            # 1 AF over 1 acre = 12 inches
            self.acre_inches = (self.water_applied_af / self.acres_irrigated) * 12

        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# IRRIGATION SCHEDULING MODELS
# -----------------------------------------------------------------------------

class IrrigationZone(models.Model):
    """
    An irrigation management unit within a field.
    Contains soil, system, and scheduling configuration for water balance calculations.
    """

    IRRIGATION_METHOD_CHOICES = [
        ('drip', 'Drip'),
        ('micro_sprinkler', 'Micro-Sprinkler'),
        ('flood', 'Flood'),
        ('furrow', 'Furrow'),
        ('sprinkler', 'Sprinkler'),
    ]

    SOIL_TYPE_CHOICES = [
        ('sandy', 'Sandy'),
        ('sandy_loam', 'Sandy Loam'),
        ('loam', 'Loam'),
        ('clay_loam', 'Clay Loam'),
        ('clay', 'Clay'),
    ]

    CIMIS_TARGET_TYPE_CHOICES = [
        ('station', 'Station'),
        ('spatial', 'Spatial (Zip)'),
    ]

    # Relationship
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='irrigation_zones'
    )
    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='irrigation_zones'
    )

    # Basic info
    name = models.CharField(max_length=200, help_text="Zone name (e.g., 'Block A Drip')")
    acres = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Zone acreage"
    )
    crop_type = models.CharField(max_length=50, default='citrus', help_text="Primary crop type")
    tree_age = models.IntegerField(
        null=True,
        blank=True,
        help_text="Tree age in years"
    )
    tree_spacing_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Tree spacing in feet"
    )

    # Irrigation system
    irrigation_method = models.CharField(
        max_length=20,
        choices=IRRIGATION_METHOD_CHOICES,
        default='drip'
    )
    emitters_per_tree = models.IntegerField(
        null=True,
        blank=True,
        help_text="Number of emitters per tree"
    )
    emitter_gph = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Emitter flow rate (GPH)"
    )
    application_rate = models.DecimalField(
        max_digits=5,
        decimal_places=3,
        default=Decimal('0.05'),
        null=True,
        blank=True,
        help_text="Water application rate (inches per hour)"
    )
    distribution_uniformity = models.IntegerField(
        default=85,
        help_text="System efficiency (0-100%)"
    )

    # Soil characteristics
    soil_type = models.CharField(
        max_length=30,
        choices=SOIL_TYPE_CHOICES,
        blank=True
    )
    soil_water_holding_capacity = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('1.5'),
        null=True,
        blank=True,
        help_text="Available water (inches per foot)"
    )
    root_depth_inches = models.IntegerField(
        default=36,
        help_text="Effective root zone depth"
    )

    # Scheduling parameters
    management_allowable_depletion = models.IntegerField(
        default=50,
        help_text="MAD threshold (0-100%)"
    )

    # CIMIS data source
    cimis_target = models.CharField(
        max_length=20,
        blank=True,
        help_text="CIMIS station ID or zip code"
    )
    cimis_target_type = models.CharField(
        max_length=10,
        choices=CIMIS_TARGET_TYPE_CHOICES,
        default='station'
    )

    # Satellite Kc adjustment configuration
    use_satellite_kc_adjustment = models.BooleanField(
        default=True,
        help_text="Use satellite canopy data to adjust crop coefficients"
    )
    reference_canopy_coverage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Override expected mature canopy coverage for this zone (%). "
                  "If blank, uses crop-specific defaults based on tree age."
    )

    # NDVI stress response configuration
    ndvi_stress_modifier_enabled = models.BooleanField(
        default=True,
        help_text="Increase water for stressed vegetation based on NDVI"
    )
    ndvi_healthy_threshold = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal('0.75'),
        help_text="NDVI values above this are considered healthy (no adjustment)"
    )
    ndvi_stress_multiplier = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal('1.10'),
        help_text="Multiply Kc by this factor when vegetation is stressed"
    )

    # Status
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Irrigation Zone"
        verbose_name_plural = "Irrigation Zones"
        ordering = ['field__name', 'name']
        indexes = [
            models.Index(fields=['field']),
            models.Index(fields=['active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.field.name})"

    @property
    def soil_capacity_inches(self):
        """Calculate total soil water holding capacity in inches."""
        root_depth_feet = self.root_depth_inches / Decimal('12')
        return self.soil_water_holding_capacity * root_depth_feet

    @property
    def mad_depth_inches(self):
        """Calculate MAD threshold depth in inches."""
        return self.soil_capacity_inches * Decimal(self.management_allowable_depletion) / Decimal('100')

    def get_company(self):
        """Get the company that owns this zone (for RLS)."""
        if self.field and self.field.farm:
            return self.field.farm.company
        return None


class CropCoefficientProfile(models.Model):
    """
    Monthly crop coefficient (Kc) values for ETc calculation.
    Zone-specific profiles override default profiles.
    """

    zone = models.ForeignKey(
        IrrigationZone,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='kc_profiles'
    )
    crop_type = models.CharField(
        max_length=50,
        help_text="Crop type"
    )
    growth_stage = models.CharField(
        max_length=50,
        blank=True,
        help_text="Growth stage (e.g., mature, young)"
    )

    # Monthly Kc values
    kc_jan = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_feb = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_mar = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.70'))
    kc_apr = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.70'))
    kc_may = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.70'))
    kc_jun = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_jul = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_aug = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_sep = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_oct = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_nov = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    kc_dec = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal('0.65'))
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Crop Coefficient Profile"
        verbose_name_plural = "Crop Coefficient Profiles"

    def __str__(self):
        if self.zone:
            return f"Kc Profile for {self.zone.name}"
        return f"Default Kc Profile: {self.crop_type}"

    def get_kc_for_month(self, month: int) -> Decimal:
        """Get Kc value for a given month (1-12)."""
        month_fields = {
            1: self.kc_jan, 2: self.kc_feb, 3: self.kc_mar, 4: self.kc_apr,
            5: self.kc_may, 6: self.kc_jun, 7: self.kc_jul, 8: self.kc_aug,
            9: self.kc_sep, 10: self.kc_oct, 11: self.kc_nov, 12: self.kc_dec,
        }
        return month_fields.get(month, Decimal('0.65'))


class CIMISDataCache(models.Model):
    """
    Cache for CIMIS API responses.
    Stores daily ETo and weather data to minimize API calls.
    """

    DATA_SOURCE_CHOICES = [
        ('station', 'Station'),
        ('spatial', 'Spatial'),
    ]

    date = models.DateField(help_text="Data date")
    source_id = models.CharField(
        max_length=20,
        help_text="Station ID or zip code"
    )
    data_source = models.CharField(
        max_length=10,
        choices=DATA_SOURCE_CHOICES,
        default='station'
    )

    # Weather data
    eto = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Reference evapotranspiration (inches)"
    )
    precipitation = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Precipitation (inches)"
    )
    air_temp_avg = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True
    )
    air_temp_max = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True
    )
    air_temp_min = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True
    )

    # Quality control
    eto_qc = models.CharField(
        max_length=5,
        blank=True,
        help_text="ETo quality control flag"
    )

    # Metadata
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "CIMIS Data Cache"
        verbose_name_plural = "CIMIS Data Cache"
        ordering = ['-date']
        unique_together = [['date', 'source_id', 'data_source']]

    def __str__(self):
        return f"CIMIS {self.source_id} - {self.date}"


class IrrigationRecommendation(models.Model):
    """
    System-generated irrigation recommendations based on water balance calculations.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('applied', 'Applied'),
        ('skipped', 'Skipped'),
        ('expired', 'Expired'),
    ]

    zone = models.ForeignKey(
        IrrigationZone,
        on_delete=models.CASCADE,
        related_name='recommendations'
    )

    # Recommendation
    recommended_date = models.DateField(help_text="Recommended irrigation date")
    recommended_depth_inches = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        help_text="Recommended depth (inches)"
    )
    recommended_duration_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Recommended duration (hours)"
    )

    # Calculation inputs
    days_since_last_irrigation = models.IntegerField(
        null=True,
        blank=True
    )
    cumulative_etc = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Cumulative ETc since last irrigation"
    )
    effective_rainfall = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Effective rainfall credit"
    )
    soil_moisture_depletion_pct = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Current depletion %"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Metadata
    calculation_details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Detailed calculation breakdown"
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Irrigation Recommendation"
        verbose_name_plural = "Irrigation Recommendations"
        ordering = ['-recommended_date', '-generated_at']

    def __str__(self):
        return f"Recommendation for {self.zone.name} on {self.recommended_date}"


class SoilMoistureReading(models.Model):
    """
    Manual or sensor-based soil moisture readings.
    Used to calibrate water balance calculations.
    """

    zone = models.ForeignKey(
        IrrigationZone,
        on_delete=models.CASCADE,
        related_name='moisture_readings'
    )

    reading_datetime = models.DateTimeField(help_text="Reading date/time")
    sensor_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Sensor identifier"
    )
    sensor_depth_inches = models.IntegerField(
        default=12,
        help_text="Sensor depth"
    )

    # Moisture values (one or both may be provided)
    volumetric_water_content = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="VWC percentage"
    )
    soil_tension_cb = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Soil tension (centibars)"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Soil Moisture Reading"
        verbose_name_plural = "Soil Moisture Readings"
        ordering = ['-reading_datetime']

    def __str__(self):
        return f"{self.zone.name} - {self.reading_datetime}"


# -----------------------------------------------------------------------------
# FERTILIZER PRODUCT CHOICES
# -----------------------------------------------------------------------------

FERTILIZER_FORM_CHOICES = [
    ('granular', 'Granular'),
    ('liquid', 'Liquid'),
    ('soluble', 'Water Soluble'),
    ('organic', 'Organic'),
    ('foliar', 'Foliar'),
    ('controlled_release', 'Controlled Release'),
    ('suspension', 'Suspension'),
]

NUTRIENT_RATE_UNIT_CHOICES = [
    ('lbs_acre', 'lbs/acre'),
    ('tons_acre', 'tons/acre'),
    ('gal_acre', 'gallons/acre'),
    ('oz_acre', 'oz/acre'),
    ('lbs_1000sqft', 'lbs/1000 sq ft'),
    ('units_acre', 'units/acre'),
    ('kg_ha', 'kg/ha'),
    ('L_ha', 'L/ha'),
]

NUTRIENT_APPLICATION_METHOD_CHOICES = [
    ('broadcast', 'Broadcast'),
    ('banded', 'Banded'),
    ('foliar', 'Foliar Spray'),
    ('fertigation', 'Fertigation'),
    ('injection', 'Soil Injection'),
    ('sidedress', 'Sidedress'),
    ('topdress', 'Topdress'),
    ('incorporated', 'Pre-plant Incorporated'),
    ('drip', 'Drip/Micro-irrigation'),
    ('aerial', 'Aerial Application'),
]


class FertilizerProduct(models.Model):
    """
    Reference table for fertilizer products.
    Parallel to PesticideProduct for consistency.
    """
    
    # === IDENTIFICATION ===
    name = models.CharField(max_length=200, help_text="Product name")
    manufacturer = models.CharField(max_length=100, blank=True)
    product_code = models.CharField(max_length=50, blank=True)
    
    # === NPK ANALYSIS ===
    nitrogen_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name="Nitrogen (N) %"
    )
    phosphorus_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name="Phosphate (P2O5) %"
    )
    potassium_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name="Potash (K2O) %"
    )
    
    # === NITROGEN BREAKDOWN ===
    nitrate_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ammoniacal_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    urea_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    slow_release_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # === SECONDARY & MICRONUTRIENTS ===
    calcium_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    magnesium_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    sulfur_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    iron_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    zinc_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    manganese_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    boron_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    
    # === PRODUCT CHARACTERISTICS ===
    form = models.CharField(max_length=20, choices=FERTILIZER_FORM_CHOICES, default='granular')
    density_lbs_per_gallon = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    
    # === CERTIFICATIONS ===
    is_organic = models.BooleanField(default=False)
    omri_listed = models.BooleanField(default=False)
    cdfa_organic_registered = models.BooleanField(default=False)
    
    # === STATUS ===
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    company = models.ForeignKey('Company', on_delete=models.CASCADE, null=True, blank=True, related_name='fertilizer_products')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = "Fertilizer Product"
        verbose_name_plural = "Fertilizer Products"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['nitrogen_pct']),
            models.Index(fields=['active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.npk_display})"
    
    @property
    def npk_display(self):
        n = int(self.nitrogen_pct) if self.nitrogen_pct == int(self.nitrogen_pct) else float(self.nitrogen_pct)
        p = int(self.phosphorus_pct) if self.phosphorus_pct == int(self.phosphorus_pct) else float(self.phosphorus_pct)
        k = int(self.potassium_pct) if self.potassium_pct == int(self.potassium_pct) else float(self.potassium_pct)
        return f"{n}-{p}-{k}"
    
    @property
    def lbs_n_per_100lbs(self):
        return float(self.nitrogen_pct)
    
    @property
    def is_nitrogen_source(self):
        return self.nitrogen_pct > 0 and self.nitrogen_pct >= self.phosphorus_pct and self.nitrogen_pct >= self.potassium_pct


class NutrientApplication(models.Model):
    """
    Records a fertilizer/nutrient application to a specific field.
    Nitrogen calculations are auto-computed on save.
    """
    
    # === RELATIONSHIPS ===
    field = models.ForeignKey('Field', on_delete=models.CASCADE, related_name='nutrient_applications')
    product = models.ForeignKey('FertilizerProduct', on_delete=models.PROTECT, related_name='applications')
    water_source = models.ForeignKey('WaterSource', on_delete=models.SET_NULL, null=True, blank=True, related_name='nutrient_applications')
    
    # === APPLICATION DETAILS ===
    application_date = models.DateField()
    rate = models.DecimalField(max_digits=10, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    rate_unit = models.CharField(max_length=20, choices=NUTRIENT_RATE_UNIT_CHOICES, default='lbs_acre')
    acres_treated = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    
    # === CALCULATED VALUES (auto-populated) ===
    rate_lbs_per_acre = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_product_applied = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    lbs_nitrogen_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    total_lbs_nitrogen = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    lbs_phosphorus_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    lbs_potassium_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    
    # === METHOD ===
    application_method = models.CharField(max_length=20, choices=NUTRIENT_APPLICATION_METHOD_CHOICES, default='broadcast')
    
    # === APPLICATOR ===
    applied_by = models.CharField(max_length=100, blank=True)
    custom_applicator = models.BooleanField(default=False)
    applicator_company = models.CharField(max_length=100, blank=True)
    
    # === COST TRACKING ===
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cost_unit = models.CharField(max_length=20, blank=True)
    total_product_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    application_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # === METADATA ===
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='nutrient_applications_created')
    
    class Meta:
        ordering = ['-application_date', '-created_at']
        verbose_name = "Nutrient Application"
        verbose_name_plural = "Nutrient Applications"
        indexes = [
            models.Index(fields=['application_date']),
            models.Index(fields=['field', 'application_date']),
        ]
    
    def __str__(self):
        return f"{self.product.name} on {self.field.name} ({self.application_date})"
    
    @property
    def effective_acres(self):
        return self.acres_treated or (self.field.total_acres if self.field else Decimal('0'))
    
    @property
    def farm(self):
        return self.field.farm if self.field else None
    
    def _convert_rate_to_lbs_acre(self):
        rate = Decimal(str(self.rate))
        if self.rate_unit == 'lbs_acre':
            return rate
        elif self.rate_unit == 'tons_acre':
            return rate * Decimal('2000')
        elif self.rate_unit == 'gal_acre':
            density = self.product.density_lbs_per_gallon or Decimal('10')
            return rate * density
        elif self.rate_unit == 'oz_acre':
            return rate / Decimal('16')
        elif self.rate_unit == 'lbs_1000sqft':
            return rate * Decimal('43.56')
        elif self.rate_unit == 'kg_ha':
            return rate * Decimal('0.892179')
        elif self.rate_unit == 'L_ha':
            gal_acre = rate * Decimal('0.106907')
            density = self.product.density_lbs_per_gallon or Decimal('10')
            return gal_acre * density
        return rate
    
    def calculate_nutrients(self):
        if not self.product or not self.rate:
            return
        
        self.rate_lbs_per_acre = self._convert_rate_to_lbs_acre()
        acres = Decimal(str(self.effective_acres or 0))
        self.total_product_applied = self.rate_lbs_per_acre * acres
        
        n_pct = Decimal(str(self.product.nitrogen_pct or 0)) / Decimal('100')
        p_pct = Decimal(str(self.product.phosphorus_pct or 0)) / Decimal('100')
        k_pct = Decimal(str(self.product.potassium_pct or 0)) / Decimal('100')
        
        self.lbs_nitrogen_per_acre = self.rate_lbs_per_acre * n_pct
        self.lbs_phosphorus_per_acre = self.rate_lbs_per_acre * p_pct
        self.lbs_potassium_per_acre = self.rate_lbs_per_acre * k_pct
        self.total_lbs_nitrogen = self.lbs_nitrogen_per_acre * acres
        
        if self.total_product_cost and self.application_cost:
            self.total_cost = self.total_product_cost + self.application_cost
        elif self.total_product_cost:
            self.total_cost = self.total_product_cost
        elif self.application_cost:
            self.total_cost = self.application_cost
    
    def save(self, *args, **kwargs):
        self.calculate_nutrients()
        super().save(*args, **kwargs)


class NutrientPlan(models.Model):
    """
    Annual nitrogen management plan for a field.
    Required by some coalitions for ILRP compliance.
    """
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]
    
    field = models.ForeignKey('Field', on_delete=models.CASCADE, related_name='nutrient_plans')
    year = models.IntegerField()
    
    # Crop info
    crop = models.CharField(max_length=100)
    expected_yield = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    yield_unit = models.CharField(max_length=30, blank=True)
    
    # Nitrogen budget
    planned_nitrogen_lbs_acre = models.DecimalField(max_digits=8, decimal_places=2)
    soil_nitrogen_credit = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    irrigation_water_nitrogen = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    organic_matter_credit = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Coalition info
    coalition_name = models.CharField(max_length=100, blank=True)
    coalition_member_id = models.CharField(max_length=50, blank=True)
    
    notes = models.TextField(blank=True)
    prepared_by = models.CharField(max_length=100, blank=True)
    prepared_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['field', 'year']
        ordering = ['-year', 'field__name']
        verbose_name = "Nutrient Plan"
        verbose_name_plural = "Nutrient Plans"
    
    def __str__(self):
        return f"{self.field.name} - {self.year} N Plan"
    
    @property
    def total_n_credits(self):
        return (self.soil_nitrogen_credit or Decimal('0')) + \
               (self.irrigation_water_nitrogen or Decimal('0')) + \
               (self.organic_matter_credit or Decimal('0'))
    
    @property
    def net_planned_nitrogen(self):
        return (self.planned_nitrogen_lbs_acre or Decimal('0')) - self.total_n_credits
    
    @property
    def actual_nitrogen_applied_per_acre(self):
        from django.db.models import Sum
        result = self.field.nutrient_applications.filter(
            application_date__year=self.year
        ).aggregate(total_n=Sum('lbs_nitrogen_per_acre'))
        return result['total_n'] or Decimal('0')
    
    @property
    def actual_nitrogen_applied_total(self):
        from django.db.models import Sum
        result = self.field.nutrient_applications.filter(
            application_date__year=self.year
        ).aggregate(total_n=Sum('total_lbs_nitrogen'))
        return result['total_n'] or Decimal('0')
    
    @property
    def nitrogen_variance_per_acre(self):
        return self.actual_nitrogen_applied_per_acre - self.net_planned_nitrogen
    
    @property
    def percent_of_plan_applied(self):
        if not self.net_planned_nitrogen or self.net_planned_nitrogen == 0:
            return Decimal('0')
        return (self.actual_nitrogen_applied_per_acre / self.net_planned_nitrogen) * 100
    
    @property
    def application_count(self):
        return self.field.nutrient_applications.filter(application_date__year=self.year).count()


# Helper function for seeding
def get_common_fertilizers():
    """Returns common fertilizer products for California citrus."""
    return [
        {'name': 'UN-32 (Urea Ammonium Nitrate)', 'nitrogen_pct': 32, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'liquid', 'density_lbs_per_gallon': Decimal('11.06')},
        {'name': 'CAN-17 (Calcium Ammonium Nitrate)', 'nitrogen_pct': 17, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'liquid', 'density_lbs_per_gallon': Decimal('12.2'), 'calcium_pct': Decimal('8.8')},
        {'name': 'Urea (46-0-0)', 'nitrogen_pct': 46, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'granular'},
        {'name': 'Ammonium Sulfate (21-0-0)', 'nitrogen_pct': 21, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'granular', 'sulfur_pct': Decimal('24')},
        {'name': 'Calcium Nitrate (15.5-0-0)', 'nitrogen_pct': Decimal('15.5'), 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'granular', 'calcium_pct': Decimal('19')},
        {'name': 'Triple 15 (15-15-15)', 'nitrogen_pct': 15, 'phosphorus_pct': 15, 'potassium_pct': 15, 'form': 'granular'},
        {'name': 'Triple 16 (16-16-16)', 'nitrogen_pct': 16, 'phosphorus_pct': 16, 'potassium_pct': 16, 'form': 'granular'},
        {'name': 'Citrus & Avocado Food (10-6-4)', 'nitrogen_pct': 10, 'phosphorus_pct': 6, 'potassium_pct': 4, 'form': 'granular'},
        {'name': 'Potassium Sulfate (0-0-50)', 'nitrogen_pct': 0, 'phosphorus_pct': 0, 'potassium_pct': 50, 'form': 'granular', 'sulfur_pct': Decimal('17')},
        {'name': 'Blood Meal (12-0-0)', 'nitrogen_pct': 12, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'organic', 'is_organic': True, 'omri_listed': True},
    ]


# =============================================================================
# WEATHER CACHE MODEL
# =============================================================================

class WeatherCache(models.Model):
    """
    Cache weather data to minimize API calls to OpenWeatherMap.
    Each farm gets its own cached weather data based on GPS coordinates.
    """
    farm = models.OneToOneField(
        Farm,
        on_delete=models.CASCADE,
        related_name='weather_cache'
    )
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text="Cached latitude for weather lookup"
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text="Cached longitude for weather lookup"
    )
    weather_data = models.JSONField(
        default=dict,
        help_text="Current weather data from API"
    )
    forecast_data = models.JSONField(
        default=dict,
        null=True,
        blank=True,
        help_text="7-day forecast data from API"
    )
    fetched_at = models.DateTimeField(
        auto_now=True,
        help_text="When weather data was last fetched"
    )

    class Meta:
        verbose_name = "Weather Cache"
        verbose_name_plural = "Weather Caches"

    def __str__(self):
        return f"Weather for {self.farm.name}"

    @property
    def is_current_stale(self):
        """Check if current weather data is older than 30 minutes."""
        from datetime import timedelta
        return timezone.now() - self.fetched_at > timedelta(minutes=30)

    @property
    def is_forecast_stale(self):
        """Check if forecast data is older than 3 hours."""
        from datetime import timedelta
        return timezone.now() - self.fetched_at > timedelta(hours=3)


# =============================================================================
# QUARANTINE STATUS MODEL
# =============================================================================

class QuarantineStatus(models.Model):
    """
    Caches quarantine status results from CDFA API queries.
    Used to track whether farms/fields fall within HLB quarantine zones.

    One of farm or field must be set (not both, not neither).
    """

    QUARANTINE_TYPE_CHOICES = [
        ('HLB', 'Huanglongbing (Citrus Greening)'),
        ('ACP_BULK', 'Asian Citrus Psyllid Bulk Citrus'),
    ]

    # Link to either Farm or Field (one must be set)
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        related_name='quarantine_statuses',
        null=True,
        blank=True,
        help_text="Farm being checked for quarantine status"
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='quarantine_statuses',
        null=True,
        blank=True,
        help_text="Field being checked for quarantine status"
    )

    # Quarantine type being checked
    quarantine_type = models.CharField(
        max_length=20,
        choices=QUARANTINE_TYPE_CHOICES,
        default='HLB',
        help_text="Type of quarantine check"
    )

    # Status result
    in_quarantine = models.BooleanField(
        null=True,
        blank=True,
        help_text="True if in quarantine, False if not, null if unknown/error"
    )
    zone_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the quarantine zone if applicable"
    )

    # Tracking timestamps
    last_checked = models.DateTimeField(
        auto_now=True,
        help_text="When the status was last checked"
    )
    last_changed = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the quarantine status actually changed"
    )

    # Coordinates used for the check (cached for reference)
    check_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Latitude used for the check"
    )
    check_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Longitude used for the check"
    )

    # Raw API response for debugging
    raw_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw response from CDFA API for debugging"
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error message if the check failed"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quarantine Status"
        verbose_name_plural = "Quarantine Statuses"
        ordering = ['-last_checked']
        indexes = [
            models.Index(fields=['farm', 'quarantine_type']),
            models.Index(fields=['field', 'quarantine_type']),
            models.Index(fields=['last_checked']),
        ]
        # Ensure only one record per farm+type or field+type combination
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'quarantine_type'],
                condition=models.Q(farm__isnull=False),
                name='unique_farm_quarantine_type'
            ),
            models.UniqueConstraint(
                fields=['field', 'quarantine_type'],
                condition=models.Q(field__isnull=False),
                name='unique_field_quarantine_type'
            ),
        ]

    def __str__(self):
        target = self.farm.name if self.farm else (self.field.name if self.field else "Unknown")
        status = "In Quarantine" if self.in_quarantine else "Clear" if self.in_quarantine is False else "Unknown"
        return f"{target} - {self.get_quarantine_type_display()}: {status}"

    def clean(self):
        """Validate that exactly one of farm or field is set."""
        from django.core.exceptions import ValidationError

        if self.farm and self.field:
            raise ValidationError("Cannot set both farm and field. Choose one.")
        if not self.farm and not self.field:
            raise ValidationError("Must set either farm or field.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def target_name(self):
        """Get the name of the farm or field being checked."""
        if self.farm:
            return self.farm.name
        elif self.field:
            return self.field.name
        return "Unknown"

    @property
    def target_type(self):
        """Get whether this is a farm or field check."""
        if self.farm:
            return "farm"
        elif self.field:
            return "field"
        return "unknown"

    @property
    def is_stale(self):
        """Check if the status is older than 24 hours."""
        from datetime import timedelta
        return timezone.now() - self.last_checked > timedelta(hours=24)

    @property
    def status_display(self):
        """Human-readable status."""
        if self.error_message:
            return "Error"
        if self.in_quarantine is None:
            return "Unknown"
        return "In Quarantine" if self.in_quarantine else "Clear"

    def get_company(self):
        """Get the company that owns this status (for RLS)."""
        if self.farm:
            return self.farm.company
        elif self.field and self.field.farm:
            return self.field.farm.company
        return None


# =============================================================================
# SATELLITE IMAGERY & TREE DETECTION MODELS
# =============================================================================

class SatelliteImage(models.Model):
    """
    Uploaded satellite imagery for tree detection and canopy analysis.
    Supports multi-band GeoTIFF files (e.g., 4-band BGRN from SkyWatch).
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='satellite_images',
        help_text="Company that owns this imagery"
    )
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        related_name='satellite_images',
        help_text="Farm this imagery covers"
    )

    # File storage
    file = models.FileField(
        upload_to='imagery/%Y/%m/',
        help_text="Uploaded GeoTIFF file"
    )
    file_size_mb = models.FloatField(
        help_text="File size in megabytes"
    )

    # Image metadata
    capture_date = models.DateField(
        help_text="Date the imagery was captured"
    )
    resolution_m = models.FloatField(
        help_text="Ground sample distance in meters (e.g., 0.38 for 38cm)"
    )
    bands = models.IntegerField(
        default=3,
        help_text="Number of spectral bands (3 for RGB, 4 for BGRN)"
    )
    has_nir = models.BooleanField(
        default=False,
        help_text="Has near-infrared band for NDVI calculation"
    )
    source = models.CharField(
        max_length=50,
        help_text="Imagery provider (e.g., SkyWatch, NAIP, Planet, Maxar)"
    )
    source_product_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Provider's product/order ID for reference"
    )

    # Coverage bounds (WGS84 / EPSG:4326)
    bounds_west = models.FloatField(
        help_text="Western boundary longitude"
    )
    bounds_east = models.FloatField(
        help_text="Eastern boundary longitude"
    )
    bounds_south = models.FloatField(
        help_text="Southern boundary latitude"
    )
    bounds_north = models.FloatField(
        help_text="Northern boundary latitude"
    )

    # CRS information
    crs = models.CharField(
        max_length=50,
        default='EPSG:4326',
        help_text="Coordinate Reference System"
    )

    # Provider metadata
    metadata_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full provider metadata (cloud cover, sun angle, etc.)"
    )

    # Tracking
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_satellite_images'
    )

    class Meta:
        ordering = ['-capture_date']
        verbose_name = "Satellite Image"
        verbose_name_plural = "Satellite Images"
        indexes = [
            models.Index(fields=['company', 'farm']),
            models.Index(fields=['capture_date']),
        ]

    def __str__(self):
        return f"{self.farm.name} - {self.capture_date} ({self.source})"

    @property
    def bounds_geojson(self):
        """Return bounds as GeoJSON polygon."""
        return {
            "type": "Polygon",
            "coordinates": [[
                [self.bounds_west, self.bounds_south],
                [self.bounds_east, self.bounds_south],
                [self.bounds_east, self.bounds_north],
                [self.bounds_west, self.bounds_north],
                [self.bounds_west, self.bounds_south],
            ]]
        }

    @property
    def center_coordinates(self):
        """Return center point of coverage area."""
        return {
            'latitude': (self.bounds_north + self.bounds_south) / 2,
            'longitude': (self.bounds_east + self.bounds_west) / 2,
        }

    def covers_field(self, field):
        """Check if this image covers a given field's boundary or center point."""
        if field.boundary_geojson:
            # Check if field boundary is within image bounds
            coords = field.boundary_geojson.get('coordinates', [[]])[0]
            if coords:
                for coord in coords:
                    lng, lat = coord[0], coord[1]
                    if not (self.bounds_west <= lng <= self.bounds_east and
                            self.bounds_south <= lat <= self.bounds_north):
                        return False
                return True
        elif field.gps_latitude and field.gps_longitude:
            # Check if field center is within bounds
            lat = float(field.gps_latitude)
            lng = float(field.gps_longitude)
            return (self.bounds_west <= lng <= self.bounds_east and
                    self.bounds_south <= lat <= self.bounds_north)
        return False


class TreeDetectionRun(models.Model):
    """
    A single execution of tree detection on satellite imagery for a field.
    Tracks processing status, parameters used, and results summary.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    satellite_image = models.ForeignKey(
        SatelliteImage,
        on_delete=models.CASCADE,
        related_name='detection_runs',
        help_text="Source imagery for detection"
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='detection_runs',
        help_text="Field being analyzed"
    )

    # Processing status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error details if detection failed"
    )

    # Algorithm settings
    algorithm_version = models.CharField(
        max_length=20,
        default='1.0',
        help_text="Version of detection algorithm used"
    )
    vegetation_index = models.CharField(
        max_length=10,
        default='NDVI',
        help_text="Vegetation index used (NDVI or ExG)"
    )
    parameters = models.JSONField(
        default=dict,
        help_text="Detection parameters: min_canopy_diameter_m, max_canopy_diameter_m, min_tree_spacing_m, vegetation_threshold_percentile"
    )

    # Results summary
    tree_count = models.IntegerField(
        null=True,
        help_text="Total trees detected"
    )
    trees_per_acre = models.FloatField(
        null=True,
        help_text="Tree density (trees/acre)"
    )
    avg_canopy_diameter_m = models.FloatField(
        null=True,
        help_text="Average canopy diameter in meters"
    )
    canopy_coverage_percent = models.FloatField(
        null=True,
        help_text="Percentage of field covered by canopy"
    )
    processing_time_seconds = models.FloatField(
        null=True,
        help_text="Time taken to process in seconds"
    )

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        help_text="When processing completed"
    )

    # User verification
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_detection_runs'
    )
    review_notes = models.TextField(
        blank=True,
        help_text="Notes from user review"
    )
    is_approved = models.BooleanField(
        default=False,
        help_text="User verified results are accurate"
    )

    class Meta:
        ordering = ['-created_at']
        get_latest_by = 'created_at'
        verbose_name = "Tree Detection Run"
        verbose_name_plural = "Tree Detection Runs"
        indexes = [
            models.Index(fields=['field', 'status']),
            models.Index(fields=['satellite_image']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.field.name} - {self.created_at.strftime('%Y-%m-%d %H:%M')} ({self.status})"

    @property
    def is_latest_for_field(self):
        """Check if this is the most recent completed run for the field."""
        latest = self.field.detection_runs.filter(
            status='completed',
            is_approved=True
        ).order_by('-completed_at').first()
        return latest and latest.id == self.id


class DetectedTree(models.Model):
    """
    Individual tree detected from satellite imagery analysis.
    Stores location, metrics, and status for each tree.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead', 'Dead/Removed'),
        ('uncertain', 'Uncertain'),
        ('false_positive', 'False Positive'),
    ]

    detection_run = models.ForeignKey(
        TreeDetectionRun,
        on_delete=models.CASCADE,
        related_name='trees',
        help_text="Detection run that identified this tree"
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='detected_trees',
        help_text="Field containing this tree"
    )

    # Location (WGS84)
    latitude = models.FloatField(
        help_text="Tree center latitude"
    )
    longitude = models.FloatField(
        help_text="Tree center longitude"
    )

    # Pixel location in source image (for reference/debugging)
    pixel_x = models.IntegerField(
        help_text="X pixel coordinate in source image"
    )
    pixel_y = models.IntegerField(
        help_text="Y pixel coordinate in source image"
    )

    # Tree metrics
    canopy_diameter_m = models.FloatField(
        null=True,
        help_text="Estimated canopy diameter in meters"
    )
    ndvi_value = models.FloatField(
        null=True,
        help_text="NDVI value at tree center (0-1 scale)"
    )
    confidence_score = models.FloatField(
        help_text="Detection confidence score (0-1)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="User has manually verified this tree"
    )
    notes = models.TextField(
        blank=True,
        help_text="User notes about this tree"
    )

    class Meta:
        verbose_name = "Detected Tree"
        verbose_name_plural = "Detected Trees"
        indexes = [
            models.Index(fields=['field', 'status']),
            models.Index(fields=['detection_run']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"Tree at ({self.latitude:.6f}, {self.longitude:.6f}) - {self.status}"

    @property
    def location_geojson(self):
        """Return location as GeoJSON Point."""
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude]
        }


# =============================================================================
# LIDAR MODELS (Point Cloud Processing)
# =============================================================================

class LiDARDataset(models.Model):
    """
    Stores uploaded LiDAR point cloud data (LAZ/LAS files).
    Contains metadata extracted from the point cloud header.
    """

    SOURCE_CHOICES = [
        ('USGS_3DEP', 'USGS 3DEP'),
        ('NOAA', 'NOAA Digital Coast'),
        ('CUSTOM_DRONE', 'Custom Drone Flight'),
        ('COMMERCIAL', 'Commercial Provider'),
    ]

    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('validating', 'Validating'),
        ('ready', 'Ready'),
        ('error', 'Error'),
    ]

    # Ownership
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='lidar_datasets',
        help_text="Company that owns this dataset"
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='lidar_datasets',
        help_text="Optional farm association"
    )

    # File storage
    file = models.FileField(
        upload_to='lidar/%Y/%m/',
        help_text="LAZ or LAS point cloud file"
    )
    file_size_mb = models.FloatField(
        null=True,
        blank=True,
        help_text="File size in megabytes"
    )

    # Metadata
    name = models.CharField(
        max_length=255,
        help_text="User-friendly name for the dataset"
    )
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        help_text="Data source/provider"
    )
    capture_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date the LiDAR data was captured"
    )

    # Point cloud specifications
    point_count = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Total number of points in the dataset"
    )
    point_density_per_sqm = models.FloatField(
        null=True,
        blank=True,
        help_text="Point density (points per square meter)"
    )

    # Coordinate system
    crs = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Coordinate Reference System (e.g., EPSG:6414)"
    )

    # Bounding box (WGS84)
    bounds_west = models.FloatField(
        null=True,
        blank=True,
        help_text="Western boundary (longitude)"
    )
    bounds_east = models.FloatField(
        null=True,
        blank=True,
        help_text="Eastern boundary (longitude)"
    )
    bounds_south = models.FloatField(
        null=True,
        blank=True,
        help_text="Southern boundary (latitude)"
    )
    bounds_north = models.FloatField(
        null=True,
        blank=True,
        help_text="Northern boundary (latitude)"
    )

    # Classification info
    has_classification = models.BooleanField(
        default=False,
        help_text="Whether point cloud has LAS classification codes"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploaded'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if validation failed"
    )

    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_lidar_datasets'
    )

    # Additional metadata from header
    metadata_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata extracted from file header"
    )

    class Meta:
        db_table = 'api_lidar_dataset'
        ordering = ['-uploaded_at']
        verbose_name = "LiDAR Dataset"
        verbose_name_plural = "LiDAR Datasets"

    def __str__(self):
        return f"{self.name} ({self.source}) - {self.status}"

    @property
    def bounds_geojson(self):
        """Return bounding box as GeoJSON Polygon."""
        if all([self.bounds_west, self.bounds_east, self.bounds_south, self.bounds_north]):
            return {
                "type": "Polygon",
                "coordinates": [[
                    [self.bounds_west, self.bounds_south],
                    [self.bounds_east, self.bounds_south],
                    [self.bounds_east, self.bounds_north],
                    [self.bounds_west, self.bounds_north],
                    [self.bounds_west, self.bounds_south],
                ]]
            }
        return None

    @property
    def center_coordinates(self):
        """Return center point of bounding box."""
        if all([self.bounds_west, self.bounds_east, self.bounds_south, self.bounds_north]):
            return {
                'latitude': (self.bounds_north + self.bounds_south) / 2,
                'longitude': (self.bounds_east + self.bounds_west) / 2
            }
        return None

    def covers_field(self, field):
        """Check if this LiDAR dataset covers a given field."""
        if not field.boundary_geojson or not all([
            self.bounds_west, self.bounds_east, self.bounds_south, self.bounds_north
        ]):
            return False

        try:
            coords = field.boundary_geojson.get('coordinates', [[]])[0]
            if not coords:
                return False

            # Check if any field vertex is within bounds
            for lon, lat in coords:
                if (self.bounds_west <= lon <= self.bounds_east and
                    self.bounds_south <= lat <= self.bounds_north):
                    return True
            return False
        except (KeyError, IndexError, TypeError):
            return False


class LiDARProcessingRun(models.Model):
    """
    A processing run that generates derived products from LiDAR.
    Creates DTM, DSM, CHM rasters and performs tree/terrain analysis.
    """

    PROCESSING_TYPE_CHOICES = [
        ('TREE_DETECTION', 'Tree Detection'),
        ('TERRAIN_ANALYSIS', 'Terrain Analysis'),
        ('FULL', 'Full Analysis'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    # Source data
    lidar_dataset = models.ForeignKey(
        LiDARDataset,
        on_delete=models.CASCADE,
        related_name='processing_runs',
        help_text="Source LiDAR dataset"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='lidar_runs',
        help_text="Field being analyzed"
    )

    # Processing configuration
    processing_type = models.CharField(
        max_length=50,
        choices=PROCESSING_TYPE_CHOICES,
        default='FULL'
    )
    parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Processing parameters (resolution, thresholds, etc.)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if processing failed"
    )

    # Tree Detection Results
    tree_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="Number of trees detected"
    )
    trees_per_acre = models.FloatField(
        null=True,
        blank=True,
        help_text="Tree density (trees per acre)"
    )
    avg_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Average tree height in meters"
    )
    max_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Maximum tree height in meters"
    )
    min_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Minimum tree height in meters"
    )
    avg_canopy_diameter_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Average canopy diameter in meters"
    )
    canopy_coverage_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field covered by tree canopy"
    )

    # Terrain Results
    avg_slope_degrees = models.FloatField(
        null=True,
        blank=True,
        help_text="Average slope in degrees"
    )
    max_slope_degrees = models.FloatField(
        null=True,
        blank=True,
        help_text="Maximum slope in degrees"
    )
    elevation_range_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Elevation range (max - min) in meters"
    )

    # Generated raster files
    dtm_file = models.FileField(
        upload_to='lidar_products/%Y/%m/',
        null=True,
        blank=True,
        help_text="Digital Terrain Model (bare ground)"
    )
    dsm_file = models.FileField(
        upload_to='lidar_products/%Y/%m/',
        null=True,
        blank=True,
        help_text="Digital Surface Model (including vegetation)"
    )
    chm_file = models.FileField(
        upload_to='lidar_products/%Y/%m/',
        null=True,
        blank=True,
        help_text="Canopy Height Model (DSM - DTM)"
    )

    # Approval workflow
    is_approved = models.BooleanField(
        default=False,
        help_text="Whether results have been approved"
    )
    approved_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='approved_lidar_runs'
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True
    )
    review_notes = models.TextField(
        blank=True,
        help_text="Notes from reviewer"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True
    )
    processing_time_seconds = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total processing time in seconds"
    )

    class Meta:
        db_table = 'api_lidar_processing_run'
        ordering = ['-created_at']
        verbose_name = "LiDAR Processing Run"
        verbose_name_plural = "LiDAR Processing Runs"

    def __str__(self):
        return f"{self.field.name} - {self.processing_type} ({self.status})"

    @property
    def is_latest_for_field(self):
        """Check if this is the most recent completed run for the field."""
        latest = self.field.lidar_runs.filter(
            status='completed',
            is_approved=True
        ).order_by('-completed_at').first()
        return latest and latest.id == self.id


class LiDARDetectedTree(models.Model):
    """
    Individual tree detected from LiDAR CHM analysis.
    Stores 3D location, height, and canopy metrics.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead', 'Dead/Missing'),
        ('uncertain', 'Uncertain'),
        ('false_positive', 'False Positive'),
    ]

    # Relationships
    processing_run = models.ForeignKey(
        LiDARProcessingRun,
        on_delete=models.CASCADE,
        related_name='detected_trees',
        help_text="Processing run that detected this tree"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='lidar_detected_trees',
        help_text="Field containing this tree"
    )

    # Location (WGS84)
    latitude = models.FloatField(
        help_text="Tree crown center latitude"
    )
    longitude = models.FloatField(
        help_text="Tree crown center longitude"
    )

    # Tree metrics from LiDAR
    height_m = models.FloatField(
        help_text="Tree height in meters (from CHM)"
    )
    canopy_diameter_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Estimated canopy diameter in meters"
    )
    canopy_area_sqm = models.FloatField(
        null=True,
        blank=True,
        help_text="Estimated canopy area in square meters"
    )

    # Ground elevation at tree base
    ground_elevation_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Ground elevation at tree base (from DTM)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="User has manually verified this tree"
    )
    notes = models.TextField(
        blank=True,
        help_text="User notes about this tree"
    )

    class Meta:
        db_table = 'api_lidar_detected_tree'
        verbose_name = "LiDAR Detected Tree"
        verbose_name_plural = "LiDAR Detected Trees"
        indexes = [
            models.Index(fields=['processing_run', 'field']),
            models.Index(fields=['field', 'status']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"Tree at ({self.latitude:.6f}, {self.longitude:.6f}) - {self.height_m:.1f}m"

    @property
    def location_geojson(self):
        """Return location as GeoJSON Point."""
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude]
        }


class TerrainAnalysis(models.Model):
    """
    Terrain analysis results for frost/irrigation planning.
    Generated from LiDAR DTM data.
    """

    ASPECT_CHOICES = [
        ('N', 'North'),
        ('NE', 'Northeast'),
        ('E', 'East'),
        ('SE', 'Southeast'),
        ('S', 'South'),
        ('SW', 'Southwest'),
        ('W', 'West'),
        ('NW', 'Northwest'),
        ('FLAT', 'Flat'),
    ]

    # Relationship
    processing_run = models.OneToOneField(
        LiDARProcessingRun,
        on_delete=models.CASCADE,
        related_name='terrain_analysis',
        help_text="Processing run that generated this analysis"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='terrain_analyses',
        help_text="Field being analyzed"
    )

    # Elevation metrics
    min_elevation_m = models.FloatField(
        help_text="Minimum ground elevation in meters"
    )
    max_elevation_m = models.FloatField(
        help_text="Maximum ground elevation in meters"
    )
    mean_elevation_m = models.FloatField(
        help_text="Mean ground elevation in meters"
    )

    # Slope analysis
    mean_slope_degrees = models.FloatField(
        help_text="Mean slope in degrees"
    )
    max_slope_degrees = models.FloatField(
        help_text="Maximum slope in degrees"
    )
    slope_aspect_dominant = models.CharField(
        max_length=20,
        choices=ASPECT_CHOICES,
        help_text="Dominant slope aspect (direction facing)"
    )

    # Slope distribution (percentage of field)
    slope_0_2_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with 0-2 degree slope"
    )
    slope_2_5_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with 2-5 degree slope"
    )
    slope_5_10_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with 5-10 degree slope"
    )
    slope_over_10_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with >10 degree slope"
    )

    # Frost risk analysis (cold air pooling)
    frost_risk_zones = models.JSONField(
        default=dict,
        blank=True,
        help_text="GeoJSON of frost risk zones"
    )
    frost_risk_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Summary statistics for frost risk"
    )

    # Drainage analysis
    drainage_direction = models.CharField(
        max_length=20,
        choices=ASPECT_CHOICES,
        null=True,
        blank=True,
        help_text="Primary drainage direction"
    )
    low_spot_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="Number of low spots that may pool water"
    )

    class Meta:
        db_table = 'api_terrain_analysis'
        verbose_name = "Terrain Analysis"
        verbose_name_plural = "Terrain Analyses"

    def __str__(self):
        return f"Terrain: {self.field.name} - Avg slope {self.mean_slope_degrees:.1f}°"


# =============================================================================
# UNIFIED TREE IDENTITY MODELS
# =============================================================================

class Tree(models.Model):
    """
    Master tree identity that persists across detection runs.
    Correlates satellite and LiDAR observations of the same physical tree.
    Enables tracking tree health and changes over time.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead', 'Dead/Removed'),
        ('missing', 'Missing (Not in Recent Detections)'),
        ('uncertain', 'Uncertain'),
    ]

    CONFIDENCE_CHOICES = [
        ('high', 'High'),      # Multiple matching observations
        ('medium', 'Medium'),  # Single or few observations
        ('low', 'Low'),        # Only matched via spatial proximity
    ]

    # Primary key using UUID for external references
    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        help_text="Unique identifier for external references"
    )

    # Ownership
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='trees',
        help_text="Field containing this tree"
    )

    # Canonical location (weighted average from observations)
    latitude = models.FloatField(
        help_text="Best-estimate tree center latitude (WGS84)"
    )
    longitude = models.FloatField(
        help_text="Best-estimate tree center longitude (WGS84)"
    )

    # Best-known attributes (updated from most recent/reliable source)
    height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Best estimate tree height in meters (from LiDAR)"
    )
    canopy_diameter_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Best estimate canopy diameter in meters"
    )
    canopy_area_sqm = models.FloatField(
        null=True,
        blank=True,
        help_text="Best estimate canopy area in sq meters (from LiDAR)"
    )
    latest_ndvi = models.FloatField(
        null=True,
        blank=True,
        help_text="Most recent NDVI value (from satellite)"
    )
    ground_elevation_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Ground elevation at tree base in meters"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    identity_confidence = models.CharField(
        max_length=10,
        choices=CONFIDENCE_CHOICES,
        default='medium',
        help_text="Confidence in tree identity across observations"
    )

    # Observation counts
    satellite_observation_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of satellite detection observations"
    )
    lidar_observation_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of LiDAR detection observations"
    )

    # First and last observation dates
    first_observed = models.DateField(
        help_text="Date tree was first detected"
    )
    last_observed = models.DateField(
        help_text="Date of most recent detection"
    )

    # User verification
    is_verified = models.BooleanField(
        default=False,
        help_text="User has manually verified this tree identity"
    )
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_trees'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # User notes
    notes = models.TextField(blank=True)

    # Custom tree ID for field reference
    tree_label = models.CharField(
        max_length=50,
        blank=True,
        help_text="Optional user-assigned label (e.g., 'Row-3-Tree-15')"
    )

    # Row/position inference (populated by spatial analysis)
    inferred_row = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Inferred row number in field"
    )
    inferred_position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Inferred position within row"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_tree'
        verbose_name = "Tree"
        verbose_name_plural = "Trees"
        indexes = [
            models.Index(fields=['field', 'status'], name='api_tree_field_status_idx'),
            models.Index(fields=['latitude', 'longitude'], name='api_tree_lat_lon_idx'),
            models.Index(fields=['field', 'inferred_row', 'inferred_position'], name='api_tree_row_pos_idx'),
            models.Index(fields=['last_observed'], name='api_tree_last_obs_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'tree_label'],
                name='unique_tree_label_per_field',
                condition=models.Q(tree_label__gt='')
            )
        ]

    def __str__(self):
        label = self.tree_label or f"Tree-{self.id}"
        return f"{label} at ({self.latitude:.6f}, {self.longitude:.6f})"

    @property
    def location_geojson(self):
        """Return location as GeoJSON Point."""
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude]
        }

    @property
    def total_observation_count(self):
        """Total observations from all sources."""
        return self.satellite_observation_count + self.lidar_observation_count


class TreeObservation(models.Model):
    """
    Links a Tree identity to specific detections from satellite or LiDAR runs.
    Allows tracking the same tree across multiple observation sources and times.
    """

    SOURCE_CHOICES = [
        ('satellite', 'Satellite'),
        ('lidar', 'LiDAR'),
    ]

    MATCH_METHOD_CHOICES = [
        ('spatial', 'Spatial Proximity'),
        ('manual', 'Manual Assignment'),
        ('algorithm', 'Algorithm Match'),
    ]

    # Master tree identity
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        related_name='observations'
    )

    # Source identification
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES
    )

    # Link to original detection (one of these will be set based on source_type)
    satellite_detection = models.OneToOneField(
        'DetectedTree',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tree_observation'
    )
    lidar_detection = models.OneToOneField(
        'LiDARDetectedTree',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tree_observation'
    )

    # Matching metadata
    match_method = models.CharField(
        max_length=20,
        choices=MATCH_METHOD_CHOICES,
        default='spatial'
    )
    match_distance_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Distance to tree center when matched (meters)"
    )
    match_confidence = models.FloatField(
        null=True,
        blank=True,
        help_text="Match confidence score (0-1)"
    )

    # Observation date (denormalized for query efficiency)
    observation_date = models.DateField(
        help_text="Date of the detection run"
    )

    # Snapshot of key metrics at observation time
    observed_latitude = models.FloatField()
    observed_longitude = models.FloatField()
    observed_height_m = models.FloatField(null=True, blank=True)
    observed_canopy_diameter_m = models.FloatField(null=True, blank=True)
    observed_ndvi = models.FloatField(null=True, blank=True)
    observed_status = models.CharField(max_length=20)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_tree_observation'
        verbose_name = "Tree Observation"
        verbose_name_plural = "Tree Observations"
        indexes = [
            models.Index(fields=['tree', 'observation_date'], name='api_treeobs_tree_date_idx'),
            models.Index(fields=['source_type', 'observation_date'], name='api_treeobs_source_date_idx'),
        ]

    def __str__(self):
        return f"Observation of Tree {self.tree_id} ({self.source_type}) on {self.observation_date}"


class TreeMatchingRun(models.Model):
    """
    Records each execution of the tree matching algorithm.
    Provides audit trail and allows re-running with different parameters.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    # Context
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='tree_matching_runs'
    )
    triggered_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Source runs being matched
    satellite_run = models.ForeignKey(
        'TreeDetectionRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matching_runs'
    )
    lidar_run = models.ForeignKey(
        'LiDARProcessingRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matching_runs'
    )

    # Parameters used
    match_distance_threshold_m = models.FloatField(
        default=3.0,
        help_text="Maximum distance for tree matching (meters)"
    )
    parameters = models.JSONField(
        default=dict,
        help_text="Full matching parameters used"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(blank=True)

    # Results summary
    trees_matched = models.IntegerField(null=True, blank=True)
    new_trees_created = models.IntegerField(null=True, blank=True)
    trees_marked_missing = models.IntegerField(null=True, blank=True)
    observations_created = models.IntegerField(null=True, blank=True)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    processing_time_seconds = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_tree_matching_run'
        verbose_name = "Tree Matching Run"
        verbose_name_plural = "Tree Matching Runs"
        ordering = ['-created_at']

    def __str__(self):
        return f"Matching Run {self.id} for {self.field.name} ({self.status})"


class TreeFeedback(models.Model):
    """
    User feedback on tree detections for ML training improvement.
    Tracks flags, corrections, and verifications that can be used to
    improve detection algorithms over time.
    """

    FEEDBACK_TYPES = [
        ('false_positive', 'False Positive - Not a Tree'),
        ('false_negative', 'False Negative - Missed/Wrong Status'),
        ('misidentification', 'Misidentification - Wrong Tree Matched'),
        ('location_error', 'Location Error - Position Incorrect'),
        ('attribute_error', 'Attribute Error - Measurements Wrong'),
        ('verified_correct', 'Verified Correct'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    # Link to tree (required) or specific observation (optional)
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        related_name='feedback'
    )
    observation = models.ForeignKey(
        TreeObservation,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='feedback',
        help_text="Specific observation being flagged (optional)"
    )

    # Feedback details
    feedback_type = models.CharField(
        max_length=30,
        choices=FEEDBACK_TYPES
    )
    notes = models.TextField(
        blank=True,
        help_text="Explanation of the issue"
    )

    # For location corrections
    suggested_latitude = models.FloatField(
        null=True,
        blank=True,
        help_text="Suggested corrected latitude"
    )
    suggested_longitude = models.FloatField(
        null=True,
        blank=True,
        help_text="Suggested corrected longitude"
    )

    # For attribute corrections
    suggested_corrections = models.JSONField(
        default=dict,
        blank=True,
        help_text="Key-value pairs of suggested attribute corrections"
    )

    # Workflow
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    resolution_notes = models.TextField(
        blank=True,
        help_text="Notes from reviewer about resolution"
    )
    resolved_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_tree_feedback'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Tracking
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='tree_feedback_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ML Export tracking
    exported_for_training = models.BooleanField(
        default=False,
        help_text="Whether this feedback has been exported for ML training"
    )
    exported_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'api_tree_feedback'
        verbose_name = "Tree Feedback"
        verbose_name_plural = "Tree Feedback"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tree', 'feedback_type'], name='api_treefb_tree_type_idx'),
            models.Index(fields=['status', 'created_at'], name='api_treefb_status_date_idx'),
            models.Index(fields=['exported_for_training'], name='api_treefb_exported_idx'),
        ]

    def __str__(self):
        return f"{self.get_feedback_type_display()} for Tree {self.tree_id} ({self.status})"


# =============================================================================
# COMPLIANCE MODULE MODELS
# =============================================================================

# -----------------------------------------------------------------------------
# COMPLIANCE PROFILE - Company-level compliance settings
# -----------------------------------------------------------------------------

class ComplianceProfile(models.Model):
    """
    Defines which compliance frameworks apply to a company.
    Different growers have different requirements based on location,
    certifications, and buyer requirements.

    Auto-created when a Company is created.
    """

    US_STATES = [
        ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
        ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
        ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
        ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
        ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
        ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
        ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
        ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
        ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
        ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
        ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
        ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
        ('WI', 'Wisconsin'), ('WY', 'Wyoming'),
    ]

    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name='compliance_profile'
    )

    # Geographic/Regulatory
    primary_state = models.CharField(
        max_length=2,
        choices=US_STATES,
        default='CA',
        help_text="Primary state of operation - determines default regulations"
    )
    additional_states = models.JSONField(
        default=list,
        blank=True,
        help_text="Additional states where operations occur (list of state codes)"
    )

    # Federal & State Regulatory Programs
    requires_pur_reporting = models.BooleanField(
        default=True,
        verbose_name="California PUR Reporting",
        help_text="Pesticide Use Reports to County Ag Commissioner (CA only)"
    )
    requires_wps_compliance = models.BooleanField(
        default=True,
        verbose_name="Worker Protection Standard",
        help_text="EPA WPS training, posting, and recordkeeping"
    )
    requires_fsma_compliance = models.BooleanField(
        default=False,
        verbose_name="FSMA Produce Safety Rule",
        help_text="FDA Food Safety Modernization Act requirements"
    )
    requires_sgma_reporting = models.BooleanField(
        default=False,
        verbose_name="SGMA Groundwater Reporting",
        help_text="Sustainable Groundwater Management Act (CA)"
    )
    requires_ilrp_reporting = models.BooleanField(
        default=False,
        verbose_name="ILRP Nitrogen Reporting",
        help_text="Irrigated Lands Regulatory Program (CA)"
    )

    # Certifications
    organic_certified = models.BooleanField(
        default=False,
        help_text="USDA NOP Organic Certification"
    )
    organic_certifier = models.CharField(
        max_length=100,
        blank=True,
        help_text="Certifying agency (e.g., CCOF, Oregon Tilth)"
    )
    globalgap_certified = models.BooleanField(
        default=False,
        help_text="GlobalGAP Certification"
    )
    primus_certified = models.BooleanField(
        default=False,
        help_text="PrimusGFS Certification"
    )
    sqf_certified = models.BooleanField(
        default=False,
        help_text="Safe Quality Food Certification"
    )

    # Buyer-specific requirements (flexible JSON storage)
    buyer_requirements = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom buyer requirements: {buyer_name: {requirement_key: value}}"
    )

    # Notification preferences
    deadline_reminder_days = models.JSONField(
        default=default_deadline_reminder_days,
        help_text="Days before deadline to send reminders"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Compliance Profile"
        verbose_name_plural = "Compliance Profiles"

    def __str__(self):
        return f"Compliance Profile for {self.company.name}"

    @property
    def active_regulations(self):
        """Return list of active regulatory requirements."""
        regs = []
        if self.requires_pur_reporting:
            regs.append('CA PUR')
        if self.requires_wps_compliance:
            regs.append('EPA WPS')
        if self.requires_fsma_compliance:
            regs.append('FSMA')
        if self.requires_sgma_reporting:
            regs.append('SGMA')
        if self.requires_ilrp_reporting:
            regs.append('ILRP')
        if self.organic_certified:
            regs.append('USDA Organic')
        if self.globalgap_certified:
            regs.append('GlobalGAP')
        return regs


# -----------------------------------------------------------------------------
# COMPLIANCE DEADLINE - Tracks all compliance deadlines
# -----------------------------------------------------------------------------

class ComplianceDeadline(models.Model):
    """
    Tracks recurring and one-time compliance deadlines.
    Auto-populated based on ComplianceProfile + custom entries.
    """

    FREQUENCY_CHOICES = [
        ('once', 'One-time'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('semi_annual', 'Semi-Annual'),
        ('annual', 'Annual'),
    ]

    CATEGORY_CHOICES = [
        ('reporting', 'Regulatory Reporting'),
        ('training', 'Training/Certification'),
        ('testing', 'Testing/Sampling'),
        ('documentation', 'Documentation'),
        ('inspection', 'Inspection'),
        ('renewal', 'License/Certificate Renewal'),
        ('audit', 'Audit'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('due_soon', 'Due Soon'),
        ('overdue', 'Overdue'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped/N/A'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='compliance_deadlines'
    )

    # Deadline definition
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    regulation = models.CharField(
        max_length=100,
        blank=True,
        help_text="Regulatory framework (e.g., 'CA PUR', 'EPA WPS', 'USDA NOP')"
    )

    # Timing
    due_date = models.DateField()
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default='once'
    )
    warning_days = models.IntegerField(
        default=14,
        help_text="Days before due date to start showing warnings"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='upcoming'
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='completed_deadlines'
    )
    completion_notes = models.TextField(blank=True)

    # Automation tracking
    auto_generated = models.BooleanField(
        default=False,
        help_text="Was this deadline auto-generated from compliance profile?"
    )
    source_deadline = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recurring_instances',
        help_text="Parent deadline for recurring deadlines"
    )

    # Optional: Link to specific entities
    related_farm = models.ForeignKey(
        'Farm',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='compliance_deadlines'
    )
    related_field = models.ForeignKey(
        'Field',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='compliance_deadlines'
    )

    # Action URL for quick navigation
    action_url = models.CharField(
        max_length=200,
        blank=True,
        help_text="Frontend route to complete this task (e.g., '/reports/pur')"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'name']
        verbose_name = "Compliance Deadline"
        verbose_name_plural = "Compliance Deadlines"
        indexes = [
            models.Index(fields=['company', 'status', 'due_date'], name='idx_deadline_company_status'),
            models.Index(fields=['company', 'category'], name='idx_deadline_company_cat'),
            models.Index(fields=['due_date', 'status'], name='idx_deadline_due_status'),
        ]

    def __str__(self):
        return f"{self.name} - Due {self.due_date} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Auto-update status based on due date."""
        self._update_status()
        super().save(*args, **kwargs)

    def _update_status(self):
        """Update status based on current date and due date."""
        if self.status in ['completed', 'skipped']:
            return  # Don't change completed/skipped items

        from datetime import date
        today = date.today()
        days_until_due = (self.due_date - today).days

        if days_until_due < 0:
            self.status = 'overdue'
        elif days_until_due <= self.warning_days:
            self.status = 'due_soon'
        else:
            self.status = 'upcoming'

    def mark_complete(self, user=None, notes=''):
        """Mark this deadline as completed."""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.completed_by = user
        if notes:
            self.completion_notes = notes
        self.save()

    @property
    def is_overdue(self):
        from datetime import date
        return self.due_date < date.today() and self.status not in ['completed', 'skipped']

    @property
    def days_until_due(self):
        from datetime import date
        return (self.due_date - date.today()).days


# -----------------------------------------------------------------------------
# COMPLIANCE ALERT - System-generated alerts
# -----------------------------------------------------------------------------

class ComplianceAlert(models.Model):
    """
    System-generated alerts for compliance issues.
    Integrates with existing OperationalAlertsBanner pattern.
    """

    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    ALERT_TYPE_CHOICES = [
        ('deadline_approaching', 'Deadline Approaching'),
        ('deadline_overdue', 'Deadline Overdue'),
        ('license_expiring', 'License/Certificate Expiring'),
        ('license_expired', 'License/Certificate Expired'),
        ('training_due', 'Training Due'),
        ('training_expired', 'Training Expired'),
        ('phi_violation', 'PHI Violation Risk'),
        ('rei_violation', 'REI Violation Risk'),
        ('missing_documentation', 'Missing Documentation'),
        ('test_overdue', 'Test Overdue'),
        ('report_ready', 'Report Ready for Submission'),
        ('audit_upcoming', 'Audit Upcoming'),
        ('certification_expiring', 'Certification Expiring'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='compliance_alerts'
    )

    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Source tracking - what generated this alert
    related_deadline = models.ForeignKey(
        ComplianceDeadline,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    related_object_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Model name of related object (e.g., 'License', 'WPSTrainingRecord')"
    )
    related_object_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID of the related object"
    )

    # Status
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='acknowledged_alerts'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    # Action for resolution
    action_url = models.CharField(
        max_length=200,
        blank=True,
        help_text="Frontend route to resolve this alert"
    )
    action_label = models.CharField(
        max_length=100,
        blank=True,
        help_text="Button label for action (e.g., 'Submit Report', 'Renew License')"
    )

    # Auto-expiration
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Auto-dismiss alert after this time"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', '-created_at']
        verbose_name = "Compliance Alert"
        verbose_name_plural = "Compliance Alerts"
        indexes = [
            models.Index(fields=['company', 'is_active', 'priority'], name='idx_alert_company_active'),
            models.Index(fields=['alert_type', 'is_active'], name='idx_alert_type_active'),
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title}"

    def acknowledge(self, user):
        """Acknowledge this alert."""
        self.is_acknowledged = True
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.save()

    def dismiss(self):
        """Dismiss/deactivate this alert."""
        self.is_active = False
        self.save()

    @classmethod
    def create_deadline_alert(cls, deadline, alert_type='deadline_approaching'):
        """Factory method to create alert from a deadline."""
        priority_map = {
            'deadline_overdue': 'critical',
            'deadline_approaching': 'high' if deadline.days_until_due <= 7 else 'medium',
        }

        message_map = {
            'deadline_overdue': f"'{deadline.name}' was due on {deadline.due_date}. Please complete immediately.",
            'deadline_approaching': f"'{deadline.name}' is due in {deadline.days_until_due} days on {deadline.due_date}.",
        }

        return cls.objects.create(
            company=deadline.company,
            alert_type=alert_type,
            priority=priority_map.get(alert_type, 'medium'),
            title=f"{deadline.name} - {deadline.get_status_display()}",
            message=message_map.get(alert_type, ''),
            related_deadline=deadline,
            action_url=deadline.action_url or '/compliance/deadlines',
            action_label='View Deadline',
        )


# -----------------------------------------------------------------------------
# LICENSE - Tracks all licenses and certificates
# -----------------------------------------------------------------------------

class License(models.Model):
    """
    Tracks all types of licenses, certificates, and credentials.
    Can be company-level (e.g., PCA license) or user-level (e.g., applicator cert).
    """

    LICENSE_TYPE_CHOICES = [
        ('qal', 'Qualified Applicator License (QAL)'),
        ('qac', 'Qualified Applicator Certificate (QAC)'),
        ('pca', 'Pest Control Advisor (PCA)'),
        ('pilots_license', "Pilot's License (Aerial Application)"),
        ('structural', 'Structural Pest Control'),
        ('cdl', "Commercial Driver's License (CDL)"),
        ('organic_handler', 'Organic Handler Certificate'),
        ('food_safety', 'Food Safety Certificate'),
        ('wps_trainer', 'WPS Trainer Certification'),
        ('haccp', 'HACCP Certification'),
        ('gap_auditor', 'GAP Auditor Certification'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expiring_soon', 'Expiring Soon'),
        ('expired', 'Expired'),
        ('suspended', 'Suspended'),
        ('pending_renewal', 'Pending Renewal'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='licenses'
    )
    user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='licenses',
        help_text="Leave blank for company-level licenses"
    )

    # License details
    license_type = models.CharField(max_length=50, choices=LICENSE_TYPE_CHOICES)
    license_number = models.CharField(max_length=100)
    name_on_license = models.CharField(
        max_length=200,
        blank=True,
        help_text="Name as it appears on the license"
    )
    issuing_authority = models.CharField(
        max_length=200,
        help_text="Issuing agency (e.g., 'CA DPR', 'CDFA', 'USDA')"
    )
    issuing_state = models.CharField(
        max_length=2,
        blank=True,
        help_text="State that issued the license"
    )

    # Validity period
    issue_date = models.DateField()
    expiration_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )

    # Categories/endorsements (flexible JSON for different license types)
    categories = models.JSONField(
        default=list,
        blank=True,
        help_text="License categories (e.g., ['A', 'B', 'C'] for applicator)"
    )
    endorsements = models.JSONField(
        default=list,
        blank=True,
        help_text="Special endorsements"
    )

    # Renewal tracking
    renewal_reminder_days = models.IntegerField(
        default=90,
        help_text="Days before expiration to start reminding"
    )
    renewal_in_progress = models.BooleanField(default=False)
    renewal_submitted_date = models.DateField(null=True, blank=True)
    renewal_notes = models.TextField(blank=True)

    # Continuing education (for licenses that require it)
    ce_credits_required = models.IntegerField(
        null=True,
        blank=True,
        help_text="CE credits required per renewal period"
    )
    ce_credits_earned = models.IntegerField(
        null=True,
        blank=True,
        help_text="CE credits earned toward next renewal"
    )

    # Documentation
    document = models.FileField(
        upload_to='licenses/%Y/%m/',
        null=True,
        blank=True,
        help_text="Scanned copy of license"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['expiration_date']
        verbose_name = "License"
        verbose_name_plural = "Licenses"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_license_company_status'),
            models.Index(fields=['user', 'license_type'], name='idx_license_user_type'),
            models.Index(fields=['expiration_date', 'status'], name='idx_license_exp_status'),
        ]

    def __str__(self):
        holder = self.user.get_full_name() if self.user else self.company.name
        return f"{self.get_license_type_display()} - {holder} (Exp: {self.expiration_date})"

    def save(self, *args, **kwargs):
        """Auto-update status based on expiration date."""
        self._update_status()
        super().save(*args, **kwargs)

    def _update_status(self):
        """Update status based on expiration date."""
        if self.status in ['suspended']:
            return  # Don't auto-change suspended licenses

        from datetime import date
        today = date.today()
        days_until_exp = (self.expiration_date - today).days

        if days_until_exp < 0:
            self.status = 'expired'
        elif days_until_exp <= self.renewal_reminder_days:
            if self.renewal_in_progress:
                self.status = 'pending_renewal'
            else:
                self.status = 'expiring_soon'
        else:
            self.status = 'active'

    @property
    def is_valid(self):
        """Check if license is currently valid for use."""
        return self.status in ['active', 'expiring_soon', 'pending_renewal']

    @property
    def days_until_expiration(self):
        from datetime import date
        return (self.expiration_date - date.today()).days

    @property
    def holder_name(self):
        """Get the license holder's name."""
        if self.name_on_license:
            return self.name_on_license
        if self.user:
            return self.user.get_full_name() or self.user.email
        return self.company.name


# -----------------------------------------------------------------------------
# WPS TRAINING RECORD - Worker Protection Standard training tracking
# -----------------------------------------------------------------------------

class WPSTrainingRecord(models.Model):
    """
    Tracks WPS training for workers and handlers.
    Training valid for 12 months (pesticide safety) and 36 months (handler-specific).
    """

    TRAINING_TYPE_CHOICES = [
        ('pesticide_safety', 'Pesticide Safety Training (Workers)'),
        ('handler', 'Handler Training'),
        ('early_entry', 'Early Entry Training'),
        ('respirator', 'Respirator Fit Test'),
        ('heat_illness', 'Heat Illness Prevention'),
        ('emergency_response', 'Emergency Response'),
        ('ppe', 'Personal Protective Equipment'),
        ('first_aid', 'First Aid/CPR'),
    ]

    VALIDITY_PERIODS = {
        'pesticide_safety': 365,  # 12 months
        'handler': 365,           # 12 months
        'early_entry': 365,       # 12 months
        'respirator': 365,        # 12 months (annual fit test)
        'heat_illness': 365,      # Annual refresh recommended
        'emergency_response': 365,
        'ppe': 365,
        'first_aid': 730,         # 2 years typical
    }

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='wps_training_records'
    )

    # Trainee information
    trainee_name = models.CharField(max_length=200)
    trainee_employee_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Internal employee ID if applicable"
    )
    trainee_user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wps_training_received',
        help_text="Link to user account if trainee is a system user"
    )

    # Training details
    training_type = models.CharField(max_length=50, choices=TRAINING_TYPE_CHOICES)
    training_date = models.DateField()
    expiration_date = models.DateField()

    # Training program details
    training_program = models.CharField(
        max_length=200,
        blank=True,
        help_text="Name of training program/curriculum used"
    )
    training_language = models.CharField(
        max_length=50,
        default='English',
        help_text="Language training was conducted in"
    )

    # Trainer information
    trainer_name = models.CharField(max_length=200)
    trainer_certification = models.CharField(
        max_length=100,
        blank=True,
        help_text="Trainer's certification number"
    )
    trainer_user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wps_training_given',
        help_text="Link to trainer's user account if internal"
    )

    # Verification
    verified = models.BooleanField(
        default=False,
        help_text="Trainee comprehension verified"
    )
    verification_method = models.CharField(
        max_length=100,
        blank=True,
        help_text="How comprehension was verified (e.g., 'Quiz - 85%', 'Verbal')"
    )
    quiz_score = models.IntegerField(
        null=True,
        blank=True,
        help_text="Quiz score if applicable (percentage)"
    )

    # Documentation
    certificate_document = models.FileField(
        upload_to='wps_training/%Y/%m/',
        null=True,
        blank=True,
        help_text="Scanned training certificate"
    )

    # Location tracking (for WPS records must show where training occurred)
    training_location = models.CharField(
        max_length=200,
        blank=True,
        help_text="Where training was conducted"
    )
    farm = models.ForeignKey(
        'Farm',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wps_training_records',
        help_text="Farm where training was conducted if applicable"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-training_date']
        verbose_name = "WPS Training Record"
        verbose_name_plural = "WPS Training Records"
        indexes = [
            models.Index(fields=['company', 'training_type'], name='idx_wps_company_type'),
            models.Index(fields=['trainee_name', 'training_type'], name='idx_wps_trainee_type'),
            models.Index(fields=['expiration_date'], name='idx_wps_expiration'),
        ]

    def __str__(self):
        return f"{self.trainee_name} - {self.get_training_type_display()} ({self.training_date})"

    def save(self, *args, **kwargs):
        """Auto-calculate expiration date if not set."""
        if not self.expiration_date:
            from datetime import timedelta
            days = self.VALIDITY_PERIODS.get(self.training_type, 365)
            self.expiration_date = self.training_date + timedelta(days=days)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        """Check if training is still valid."""
        from datetime import date
        return self.expiration_date >= date.today()

    @property
    def days_until_expiration(self):
        from datetime import date
        return (self.expiration_date - date.today()).days

    @property
    def status(self):
        """Return status string based on expiration."""
        days = self.days_until_expiration
        if days < 0:
            return 'expired'
        elif days <= 90:
            return 'expiring_soon'
        return 'valid'


# -----------------------------------------------------------------------------
# CENTRAL POSTING LOCATION - WPS posting requirements
# -----------------------------------------------------------------------------

class CentralPostingLocation(models.Model):
    """
    WPS requires posting at a central location accessible to workers.
    Tracks posting locations and their compliance status.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='central_posting_locations'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='central_posting_locations'
    )

    location_name = models.CharField(
        max_length=200,
        help_text="Name of posting location (e.g., 'Main Break Room')"
    )
    location_description = models.TextField(
        blank=True,
        help_text="Detailed description of location"
    )

    # WPS requirements checklist
    has_wps_poster = models.BooleanField(
        default=False,
        verbose_name="WPS Safety Poster",
        help_text="EPA WPS safety poster displayed"
    )
    has_emergency_info = models.BooleanField(
        default=False,
        verbose_name="Emergency Information",
        help_text="Emergency medical facility location and phone number posted"
    )
    has_sds_available = models.BooleanField(
        default=False,
        verbose_name="Safety Data Sheets",
        help_text="SDSs for all pesticides used in last 30 days accessible"
    )
    has_application_info = models.BooleanField(
        default=False,
        verbose_name="Application Information",
        help_text="Recent application information posted (within 30 days)"
    )
    has_decontamination_supplies = models.BooleanField(
        default=False,
        verbose_name="Decontamination Supplies",
        help_text="Emergency eye wash and water available"
    )

    # Verification tracking
    last_verified_date = models.DateField(null=True, blank=True)
    last_verified_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='verified_posting_locations'
    )
    verification_notes = models.TextField(blank=True)

    # Photo documentation
    photo = models.ImageField(
        upload_to='posting_locations/%Y/%m/',
        null=True,
        blank=True,
        help_text="Photo of posting location for documentation"
    )

    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm__name', 'location_name']
        verbose_name = "Central Posting Location"
        verbose_name_plural = "Central Posting Locations"

    def __str__(self):
        return f"{self.location_name} at {self.farm.name}"

    @property
    def is_compliant(self):
        """Check if all WPS posting requirements are met."""
        return all([
            self.has_wps_poster,
            self.has_emergency_info,
            self.has_sds_available,
            self.has_application_info,
        ])

    @property
    def compliance_score(self):
        """Return compliance percentage."""
        checks = [
            self.has_wps_poster,
            self.has_emergency_info,
            self.has_sds_available,
            self.has_application_info,
            self.has_decontamination_supplies,
        ]
        return int(sum(checks) / len(checks) * 100)

    def verify(self, user, notes=''):
        """Mark location as verified."""
        from datetime import date
        self.last_verified_date = date.today()
        self.last_verified_by = user
        if notes:
            self.verification_notes = notes
        self.save()


# -----------------------------------------------------------------------------
# REI POSTING RECORD - Restricted Entry Interval posting
# -----------------------------------------------------------------------------

class REIPostingRecord(models.Model):
    """
    Tracks REI posting for each pesticide application.
    Auto-generated from PesticideApplication with REI requirements.
    """

    application = models.OneToOneField(
        'PesticideApplication',
        on_delete=models.CASCADE,
        related_name='rei_posting'
    )

    # REI details (cached from product at time of application)
    rei_hours = models.PositiveIntegerField(
        help_text="Restricted Entry Interval in hours"
    )
    rei_end_datetime = models.DateTimeField(
        help_text="When REI expires and field can be re-entered"
    )

    # Posting workflow
    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When warning signs were posted"
    )
    posted_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rei_postings'
    )

    # Removal workflow
    removed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When warning signs were removed"
    )
    removed_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rei_removals'
    )

    # Compliance tracking
    posting_compliant = models.BooleanField(
        default=False,
        help_text="Signs posted before/during application"
    )
    removal_compliant = models.BooleanField(
        default=False,
        help_text="Signs removed only after REI expired"
    )

    # Early entry tracking (requires special training)
    early_entry_occurred = models.BooleanField(
        default=False,
        help_text="Workers entered during REI"
    )
    early_entry_reason = models.TextField(
        blank=True,
        help_text="Reason for early entry if applicable"
    )
    early_entry_ppe = models.TextField(
        blank=True,
        help_text="PPE worn during early entry"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rei_end_datetime']
        verbose_name = "REI Posting Record"
        verbose_name_plural = "REI Posting Records"
        indexes = [
            models.Index(fields=['rei_end_datetime'], name='idx_rei_end_datetime'),
        ]

    def __str__(self):
        return f"REI for {self.application} - Ends {self.rei_end_datetime}"

    @property
    def is_active(self):
        """Check if REI is currently active."""
        return timezone.now() < self.rei_end_datetime

    @property
    def time_remaining(self):
        """Return time remaining in REI."""
        if self.is_active:
            return self.rei_end_datetime - timezone.now()
        return None

    def mark_posted(self, user):
        """Mark signs as posted."""
        self.posted_at = timezone.now()
        self.posted_by = user
        # Check if posted before/at time of application
        if self.application.start_time:
            from datetime import datetime, date
            app_datetime = datetime.combine(
                self.application.application_date,
                self.application.start_time
            )
            app_datetime = timezone.make_aware(app_datetime)
            self.posting_compliant = self.posted_at <= app_datetime
        self.save()

    def mark_removed(self, user):
        """Mark signs as removed."""
        self.removed_at = timezone.now()
        self.removed_by = user
        # Check if removed after REI expired
        self.removal_compliant = self.removed_at >= self.rei_end_datetime
        self.save()


# -----------------------------------------------------------------------------
# COMPLIANCE REPORT - Tracks generated compliance reports
# -----------------------------------------------------------------------------

class ComplianceReport(models.Model):
    """
    Tracks generated compliance reports and their submission status.
    Supports auto-generation and validation before submission.
    """

    REPORT_TYPE_CHOICES = [
        ('pur_monthly', 'PUR Monthly Report'),
        ('pur_annual', 'PUR Annual Summary'),
        ('sgma_semi_annual', 'SGMA Semi-Annual Report'),
        ('ilrp_annual', 'ILRP Annual Report'),
        ('wps_annual', 'WPS Training Summary'),
        ('organic_annual', 'Organic Certification Report'),
        ('globalgap_audit', 'GlobalGAP Audit Package'),
        ('custom', 'Custom Report'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('ready', 'Ready for Submission'),
        ('submitted', 'Submitted'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected - Needs Correction'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='compliance_reports'
    )

    # Report identification
    report_type = models.CharField(max_length=50, choices=REPORT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    reporting_period_start = models.DateField()
    reporting_period_end = models.DateField()

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Generated data
    report_data = models.JSONField(
        default=dict,
        help_text="Pre-computed report data in JSON format"
    )
    record_count = models.IntegerField(
        default=0,
        help_text="Number of records included in report"
    )

    # Generated files
    report_file = models.FileField(
        upload_to='compliance_reports/%Y/%m/',
        null=True,
        blank=True,
        help_text="Generated report file (PDF/Excel/CSV)"
    )

    # Validation
    validation_run_at = models.DateTimeField(null=True, blank=True)
    validation_errors = models.JSONField(
        default=list,
        help_text="List of validation errors"
    )
    validation_warnings = models.JSONField(
        default=list,
        help_text="List of validation warnings"
    )
    is_valid = models.BooleanField(
        default=False,
        help_text="Passed validation with no errors"
    )

    # Submission tracking
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submitted_reports'
    )
    submission_method = models.CharField(
        max_length=50,
        blank=True,
        help_text="How submitted (e.g., 'CalAgPermits', 'Email', 'Mail')"
    )
    submission_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Confirmation number or reference"
    )

    # Response tracking
    response_received_at = models.DateTimeField(null=True, blank=True)
    response_notes = models.TextField(blank=True)

    # Related deadline (if applicable)
    related_deadline = models.ForeignKey(
        ComplianceDeadline,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reports'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_reports'
    )

    class Meta:
        ordering = ['-reporting_period_end', '-created_at']
        verbose_name = "Compliance Report"
        verbose_name_plural = "Compliance Reports"
        indexes = [
            models.Index(fields=['company', 'report_type', 'status'], name='idx_report_company_type'),
            models.Index(fields=['reporting_period_end'], name='idx_report_period_end'),
        ]

    def __str__(self):
        return f"{self.title} ({self.reporting_period_start} to {self.reporting_period_end})"

    @property
    def can_submit(self):
        """Check if report is ready for submission."""
        return self.is_valid and self.status in ['ready', 'pending_review']

    @property
    def period_display(self):
        """Return formatted period string."""
        return f"{self.reporting_period_start.strftime('%b %d, %Y')} - {self.reporting_period_end.strftime('%b %d, %Y')}"


# -----------------------------------------------------------------------------
# INCIDENT REPORT - Safety incidents and near-misses
# -----------------------------------------------------------------------------

class IncidentReport(models.Model):
    """
    Tracks safety incidents, spills, exposures, and near-misses.
    Required for WPS compliance and internal safety programs.
    """

    INCIDENT_TYPE_CHOICES = [
        ('exposure', 'Pesticide Exposure'),
        ('spill', 'Chemical Spill'),
        ('equipment', 'Equipment Failure'),
        ('injury', 'Injury'),
        ('near_miss', 'Near Miss'),
        ('environmental', 'Environmental Release'),
        ('property', 'Property Damage'),
        ('drift', 'Pesticide Drift'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('moderate', 'Moderate'),
        ('serious', 'Serious'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('reported', 'Reported'),
        ('investigating', 'Under Investigation'),
        ('corrective_action', 'Corrective Action in Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='incident_reports'
    )

    # Incident details
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    incident_date = models.DateTimeField()
    reported_date = models.DateTimeField(auto_now_add=True)

    # Location
    farm = models.ForeignKey(
        'Farm',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incident_reports'
    )
    field = models.ForeignKey(
        'Field',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incident_reports'
    )
    location_description = models.CharField(
        max_length=200,
        blank=True,
        help_text="Specific location description"
    )

    # People involved
    reported_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='incidents_reported'
    )
    affected_persons = models.JSONField(
        default=list,
        help_text="List of affected persons: [{name, role, injuries}]"
    )
    witnesses = models.JSONField(
        default=list,
        help_text="List of witnesses: [{name, contact}]"
    )

    # Description
    title = models.CharField(max_length=200)
    description = models.TextField()
    immediate_actions = models.TextField(
        blank=True,
        help_text="Actions taken immediately after incident"
    )

    # Related application (for exposure/spill)
    related_application = models.ForeignKey(
        'PesticideApplication',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incident_reports'
    )
    products_involved = models.JSONField(
        default=list,
        help_text="List of products involved: [{name, epa_reg, amount}]"
    )

    # Investigation
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='reported'
    )
    investigator = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incidents_investigating'
    )
    root_cause = models.TextField(blank=True)
    contributing_factors = models.JSONField(
        default=list,
        help_text="List of contributing factors"
    )

    # Corrective actions
    corrective_actions = models.TextField(blank=True)
    preventive_measures = models.TextField(blank=True)

    # Regulatory reporting
    reported_to_authorities = models.BooleanField(default=False)
    authority_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Agency reported to"
    )
    authority_report_date = models.DateField(null=True, blank=True)
    authority_report_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Report/case number"
    )

    # Resolution
    resolved_date = models.DateField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incidents_resolved'
    )
    resolution_summary = models.TextField(blank=True)

    # Documentation
    documents = models.JSONField(
        default=list,
        help_text="List of attached document paths"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-incident_date']
        verbose_name = "Incident Report"
        verbose_name_plural = "Incident Reports"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_incident_company_status'),
            models.Index(fields=['incident_type', 'severity'], name='idx_incident_type_severity'),
            models.Index(fields=['incident_date'], name='idx_incident_date'),
        ]

    def __str__(self):
        return f"{self.title} - {self.get_severity_display()} ({self.incident_date.date()})"

    @property
    def days_since_incident(self):
        """Days since incident occurred."""
        from datetime import datetime
        delta = timezone.now() - self.incident_date
        return delta.days

    @property
    def requires_authority_report(self):
        """Check if this type/severity requires reporting to authorities."""
        # Serious/critical exposures and spills typically require reporting
        if self.severity in ['serious', 'critical']:
            if self.incident_type in ['exposure', 'spill', 'environmental', 'drift']:
                return True
        return False


# -----------------------------------------------------------------------------
# NOTIFICATION PREFERENCE - User notification settings
# -----------------------------------------------------------------------------

class NotificationPreference(models.Model):
    """
    User-specific notification preferences for compliance alerts.
    """

    DIGEST_FREQUENCY_CHOICES = [
        ('instant', 'Instant (As they occur)'),
        ('daily', 'Daily Digest'),
        ('weekly', 'Weekly Digest'),
        ('none', 'No Email (In-app only)'),
    ]

    user = models.OneToOneField(
        'User',
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )

    # Email settings
    email_enabled = models.BooleanField(
        default=True,
        help_text="Receive email notifications"
    )
    email_digest_frequency = models.CharField(
        max_length=20,
        choices=DIGEST_FREQUENCY_CHOICES,
        default='instant'
    )

    # Category preferences
    notify_deadlines = models.BooleanField(
        default=True,
        help_text="Compliance deadline reminders"
    )
    notify_licenses = models.BooleanField(
        default=True,
        help_text="License expiration warnings"
    )
    notify_training = models.BooleanField(
        default=True,
        help_text="Training renewal reminders"
    )
    notify_reports = models.BooleanField(
        default=True,
        help_text="Report generation and submission notifications"
    )
    notify_incidents = models.BooleanField(
        default=True,
        help_text="Incident report notifications"
    )
    notify_rei = models.BooleanField(
        default=True,
        help_text="REI posting and expiration reminders"
    )

    # Reminder timing
    deadline_reminder_days = models.JSONField(
        default=default_deadline_reminder_days,
        help_text="Days before deadline to send reminders"
    )
    license_reminder_days = models.JSONField(
        default=default_license_reminder_days,
        help_text="Days before license expiration to send reminders"
    )

    # Quiet hours (don't send notifications during these times)
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(
        null=True,
        blank=True,
        help_text="Start of quiet hours (e.g., 21:00)"
    )
    quiet_hours_end = models.TimeField(
        null=True,
        blank=True,
        help_text="End of quiet hours (e.g., 07:00)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Notification Preference"
        verbose_name_plural = "Notification Preferences"

    def __str__(self):
        return f"Notification Preferences for {self.user.email}"

    def should_notify(self, category):
        """Check if user wants notifications for a category."""
        category_map = {
            'deadline': self.notify_deadlines,
            'license': self.notify_licenses,
            'training': self.notify_training,
            'report': self.notify_reports,
            'incident': self.notify_incidents,
            'rei': self.notify_rei,
        }
        return category_map.get(category, True)


# -----------------------------------------------------------------------------
# NOTIFICATION LOG - Tracks sent notifications
# -----------------------------------------------------------------------------

class NotificationLog(models.Model):
    """
    Tracks all sent notifications for auditing and debugging.
    """

    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('in_app', 'In-App'),
        ('sms', 'SMS'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )
    user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )

    # Notification details
    notification_type = models.CharField(
        max_length=50,
        help_text="Type of notification (e.g., 'deadline_reminder', 'license_expiring')"
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)

    subject = models.CharField(max_length=200)
    message = models.TextField()

    # Delivery status
    sent_at = models.DateTimeField(auto_now_add=True)
    delivered = models.BooleanField(default=False)
    delivery_error = models.TextField(blank=True)

    # Read tracking (for in-app)
    read_at = models.DateTimeField(null=True, blank=True)

    # Related object
    related_object_type = models.CharField(max_length=50, blank=True)
    related_object_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-sent_at']
        verbose_name = "Notification Log"
        verbose_name_plural = "Notification Logs"
        indexes = [
            models.Index(fields=['user', 'sent_at'], name='idx_notif_user_sent'),
            models.Index(fields=['notification_type', 'sent_at'], name='idx_notif_type_sent'),
        ]

    def __str__(self):
        return f"{self.notification_type} to {self.user.email if self.user else 'N/A'} at {self.sent_at}"

    def mark_read(self):
        """Mark notification as read."""
        if not self.read_at:
            self.read_at = timezone.now()
            self.save()


# =============================================================================
# DISEASE PREVENTION PLATFORM MODELS
# =============================================================================

class ExternalDetection(models.Model):
    """
    Stores official disease detections from CDFA, USDA, or other authorities.
    Used for proximity alerting to warn growers of nearby threats.
    """

    SOURCE_CHOICES = [
        ('cdfa', 'California Dept of Food & Agriculture'),
        ('usda', 'USDA APHIS'),
        ('county_ag', 'County Agricultural Commissioner'),
        ('uc_anr', 'UC Agriculture & Natural Resources'),
        ('manual', 'Manual Entry'),
    ]

    DISEASE_TYPE_CHOICES = [
        ('hlb', 'Huanglongbing (Citrus Greening)'),
        ('acp', 'Asian Citrus Psyllid'),
        ('ctvd', 'Citrus Tristeza Virus'),
        ('cyvcv', 'Citrus Yellow Vein Clearing Virus'),
        ('canker', 'Citrus Canker'),
        ('phytophthora', 'Phytophthora Root Rot'),
        ('laurel_wilt', 'Laurel Wilt'),
        ('other', 'Other'),
    ]

    LOCATION_TYPE_CHOICES = [
        ('residential', 'Residential/Backyard'),
        ('commercial', 'Commercial Grove'),
        ('nursery', 'Nursery'),
        ('unknown', 'Unknown'),
    ]

    # Source tracking
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    source_id = models.CharField(max_length=100, blank=True)

    # Disease info
    disease_type = models.CharField(max_length=50, choices=DISEASE_TYPE_CHOICES)
    disease_name = models.CharField(max_length=200)

    # Location
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    county = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True)
    location_type = models.CharField(
        max_length=50,
        choices=LOCATION_TYPE_CHOICES,
        default='unknown'
    )

    # Dates
    detection_date = models.DateField()
    reported_date = models.DateField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    # Status
    is_active = models.BooleanField(default=True)
    eradication_date = models.DateField(null=True, blank=True)

    # Metadata
    notes = models.TextField(blank=True)
    raw_data = models.JSONField(default=dict)

    class Meta:
        ordering = ['-detection_date']
        verbose_name = "External Detection"
        verbose_name_plural = "External Detections"
        indexes = [
            models.Index(fields=['disease_type', 'is_active'], name='idx_extdet_disease_active'),
            models.Index(fields=['latitude', 'longitude'], name='idx_extdet_coords'),
            models.Index(fields=['county'], name='idx_extdet_county'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'source_id'],
                name='unique_external_detection_source',
                condition=models.Q(source_id__gt=''),
            ),
        ]

    def __str__(self):
        return f"{self.disease_name} - {self.county} ({self.detection_date})"


class QuarantineZone(models.Model):
    """
    CDFA quarantine boundary polygons.

    Stores geographic boundaries of quarantine zones for HLB, ACP, and other
    diseases/pests. Used for visualization on threat maps and compliance checking.
    """

    ZONE_TYPE_CHOICES = [
        ('hlb', 'HLB Quarantine'),
        ('acp', 'ACP Quarantine'),
        ('eradication', 'Eradication Area'),
        ('buffer', 'Buffer Zone'),
        ('other', 'Other'),
    ]

    zone_type = models.CharField(max_length=50, choices=ZONE_TYPE_CHOICES)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # GeoJSON Polygon boundary
    boundary = models.JSONField(
        help_text="GeoJSON Polygon geometry for the quarantine boundary"
    )

    # Source tracking
    source = models.CharField(max_length=100, default='cdfa')
    source_url = models.URLField(blank=True)
    source_id = models.CharField(max_length=100, blank=True)

    # Dates
    established_date = models.DateField()
    last_updated = models.DateField(auto_now=True)
    expires_date = models.DateField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)

    # Geographic info
    county = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=50, default='California')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-established_date']
        verbose_name = "Quarantine Zone"
        verbose_name_plural = "Quarantine Zones"
        indexes = [
            models.Index(fields=['zone_type', 'is_active'], name='idx_qzone_type_active'),
            models.Index(fields=['county'], name='idx_qzone_county'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'source_id'],
                name='unique_quarantine_zone_source',
                condition=models.Q(source_id__gt=''),
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.zone_type.upper()})"


class DiseaseAlertRule(models.Model):
    """
    Configurable rules for generating disease alerts.
    Allows per-company customization of alert thresholds.
    """

    RULE_TYPE_CHOICES = [
        ('proximity', 'Proximity Alert'),
        ('ndvi_threshold', 'NDVI Threshold'),
        ('ndvi_change', 'NDVI Change Rate'),
        ('canopy_loss', 'Canopy Loss'),
        ('tree_count_change', 'Tree Count Change'),
        ('regional_trend', 'Regional Trend'),
    ]

    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='disease_alert_rules'
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    rule_type = models.CharField(max_length=50, choices=RULE_TYPE_CHOICES)
    conditions = models.JSONField(default=dict)
    alert_priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)

    send_email = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)
    send_immediately = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_disease_rules'
    )

    class Meta:
        ordering = ['name']
        verbose_name = "Disease Alert Rule"
        verbose_name_plural = "Disease Alert Rules"

    def __str__(self):
        return f"{self.name} ({self.get_rule_type_display()})"


class DiseaseAnalysisRun(models.Model):
    """
    Tracks a disease/health analysis run for a field.
    Parallel to TreeDetectionRun but focused on health trends.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    ANALYSIS_TYPE_CHOICES = [
        ('ndvi_trend', 'NDVI Trend Analysis'),
        ('anomaly_detection', 'Anomaly Detection'),
        ('full', 'Full Health Analysis'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='disease_analyses'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='disease_analyses'
    )

    satellite_image = models.ForeignKey(
        'SatelliteImage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='disease_analyses'
    )
    tree_detection_run = models.ForeignKey(
        'TreeDetectionRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='disease_analyses'
    )

    # Processing status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)

    # Analysis parameters
    analysis_type = models.CharField(
        max_length=50,
        choices=ANALYSIS_TYPE_CHOICES,
        default='full'
    )
    parameters = models.JSONField(default=dict)

    # Results - Field Level
    avg_ndvi = models.DecimalField(max_digits=4, decimal_places=3, null=True)
    ndvi_change_30d = models.DecimalField(max_digits=5, decimal_places=3, null=True)
    ndvi_change_90d = models.DecimalField(max_digits=5, decimal_places=3, null=True)
    canopy_coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    canopy_change_30d = models.DecimalField(max_digits=5, decimal_places=2, null=True)

    # Results - Tree Level Aggregates
    total_trees_analyzed = models.IntegerField(default=0)
    trees_healthy = models.IntegerField(default=0)
    trees_mild_stress = models.IntegerField(default=0)
    trees_moderate_stress = models.IntegerField(default=0)
    trees_severe_stress = models.IntegerField(default=0)
    trees_declining = models.IntegerField(default=0)

    # Risk Assessment
    health_score = models.IntegerField(null=True)
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        null=True,
        blank=True
    )
    risk_factors = models.JSONField(default=list)

    # Anomaly Detection
    anomaly_zones = models.JSONField(default=list)
    anomaly_count = models.IntegerField(default=0)

    # Recommendations
    recommendations = models.JSONField(default=list)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)

    # Review
    reviewed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_disease_analyses'
    )
    review_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Disease Analysis Run"
        verbose_name_plural = "Disease Analysis Runs"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_disanalysis_co_status'),
            models.Index(fields=['field', '-created_at'], name='idx_disanalysis_field_date'),
        ]

    def __str__(self):
        return f"{self.field.name} - {self.created_at.strftime('%Y-%m-%d')} ({self.status})"


class DiseaseAlert(models.Model):
    """
    Disease-specific alerts for users.
    Follows ComplianceAlert pattern but with disease-specific fields.
    """

    ALERT_TYPE_CHOICES = [
        ('proximity_hlb', 'HLB Detected Nearby'),
        ('proximity_acp', 'ACP Activity Nearby'),
        ('proximity_other', 'Other Disease Nearby'),
        ('ndvi_anomaly', 'NDVI Anomaly Detected'),
        ('tree_decline', 'Tree Decline Detected'),
        ('canopy_loss', 'Canopy Loss Detected'),
        ('regional_trend', 'Regional Health Trend'),
        ('scouting_verified', 'Verified Scouting Report'),
    ]

    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='disease_alerts'
    )
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='disease_alerts'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='disease_alerts'
    )

    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Context
    distance_miles = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    related_detection = models.ForeignKey(
        ExternalDetection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alerts'
    )
    related_analysis = models.ForeignKey(
        DiseaseAnalysisRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alerts'
    )

    # Actions
    recommended_actions = models.JSONField(default=list)
    action_url = models.CharField(max_length=500, blank=True)
    action_label = models.CharField(max_length=100, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_disease_alerts'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    # Notifications sent
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    sms_sent = models.BooleanField(default=False)
    sms_sent_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Disease Alert"
        verbose_name_plural = "Disease Alerts"
        indexes = [
            models.Index(fields=['company', 'is_active', 'priority'], name='idx_disalert_co_active_pri'),
            models.Index(fields=['alert_type', 'created_at'], name='idx_disalert_type_created'),
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title}"

    def acknowledge(self, user):
        """Acknowledge this alert."""
        self.is_acknowledged = True
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.save()

    def dismiss(self):
        """Dismiss/deactivate this alert."""
        self.is_active = False
        self.save()


class ScoutingReport(models.Model):
    """
    User-submitted disease/pest observations for crowdsourced monitoring.
    """

    REPORT_TYPE_CHOICES = [
        ('disease_symptom', 'Disease Symptom'),
        ('pest_sighting', 'Pest Sighting'),
        ('tree_decline', 'Tree Decline'),
        ('tree_death', 'Tree Death'),
        ('acp_sighting', 'Asian Citrus Psyllid'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('low', 'Low - Minor/Isolated'),
        ('medium', 'Medium - Several Trees'),
        ('high', 'High - Significant Area'),
    ]

    AI_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped'),
    ]

    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('verified', 'Verified'),
        ('false_alarm', 'False Alarm'),
        ('inconclusive', 'Inconclusive'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='scouting_reports'
    )
    reported_by = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='scouting_reports'
    )
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='scouting_reports'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='scouting_reports'
    )

    # Location
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)

    # Report details
    report_type = models.CharField(max_length=50, choices=REPORT_TYPE_CHOICES)
    symptoms = models.JSONField(default=dict)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    affected_tree_count = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # AI Analysis
    ai_analysis_status = models.CharField(
        max_length=20,
        choices=AI_STATUS_CHOICES,
        default='pending'
    )
    ai_diagnosis = models.JSONField(default=dict)

    # Verification
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_scouting_reports'
    )
    verification_notes = models.TextField(blank=True)

    # Sharing
    share_anonymously = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False)

    # Timestamps
    observed_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Scouting Report"
        verbose_name_plural = "Scouting Reports"

    def __str__(self):
        return f"{self.get_report_type_display()} - {self.observed_date}"


class ScoutingPhoto(models.Model):
    """Photos attached to scouting reports."""

    report = models.ForeignKey(
        ScoutingReport,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    image = models.ImageField(upload_to='scouting/%Y/%m/')
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Scouting Photo"
        verbose_name_plural = "Scouting Photos"

    def __str__(self):
        return f"Photo for {self.report}"


class TreeHealthRecord(models.Model):
    """
    Tracks health metrics for individual trees over time.
    Links DetectedTree records across multiple detection runs.
    """

    TREND_CHOICES = [
        ('improving', 'Improving'),
        ('stable', 'Stable'),
        ('declining', 'Declining'),
        ('rapid_decline', 'Rapid Decline'),
    ]

    HEALTH_STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('mild_stress', 'Mild Stress'),
        ('moderate_stress', 'Moderate Stress'),
        ('severe_stress', 'Severe Stress'),
        ('dead', 'Dead/Removed'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='tree_health_records'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='tree_health_records'
    )

    # Tree identification
    tree_id = models.CharField(max_length=50)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)

    # Current state
    current_ndvi = models.DecimalField(max_digits=4, decimal_places=3, null=True)
    current_canopy_diameter_m = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    last_detection_run = models.ForeignKey(
        'TreeDetectionRun',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    last_updated = models.DateTimeField(auto_now=True)

    # Trend data
    ndvi_history = models.JSONField(default=list)
    canopy_history = models.JSONField(default=list)
    ndvi_trend = models.CharField(max_length=20, choices=TREND_CHOICES, default='stable')

    # Health status
    health_status = models.CharField(
        max_length=20,
        choices=HEALTH_STATUS_CHOICES,
        default='healthy'
    )

    # Flags
    flagged_for_inspection = models.BooleanField(default=False)
    flag_reason = models.TextField(blank=True)
    inspected = models.BooleanField(default=False)
    inspection_date = models.DateField(null=True, blank=True)
    inspection_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Tree Health Record"
        verbose_name_plural = "Tree Health Records"
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'tree_id'],
                name='unique_tree_health_field_treeid'
            ),
        ]
        indexes = [
            models.Index(fields=['field', 'health_status'], name='idx_treehealth_field_status'),
            models.Index(fields=['flagged_for_inspection'], name='idx_treehealth_flagged'),
        ]

    def __str__(self):
        return f"Tree {self.tree_id} - {self.field.name}"


# =============================================================================
# PACKINGHOUSE POOL TRACKING SYSTEM
# =============================================================================
# For California citrus cooperative packinghouses with pool marketing arrangements.
# Tracks deliveries, packout reports, settlements, and grower ledger entries.
# =============================================================================

class Packinghouse(models.Model):
    """
    Reference entity for packing cooperatives.
    Examples: "Saticoy Lemon Association", "Villa Park Orchards"
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='packinghouses',
        help_text='Company that owns this packinghouse record'
    )

    name = models.CharField(
        max_length=200,
        help_text='Full packinghouse name (e.g., "Saticoy Lemon Association")'
    )
    short_code = models.CharField(
        max_length=20,
        blank=True,
        help_text='Abbreviation (e.g., "SLA", "VPOA")'
    )

    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)

    # Contact Information
    contact_name = models.CharField(max_length=100, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)

    # Grower Identification
    grower_id = models.CharField(
        max_length=50,
        blank=True,
        help_text='Your grower ID with this packinghouse (e.g., "THACR641")'
    )

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Packinghouse"
        verbose_name_plural = "Packinghouses"
        indexes = [
            models.Index(fields=['company', 'is_active'], name='idx_pkghs_co_active'),
        ]

    def __str__(self):
        if self.short_code:
            return f"{self.name} ({self.short_code})"
        return self.name


class Pool(models.Model):
    """
    Marketing pool within a packinghouse.
    Pools group deliveries by commodity/variety/season for pricing.
    """

    POOL_TYPE_CHOICES = [
        ('fresh', 'Fresh Market'),
        ('juice', 'Juice/Processing'),
        ('mixed', 'Mixed'),
    ]

    POOL_STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
        ('settled', 'Settled'),
    ]

    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='pools'
    )

    pool_id = models.CharField(
        max_length=50,
        help_text='Packinghouse pool identifier (e.g., "2520000 D2 POOL")'
    )
    name = models.CharField(
        max_length=200,
        help_text='Friendly name for the pool'
    )

    # Commodity/variety classification
    commodity = models.CharField(
        max_length=50,
        help_text='e.g., "LEMONS", "NAVELS", "TANGERINES"'
    )
    variety = models.CharField(
        max_length=50,
        blank=True,
        help_text='e.g., "CARA NAVELS", "PIXIES"'
    )

    # Season tracking (legacy string field kept for backward compatibility)
    season = models.CharField(
        max_length=20,
        help_text='Legacy season string (e.g., "2024-2025")'
    )

    # Structured season fields (new)
    season_template = models.ForeignKey(
        'SeasonTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pools',
        help_text="Season template used for this pool"
    )
    season_start = models.DateField(
        null=True,
        blank=True,
        help_text="Actual season start date"
    )
    season_end = models.DateField(
        null=True,
        blank=True,
        help_text="Actual season end date"
    )

    pool_type = models.CharField(
        max_length=20,
        choices=POOL_TYPE_CHOICES,
        default='fresh'
    )
    status = models.CharField(
        max_length=20,
        choices=POOL_STATUS_CHOICES,
        default='active'
    )

    # Date range
    open_date = models.DateField(null=True, blank=True)
    close_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-season', 'commodity', 'name']
        verbose_name = "Pool"
        verbose_name_plural = "Pools"
        constraints = [
            models.UniqueConstraint(
                fields=['packinghouse', 'pool_id'],
                name='unique_pool_packinghouse_poolid'
            ),
        ]
        indexes = [
            models.Index(fields=['packinghouse', 'status'], name='idx_pool_pkghs_status'),
            models.Index(fields=['season', 'commodity'], name='idx_pool_season_comm'),
        ]

    def __str__(self):
        return f"{self.name} ({self.season})"

    @property
    def total_bins(self):
        """
        Total bins for this pool.
        Uses packout reports as primary source (bins_this_period),
        falls back to deliveries if no packout reports exist.
        """
        from django.db.models import Sum
        # First try packout reports - this is the source of truth from packinghouse
        packout_bins = self.packout_reports.aggregate(total=Sum('bins_this_period'))['total']
        if packout_bins:
            return packout_bins
        # Fall back to delivery records if no packout reports
        return self.deliveries.aggregate(total=Sum('bins'))['total'] or 0

    @property
    def delivery_count(self):
        """Number of deliveries to this pool."""
        return self.deliveries.count()


class PackinghouseDelivery(models.Model):
    """
    Individual delivery/receiving ticket to a packinghouse pool.
    Links to field for traceability and optional Harvest record.
    """

    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        related_name='deliveries'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='packinghouse_deliveries'
    )

    ticket_number = models.CharField(
        max_length=50,
        help_text='Receiving ticket number (e.g., "182622")'
    )
    delivery_date = models.DateField()

    # Quantity
    bins = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Number of bins delivered'
    )
    field_boxes = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Field box count if different from bins'
    )
    weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Total weight in pounds'
    )

    # Optional link to harvest record for traceability
    harvest = models.ForeignKey(
        'Harvest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packinghouse_deliveries'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-delivery_date', '-created_at']
        verbose_name = "Packinghouse Delivery"
        verbose_name_plural = "Packinghouse Deliveries"
        constraints = [
            models.UniqueConstraint(
                fields=['pool', 'ticket_number'],
                name='unique_delivery_pool_ticket'
            ),
        ]
        indexes = [
            models.Index(fields=['pool', 'delivery_date'], name='idx_pkgdel_pool_date'),
            models.Index(fields=['field', 'delivery_date'], name='idx_pkgdel_field_date'),
        ]

    def __str__(self):
        return f"Ticket {self.ticket_number} - {self.bins} bins ({self.delivery_date})"


class PackoutReport(models.Model):
    """
    Periodic packout/wash report showing grade breakdown.
    Typically received weekly from the packinghouse.
    """

    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        related_name='packout_reports'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='packout_reports',
        null=True,
        blank=True,
        help_text='Field this packout is from (optional - packouts may aggregate multiple fields)'
    )

    report_date = models.DateField(
        help_text='Date of the packout report'
    )
    period_start = models.DateField(
        help_text='Start of fruit packing period'
    )
    period_end = models.DateField(
        help_text='End of fruit packing period'
    )
    run_numbers = models.CharField(
        max_length=200,
        blank=True,
        help_text='Run numbers covered (e.g., "2535499" or "2535579, 2535591")'
    )

    # Bins for this period and cumulative
    bins_this_period = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Bins packed this period'
    )
    bins_cumulative = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Cumulative bins for pool to date'
    )

    # Summary percentages
    total_packed_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage of fruit packed (vs. juice/cull)'
    )
    house_avg_packed_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='House average pack percentage for comparison'
    )

    # Cull/juice info
    juice_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    cull_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Quality notes from packinghouse
    quality_notes = models.TextField(
        blank=True,
        help_text='Quality observations (e.g., "Wind Scar", "Scale")'
    )

    # Store raw JSON for complete grade breakdown
    grade_data_json = models.JSONField(
        default=dict,
        help_text='Complete grade breakdown data from report'
    )

    # Link to source PDF statement (if created via PDF upload)
    source_statement = models.OneToOneField(
        'PackinghouseStatement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packout_report',
        help_text='Source PDF statement if created via upload'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-report_date']
        verbose_name = "Packout Report"
        verbose_name_plural = "Packout Reports"
        indexes = [
            models.Index(fields=['pool', '-report_date'], name='idx_packout_pool_date'),
            models.Index(fields=['field', '-report_date'], name='idx_packout_field_date'),
        ]

    def __str__(self):
        return f"Packout {self.report_date} - {self.field.name}"


class PackoutGradeLine(models.Model):
    """
    Individual grade/size line from packout report.
    E.g., SUNKIST 075 - 120 cartons (15.5%)
    """

    UNIT_CHOICES = [
        ('CARTON', 'Cartons'),
        ('BIN', 'Bins'),
        ('LBS', 'Pounds'),
    ]

    packout_report = models.ForeignKey(
        PackoutReport,
        on_delete=models.CASCADE,
        related_name='grade_lines'
    )

    grade = models.CharField(
        max_length=20,
        help_text='Grade designation (e.g., "SUNKIST", "CHOICE", "STANDARD", "JUICE")'
    )
    size = models.CharField(
        max_length=10,
        blank=True,
        help_text='Size code (e.g., "075", "088", "113")'
    )
    unit_of_measure = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='CARTON'
    )

    # This period
    quantity_this_period = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Quantity packed this period'
    )
    percent_this_period = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Percentage of pack this period'
    )

    # Cumulative (pool to date)
    quantity_cumulative = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    percent_cumulative = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )

    # House average comparison
    house_avg_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='House average percentage for comparison'
    )

    class Meta:
        ordering = ['grade', 'size']
        verbose_name = "Packout Grade Line"
        verbose_name_plural = "Packout Grade Lines"

    def __str__(self):
        if self.size:
            return f"{self.grade} {self.size}: {self.quantity_this_period} {self.unit_of_measure}"
        return f"{self.grade}: {self.quantity_this_period} {self.unit_of_measure}"


class PoolSettlement(models.Model):
    """
    Final pool closing statement with pricing and returns.
    Shows gross credits, deductions, and net return.
    """

    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        related_name='settlements'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='pool_settlements',
        help_text='Specific field, or null for grower summary across all blocks'
    )

    statement_date = models.DateField(
        help_text='Date of settlement statement'
    )

    # Receiving totals
    total_bins = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Total bins in settlement'
    )
    total_cartons = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Summary financials
    total_credits = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total gross credits (sales)'
    )
    total_deductions = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total deductions (packing, assessments, etc.)'
    )
    net_return = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Net return (credits - deductions)'
    )
    prior_advances = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Prior advances paid to grower'
    )
    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Final amount due (net return - prior advances)'
    )

    # Per-unit metrics (high precision for accurate calculations)
    net_per_bin = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    net_per_carton = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    net_per_lb = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True
    )
    net_per_acre = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # House average comparison
    house_avg_per_bin = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    house_avg_per_carton = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Pack percentages
    fresh_fruit_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage packed as fresh fruit'
    )
    products_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage going to products/juice'
    )

    # Store complete data
    settlement_data_json = models.JSONField(
        default=dict,
        help_text='Complete settlement data for reference'
    )

    # Link to source PDF statement (if created via PDF upload)
    source_statement = models.OneToOneField(
        'PackinghouseStatement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pool_settlement',
        help_text='Source PDF statement if created via upload'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-statement_date']
        verbose_name = "Pool Settlement"
        verbose_name_plural = "Pool Settlements"
        indexes = [
            models.Index(fields=['pool', '-statement_date'], name='idx_settle_pool_date'),
            models.Index(fields=['field', '-statement_date'], name='idx_settle_field_date'),
        ]

    def __str__(self):
        field_name = self.field.name if self.field else "All Blocks"
        return f"Settlement {self.statement_date} - {field_name}"

    @property
    def variance_vs_house_per_bin(self):
        """Calculate variance from house average per bin."""
        if self.net_per_bin and self.house_avg_per_bin:
            return float(self.net_per_bin - self.house_avg_per_bin)
        return None


class SettlementGradeLine(models.Model):
    """
    Pricing detail by grade/size from settlement.
    Shows quantity, FOB rate, and total for each grade.
    """

    UNIT_CHOICES = [
        ('CARTON', 'Cartons'),
        ('BIN', 'Bins'),
        ('LBS', 'Pounds'),
    ]

    settlement = models.ForeignKey(
        PoolSettlement,
        on_delete=models.CASCADE,
        related_name='grade_lines'
    )

    grade = models.CharField(
        max_length=20,
        help_text='Grade designation (e.g., "SK DOMESTIC", "CH DOMESTIC", "JUICE")'
    )
    size = models.CharField(
        max_length=10,
        blank=True,
        help_text='Size code (e.g., "048", "056", "072")'
    )
    unit_of_measure = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='CARTON'
    )

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Quantity in this grade/size'
    )
    percent_of_total = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Percentage of total pack'
    )
    fob_rate = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        help_text='FOB price per unit (high precision: 21.75359773)'
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total credit for this line'
    )

    class Meta:
        ordering = ['grade', 'size']
        verbose_name = "Settlement Grade Line"
        verbose_name_plural = "Settlement Grade Lines"

    def __str__(self):
        if self.size:
            return f"{self.grade} {self.size}: {self.quantity} @ ${self.fob_rate}"
        return f"{self.grade}: {self.quantity} @ ${self.fob_rate}"


class SettlementDeduction(models.Model):
    """
    Itemized charges from settlement.
    Tracks packing charges, assessments, capital contributions, etc.
    """

    CATEGORY_CHOICES = [
        ('packing', 'Packing Charges'),
        ('assessment', 'Assessments'),
        ('pick_haul', 'Pick & Haul'),
        ('capital', 'Capital Funds'),
        ('marketing', 'Marketing'),
        ('other', 'Other'),
    ]

    settlement = models.ForeignKey(
        PoolSettlement,
        on_delete=models.CASCADE,
        related_name='deductions'
    )

    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        help_text='Deduction category'
    )
    description = models.CharField(
        max_length=200,
        help_text='Description (e.g., "DOOR CHARGE", "SUNKIST MARKETING")'
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Quantity basis'
    )
    unit_of_measure = models.CharField(
        max_length=20,
        help_text='Unit (BIN, CTN, LBS, etc.)'
    )
    rate = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text='Rate per unit (high precision)'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total deduction amount'
    )

    class Meta:
        ordering = ['category', 'description']
        verbose_name = "Settlement Deduction"
        verbose_name_plural = "Settlement Deductions"

    def __str__(self):
        return f"{self.description}: ${self.amount}"


class GrowerLedgerEntry(models.Model):
    """
    Track advances and payments from packinghouse.
    Used to reconcile grower account with packinghouse.
    """

    ENTRY_TYPE_CHOICES = [
        ('advance', 'Advance'),
        ('pool_close', 'Pool Close'),
        ('adjustment', 'Adjustment'),
        ('refund', 'Refund'),
        ('payment', 'Payment'),
        ('capital_equity', 'Capital/Equity'),
    ]

    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='ledger_entries'
    )
    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='ledger_entries',
        help_text='Associated pool, if applicable'
    )

    entry_date = models.DateField(
        help_text='Transaction date'
    )
    posted_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date posted to account'
    )
    entry_type = models.CharField(
        max_length=20,
        choices=ENTRY_TYPE_CHOICES
    )
    reference = models.CharField(
        max_length=50,
        blank=True,
        help_text='Reference number (e.g., "APM-SL-09588", "00265")'
    )
    description = models.CharField(
        max_length=200,
        help_text='Transaction description'
    )

    # Debit increases what packinghouse owes grower
    # Credit increases what grower owes packinghouse (or reduces balance)
    debit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount owed to grower'
    )
    credit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount paid or offset'
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Running balance after this entry'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-entry_date', '-created_at']
        verbose_name = "Grower Ledger Entry"
        verbose_name_plural = "Grower Ledger Entries"
        indexes = [
            models.Index(fields=['packinghouse', '-entry_date'], name='idx_ledger_pkghs_date'),
            models.Index(fields=['entry_type'], name='idx_ledger_type'),
        ]

    def __str__(self):
        return f"{self.entry_date} - {self.description} (${self.debit - self.credit})"

    @property
    def net_amount(self):
        """Return net amount (positive = owed to grower)."""
        return self.debit - self.credit


class PackinghouseStatement(models.Model):
    """
    Uploaded PDF statement from packinghouse with AI-extracted data.
    Supports VPOA and SLA statement formats.
    """

    STATEMENT_TYPE_CHOICES = [
        ('packout', 'Packout Statement'),
        ('settlement', 'Pool Settlement'),
        ('wash_report', 'Wash Report'),
        ('grower_statement', 'Grower Pool Statement'),
    ]

    PACKINGHOUSE_FORMAT_CHOICES = [
        ('vpoa', 'Villa Park Orchards (VPOA)'),
        ('sla', 'Saticoy Lemon Association (SLA)'),
        ('generic', 'Generic/Other'),
    ]

    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('extracting', 'Extracting'),
        ('extracted', 'Extracted'),
        ('review', 'Awaiting Review'),
        ('completed', 'Completed'),
        ('failed', 'Extraction Failed'),
    ]

    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='statements',
        null=True,
        blank=True,
        help_text='Packinghouse this statement is from (auto-detected if not specified)'
    )

    # File storage
    pdf_file = models.FileField(
        upload_to='packinghouse_statements/%Y/%m/',
        help_text='Uploaded PDF file'
    )
    original_filename = models.CharField(
        max_length=255,
        help_text='Original filename of uploaded PDF'
    )
    file_size_bytes = models.PositiveIntegerField(
        help_text='File size in bytes'
    )

    # Statement classification
    statement_type = models.CharField(
        max_length=20,
        choices=STATEMENT_TYPE_CHOICES,
        blank=True,
        help_text='Type of statement (auto-detected or user-specified)'
    )
    packinghouse_format = models.CharField(
        max_length=20,
        choices=PACKINGHOUSE_FORMAT_CHOICES,
        default='generic',
        help_text='Format/template used by packinghouse (auto-detected)'
    )

    # Processing status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploaded'
    )

    # Extracted data (raw JSON from AI extraction)
    extracted_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Raw extracted data from PDF for preview/editing'
    )

    # Extraction confidence (0.0 - 1.0)
    extraction_confidence = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='AI confidence in extraction accuracy'
    )

    # Error tracking
    extraction_error = models.TextField(
        blank=True,
        help_text='Error message if extraction failed'
    )

    # Optional associations (set after user confirms data)
    pool = models.ForeignKey(
        Pool,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_statements',
        help_text='Pool this statement belongs to (set during confirmation)'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_statements',
        help_text='Field this statement is for (set during confirmation)'
    )

    # Batch upload tracking (set when uploaded as part of batch)
    batch_upload = models.ForeignKey(
        'StatementBatchUpload',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='statements',
        help_text='Batch this statement belongs to (if uploaded via batch)'
    )

    # Auto-match result (populated during batch upload)
    auto_match_result = models.JSONField(
        default=dict,
        blank=True,
        help_text='Auto-matching result with confidence scores'
    )

    # Audit fields
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_statements'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Packinghouse Statement"
        verbose_name_plural = "Packinghouse Statements"
        indexes = [
            models.Index(fields=['packinghouse', '-created_at'], name='idx_stmt_pkghs_created'),
            models.Index(fields=['status'], name='idx_stmt_status'),
            models.Index(fields=['statement_type'], name='idx_stmt_type'),
        ]

    def __str__(self):
        return f"{self.original_filename} ({self.get_status_display()})"

    @property
    def has_packout_report(self):
        """Check if this statement has generated a PackoutReport."""
        return hasattr(self, 'packout_report') and self.packout_report is not None

    @property
    def has_pool_settlement(self):
        """Check if this statement has generated a PoolSettlement."""
        return hasattr(self, 'pool_settlement') and self.pool_settlement is not None

    @property
    def is_processed(self):
        """Check if statement has been processed into a report/settlement."""
        return self.has_packout_report or self.has_pool_settlement


class PackinghouseGrowerMapping(models.Model):
    """
    Learned mappings from grower names/IDs in PDF statements to farms/fields.
    Created when users confirm statement matches, used for auto-matching future uploads.
    """
    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='grower_mappings',
        help_text='Packinghouse this mapping applies to'
    )

    # Pattern matching fields (from PDF data)
    grower_name_pattern = models.CharField(
        max_length=255,
        help_text='Grower name as it appears in statements (e.g., "THACKER FARMS")'
    )
    grower_id_pattern = models.CharField(
        max_length=100,
        blank=True,
        help_text='Grower ID as it appears in statements (e.g., "THACR641")'
    )
    block_name_pattern = models.CharField(
        max_length=100,
        blank=True,
        help_text='Block/ranch name pattern for field-level matching'
    )

    # Target entities
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        related_name='packinghouse_mappings',
        help_text='Farm this grower name maps to'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packinghouse_mappings',
        help_text='Optional specific field this block name maps to'
    )

    # Usage tracking
    use_count = models.PositiveIntegerField(
        default=1,
        help_text='Number of times this mapping has been used'
    )
    last_used_at = models.DateTimeField(
        auto_now=True,
        help_text='When this mapping was last used'
    )

    # Source tracking
    created_from_statement = models.ForeignKey(
        PackinghouseStatement,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_mappings',
        help_text='Statement that created this mapping'
    )

    # Audit fields
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_grower_mappings'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Packinghouse Grower Mapping"
        verbose_name_plural = "Packinghouse Grower Mappings"
        # Unique constraint on packinghouse + grower pattern + optional block
        unique_together = ['packinghouse', 'grower_name_pattern', 'block_name_pattern']
        indexes = [
            models.Index(fields=['packinghouse', 'grower_name_pattern'], name='idx_mapping_grower'),
            models.Index(fields=['packinghouse', 'grower_id_pattern'], name='idx_mapping_grower_id'),
            models.Index(fields=['farm'], name='idx_mapping_farm'),
        ]
        ordering = ['-use_count', '-last_used_at']

    def __str__(self):
        target = f"{self.farm.name}"
        if self.field:
            target += f" / {self.field.name}"
        return f"{self.grower_name_pattern} -> {target}"

    def increment_use_count(self):
        """Increment the use count when mapping is used."""
        self.use_count += 1
        self.save(update_fields=['use_count', 'last_used_at'])


class StatementBatchUpload(models.Model):
    """
    Tracks batch upload progress for multiple PDF statements.
    """
    BATCH_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('partial', 'Partial Success'),
        ('failed', 'Failed'),
    ]

    batch_id = models.UUIDField(
        unique=True,
        editable=False,
        help_text='Unique identifier for this batch'
    )
    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='batch_uploads',
        null=True,
        blank=True,
        help_text='Default packinghouse (null for mixed uploads with auto-detection)'
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=BATCH_STATUS_CHOICES,
        default='pending'
    )

    # Progress counters
    total_files = models.PositiveIntegerField(
        default=0,
        help_text='Total number of files in batch'
    )
    processed_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of files processed'
    )
    success_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of successfully extracted files'
    )
    failed_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of failed extractions'
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text='Error message if batch failed'
    )

    # Audit fields
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='batch_uploads'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When processing completed'
    )

    class Meta:
        verbose_name = "Statement Batch Upload"
        verbose_name_plural = "Statement Batch Uploads"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['batch_id'], name='idx_batch_id'),
            models.Index(fields=['packinghouse', '-created_at'], name='idx_batch_pkghs'),
            models.Index(fields=['status'], name='idx_batch_status'),
        ]

    def __str__(self):
        return f"Batch {self.batch_id} ({self.status})"

    @property
    def progress_percent(self):
        """Calculate progress percentage."""
        if self.total_files == 0:
            return 0
        return round((self.processed_count / self.total_files) * 100, 1)

    @property
    def is_complete(self):
        """Check if batch processing is complete."""
        return self.status in ['completed', 'partial', 'failed']


# Add FK from PackinghouseStatement to StatementBatchUpload
# This needs to be added via migration since the model is already defined
# We'll add it as a nullable field


# =============================================================================
# FSMA COMPLIANCE MODULE
# =============================================================================

# --- FSMA Choice Constants ---

FACILITY_TYPE_CHOICES = [
    ('packing_shed', 'Packing Shed'),
    ('cold_storage', 'Cold Storage'),
    ('processing_area', 'Processing Area'),
    ('restroom', 'Restroom/Portable Toilet'),
    ('break_room', 'Break Room'),
    ('equipment_storage', 'Equipment Storage'),
    ('chemical_storage', 'Chemical/Pesticide Storage'),
    ('loading_dock', 'Loading Dock'),
    ('field_station', 'Field Station'),
    ('other', 'Other'),
]

CLEANING_FREQUENCY_CHOICES = [
    ('daily', 'Daily'),
    ('twice_daily', 'Twice Daily'),
    ('weekly', 'Weekly'),
    ('biweekly', 'Bi-Weekly'),
    ('monthly', 'Monthly'),
    ('as_needed', 'As Needed'),
    ('after_use', 'After Each Use'),
]

VISITOR_TYPE_CHOICES = [
    ('harvester', 'Harvest Crew'),
    ('buyer', 'Buyer/Inspector'),
    ('contractor', 'Contractor'),
    ('vendor', 'Vendor/Supplier'),
    ('government', 'Government Inspector'),
    ('auditor', 'Auditor'),
    ('consultant', 'Consultant/PCA'),
    ('delivery', 'Delivery Personnel'),
    ('maintenance', 'Maintenance'),
    ('visitor', 'General Visitor'),
    ('other', 'Other'),
]

SAFETY_MEETING_TYPE_CHOICES = [
    ('quarterly_fsma', 'Quarterly FSMA Training'),
    ('annual_food_safety', 'Annual Food Safety Training'),
    ('wps_initial', 'WPS Initial Training'),
    ('wps_annual', 'WPS Annual Refresher'),
    ('heat_illness', 'Heat Illness Prevention'),
    ('pesticide_safety', 'Pesticide Safety'),
    ('equipment_operation', 'Equipment Operation'),
    ('emergency_procedures', 'Emergency Procedures'),
    ('ppe_usage', 'PPE Usage Training'),
    ('other', 'Other Safety Meeting'),
]

INVENTORY_TRANSACTION_TYPE_CHOICES = [
    ('purchase', 'Purchase/Received'),
    ('application', 'Application Used'),
    ('adjustment', 'Manual Adjustment'),
    ('return', 'Returned to Supplier'),
    ('disposed', 'Disposed/Expired'),
    ('transfer_in', 'Transfer In'),
    ('transfer_out', 'Transfer Out'),
]

PHI_STATUS_CHOICES = [
    ('pending', 'Pending Check'),
    ('compliant', 'Compliant'),
    ('warning', 'Warning - Near PHI'),
    ('non_compliant', 'Non-Compliant'),
    ('override', 'Override Applied'),
]

AUDIT_BINDER_STATUS_CHOICES = [
    ('pending', 'Pending Generation'),
    ('generating', 'Generating'),
    ('completed', 'Completed'),
    ('failed', 'Failed'),
]


class UserSignature(models.Model):
    """
    Stores a user's saved digital signature for reuse across FSMA forms.
    One signature per user - can be updated when needed.
    """
    user = models.OneToOneField(
        'User',
        on_delete=models.CASCADE,
        related_name='saved_signature'
    )
    signature_data = models.TextField(
        help_text="Base64 encoded PNG signature image"
    )
    signature_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 hash for verification"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Signature"
        verbose_name_plural = "User Signatures"

    def __str__(self):
        return f"Signature for {self.user.email}"

    def save(self, *args, **kwargs):
        import hashlib
        if self.signature_data:
            self.signature_hash = hashlib.sha256(self.signature_data.encode()).hexdigest()
        super().save(*args, **kwargs)


class FacilityLocation(models.Model):
    """
    Defines a facility/location that requires cleaning tracking.
    Each company can have multiple facilities to manage.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='fsma_facilities'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='fsma_facilities',
        help_text="Optional: Link to specific farm"
    )
    name = models.CharField(
        max_length=100,
        help_text="Facility name (e.g., 'Main Packing Shed', 'North Field Restroom')"
    )
    facility_type = models.CharField(
        max_length=30,
        choices=FACILITY_TYPE_CHOICES,
        default='packing_shed'
    )
    description = models.TextField(
        blank=True,
        help_text="Additional description or notes"
    )
    cleaning_frequency = models.CharField(
        max_length=20,
        choices=CLEANING_FREQUENCY_CHOICES,
        default='daily'
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive facilities won't appear in cleaning schedules"
    )
    gps_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )
    gps_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Facility Location"
        verbose_name_plural = "Facility Locations"
        ordering = ['name']
        indexes = [
            models.Index(fields=['company', 'is_active'], name='idx_facility_company_active'),
            models.Index(fields=['facility_type'], name='idx_facility_type'),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_facility_type_display()})"


class FacilityCleaningLog(models.Model):
    """
    Records a cleaning event for a facility.
    Includes checklist items and signature verification.
    """
    facility = models.ForeignKey(
        FacilityLocation,
        on_delete=models.CASCADE,
        related_name='cleaning_logs'
    )
    cleaning_date = models.DateField()
    cleaning_time = models.TimeField()
    cleaned_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='cleaning_logs_performed'
    )
    cleaned_by_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name if cleaned by non-system user"
    )

    # Checklist items (common cleaning tasks)
    surfaces_cleaned = models.BooleanField(default=False)
    floors_cleaned = models.BooleanField(default=False)
    trash_removed = models.BooleanField(default=False)
    sanitizer_applied = models.BooleanField(default=False)
    supplies_restocked = models.BooleanField(default=False)
    equipment_cleaned = models.BooleanField(default=False)

    # Additional checklist items stored as JSON for flexibility
    additional_checklist = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional checklist items specific to facility type"
    )

    notes = models.TextField(blank=True)

    # Signature capture
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 encoded signature image"
    )
    signature_timestamp = models.DateTimeField(null=True, blank=True)

    # Verification
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cleaning_logs_verified'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Facility Cleaning Log"
        verbose_name_plural = "Facility Cleaning Logs"
        ordering = ['-cleaning_date', '-cleaning_time']
        indexes = [
            models.Index(fields=['facility', '-cleaning_date'], name='idx_cleaning_facility_date'),
            models.Index(fields=['cleaning_date'], name='idx_cleaning_date'),
        ]

    def __str__(self):
        return f"{self.facility.name} - {self.cleaning_date}"

    @property
    def is_signed(self):
        return bool(self.signature_data)


class VisitorLog(models.Model):
    """
    Tracks all visitors to farm properties for FSMA traceability.
    Can be linked to harvest events for harvester crews.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='visitor_logs'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='visitor_logs'
    )

    # Visitor identification
    visitor_name = models.CharField(max_length=150)
    visitor_company = models.CharField(
        max_length=150,
        blank=True,
        help_text="Visitor's company/organization"
    )
    visitor_type = models.CharField(
        max_length=30,
        choices=VISITOR_TYPE_CHOICES,
        default='visitor'
    )
    visitor_phone = models.CharField(max_length=20, blank=True)
    visitor_email = models.EmailField(blank=True)

    # Visit details
    visit_date = models.DateField()
    time_in = models.TimeField()
    time_out = models.TimeField(null=True, blank=True)
    purpose = models.TextField(
        blank=True,
        help_text="Purpose of visit"
    )

    # Fields/areas visited (M2M to Field)
    fields_visited = models.ManyToManyField(
        'Field',
        blank=True,
        related_name='visitor_logs'
    )
    areas_visited = models.TextField(
        blank=True,
        help_text="Free text for non-field areas visited"
    )

    # Vehicle info
    vehicle_info = models.CharField(
        max_length=100,
        blank=True,
        help_text="Vehicle description/license plate"
    )

    # Harvest linkage
    linked_harvest = models.ForeignKey(
        'Harvest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visitor_logs',
        help_text="Linked harvest event (for harvest crews)"
    )
    auto_linked = models.BooleanField(
        default=False,
        help_text="Whether harvest was auto-linked by date match"
    )

    # Health screening (COVID-era but still useful)
    health_screening_passed = models.BooleanField(
        default=True,
        help_text="Did visitor pass health screening?"
    )
    screening_notes = models.TextField(blank=True)

    # Signature
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 encoded visitor signature"
    )
    signature_timestamp = models.DateTimeField(null=True, blank=True)

    # Who logged this entry
    logged_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='visitor_logs_created'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Visitor Log"
        verbose_name_plural = "Visitor Logs"
        ordering = ['-visit_date', '-time_in']
        indexes = [
            models.Index(fields=['company', '-visit_date'], name='idx_visitor_company_date'),
            models.Index(fields=['farm', '-visit_date'], name='idx_visitor_farm_date'),
            models.Index(fields=['visitor_type'], name='idx_visitor_type'),
            models.Index(fields=['linked_harvest'], name='idx_visitor_harvest'),
        ]

    def __str__(self):
        return f"{self.visitor_name} - {self.farm.name} ({self.visit_date})"

    @property
    def is_signed(self):
        return bool(self.signature_data)

    @property
    def duration_minutes(self):
        if self.time_in and self.time_out:
            from datetime import datetime, timedelta
            t_in = datetime.combine(self.visit_date, self.time_in)
            t_out = datetime.combine(self.visit_date, self.time_out)
            if t_out < t_in:
                t_out += timedelta(days=1)
            return int((t_out - t_in).total_seconds() / 60)
        return None


class SafetyMeeting(models.Model):
    """
    Records company-wide safety meetings (not per-farm).
    Quarterly FSMA training and other safety topics.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='safety_meetings'
    )
    meeting_type = models.CharField(
        max_length=30,
        choices=SAFETY_MEETING_TYPE_CHOICES,
        default='quarterly_fsma'
    )
    meeting_date = models.DateField()
    meeting_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)

    # Meeting details
    topics_covered = models.JSONField(
        default=list,
        help_text="List of topics covered in this meeting"
    )
    description = models.TextField(
        blank=True,
        help_text="Meeting description or agenda"
    )
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Meeting duration in minutes"
    )

    # Quarterly tracking (for quarterly compliance)
    quarter = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Quarter number (1-4)"
    )
    year = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Year for quarterly tracking"
    )

    # Trainer/presenter info
    trainer_name = models.CharField(max_length=150, blank=True)
    trainer_credentials = models.CharField(max_length=200, blank=True)

    # Attachments (e.g., presentation, materials)
    materials_provided = models.TextField(
        blank=True,
        help_text="Description of training materials provided"
    )

    # Metadata
    conducted_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='safety_meetings_conducted'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Safety Meeting"
        verbose_name_plural = "Safety Meetings"
        ordering = ['-meeting_date']
        indexes = [
            models.Index(fields=['company', '-meeting_date'], name='idx_safety_meeting_company'),
            models.Index(fields=['meeting_type'], name='idx_safety_meeting_type'),
            models.Index(fields=['company', 'year', 'quarter'], name='idx_safety_meeting_quarter'),
        ]
        unique_together = [
            ['company', 'meeting_type', 'year', 'quarter']  # One quarterly meeting per type
        ]

    def __str__(self):
        return f"{self.get_meeting_type_display()} - {self.meeting_date}"

    def save(self, *args, **kwargs):
        # Auto-calculate quarter and year if not set
        if self.meeting_date and not self.quarter:
            self.quarter = (self.meeting_date.month - 1) // 3 + 1
        if self.meeting_date and not self.year:
            self.year = self.meeting_date.year
        super().save(*args, **kwargs)


class SafetyMeetingAttendee(models.Model):
    """
    Records individual attendance at a safety meeting.
    Each attendee must sign to confirm attendance.
    """
    meeting = models.ForeignKey(
        SafetyMeeting,
        on_delete=models.CASCADE,
        related_name='attendees'
    )

    # Attendee info (may or may not be a system user)
    user = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='safety_meeting_attendance'
    )
    attendee_name = models.CharField(
        max_length=150,
        help_text="Attendee name (auto-filled from user if linked)"
    )
    employee_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)

    # Signature capture
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 encoded signature"
    )
    signed_at = models.DateTimeField(null=True, blank=True)

    # Record keeping
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Safety Meeting Attendee"
        verbose_name_plural = "Safety Meeting Attendees"
        ordering = ['attendee_name']
        unique_together = [['meeting', 'attendee_name']]  # One entry per person per meeting

    def __str__(self):
        return f"{self.attendee_name} - {self.meeting}"

    @property
    def is_signed(self):
        return bool(self.signature_data)


class FertilizerInventory(models.Model):
    """
    Tracks current inventory levels for fertilizer products.
    One record per product per company.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='fertilizer_inventory'
    )
    product = models.ForeignKey(
        FertilizerProduct,
        on_delete=models.CASCADE,
        related_name='inventory_records'
    )
    quantity_on_hand = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Current quantity on hand"
    )
    unit = models.CharField(
        max_length=20,
        default='lbs',
        help_text="Unit of measurement (lbs, gallons, tons, etc.)"
    )
    reorder_point = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Alert when inventory falls below this level"
    )
    storage_location = models.CharField(
        max_length=100,
        blank=True,
        help_text="Where this product is stored"
    )
    lot_number = models.CharField(max_length=50, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Fertilizer Inventory"
        verbose_name_plural = "Fertilizer Inventories"
        unique_together = [['company', 'product']]
        indexes = [
            models.Index(fields=['company', 'product'], name='idx_fert_inv_company_product'),
        ]

    def __str__(self):
        return f"{self.product.name}: {self.quantity_on_hand} {self.unit}"

    @property
    def is_low_stock(self):
        if self.reorder_point:
            return self.quantity_on_hand <= self.reorder_point
        return False


class FertilizerInventoryTransaction(models.Model):
    """
    Records all inventory movements (purchases, applications, adjustments).
    Provides full audit trail for fertilizer usage.
    """
    inventory = models.ForeignKey(
        FertilizerInventory,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=INVENTORY_TRANSACTION_TYPE_CHOICES
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Positive for additions, negative for deductions"
    )
    balance_after = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Inventory balance after this transaction"
    )
    transaction_date = models.DateTimeField()

    # Link to nutrient application if applicable
    nutrient_application = models.ForeignKey(
        NutrientApplication,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_transactions'
    )

    # Purchase/receiving details
    supplier = models.CharField(max_length=150, blank=True)
    invoice_number = models.CharField(max_length=50, blank=True)
    cost_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='inventory_transactions_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Inventory Transaction"
        verbose_name_plural = "Inventory Transactions"
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['inventory', '-transaction_date'], name='idx_inv_trans_inv_date'),
            models.Index(fields=['transaction_type'], name='idx_inv_trans_type'),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()}: {self.quantity} ({self.inventory.product.name})"


class MonthlyInventorySnapshot(models.Model):
    """
    Stores monthly inventory snapshots for reporting.
    Auto-generated on the 1st of each month.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='inventory_snapshots'
    )
    month = models.PositiveSmallIntegerField(help_text="Month (1-12)")
    year = models.PositiveIntegerField()

    # Full inventory snapshot stored as JSON
    inventory_data = models.JSONField(
        default=list,
        help_text="Snapshot of all inventory levels"
    )
    # Summary statistics
    total_products = models.PositiveIntegerField(default=0)
    total_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    low_stock_count = models.PositiveIntegerField(default=0)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Monthly Inventory Snapshot"
        verbose_name_plural = "Monthly Inventory Snapshots"
        unique_together = [['company', 'year', 'month']]
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.company.name} - {self.year}/{self.month:02d} Inventory"


class PHIComplianceCheck(models.Model):
    """
    Pre-Harvest Interval compliance verification for each harvest.
    Auto-created when a harvest is recorded to verify PHI requirements.
    """
    harvest = models.OneToOneField(
        'Harvest',
        on_delete=models.CASCADE,
        related_name='phi_compliance_check'
    )
    status = models.CharField(
        max_length=20,
        choices=PHI_STATUS_CHOICES,
        default='pending'
    )

    # Details of PHI analysis
    applications_checked = models.JSONField(
        default=list,
        help_text="List of pesticide applications checked with PHI details"
    )
    warnings = models.JSONField(
        default=list,
        help_text="List of warning messages"
    )
    earliest_safe_harvest = models.DateField(
        null=True,
        blank=True,
        help_text="Earliest date harvest would be compliant"
    )

    # Override if user accepts warning
    override_reason = models.TextField(
        blank=True,
        help_text="Reason if status was overridden"
    )
    override_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='phi_overrides'
    )
    override_at = models.DateTimeField(null=True, blank=True)

    checked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "PHI Compliance Check"
        verbose_name_plural = "PHI Compliance Checks"
        indexes = [
            models.Index(fields=['status'], name='idx_phi_status'),
        ]

    def __str__(self):
        return f"PHI Check for Harvest #{self.harvest.id} - {self.get_status_display()}"


class AuditBinder(models.Model):
    """
    Represents a generated audit binder PDF containing FSMA compliance records.
    Used for inspections and record-keeping.
    """
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='audit_binders'
    )

    # Date range for included records
    date_range_start = models.DateField()
    date_range_end = models.DateField()

    # Content selection flags
    include_visitor_logs = models.BooleanField(default=True)
    include_cleaning_logs = models.BooleanField(default=True)
    include_safety_meetings = models.BooleanField(default=True)
    include_fertilizer_inventory = models.BooleanField(default=True)
    include_phi_reports = models.BooleanField(default=True)
    include_harvest_records = models.BooleanField(default=True)

    # Optional filters
    farm_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Filter to specific farms (empty = all farms)"
    )

    # Generated document
    pdf_file = models.FileField(
        upload_to='audit_binders/',
        null=True,
        blank=True
    )
    file_size = models.PositiveIntegerField(null=True, blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)

    # Generation status
    status = models.CharField(
        max_length=20,
        choices=AUDIT_BINDER_STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(blank=True)
    generation_started = models.DateTimeField(null=True, blank=True)
    generation_completed = models.DateTimeField(null=True, blank=True)

    # Metadata
    generated_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_binders_generated'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Audit Binder"
        verbose_name_plural = "Audit Binders"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', '-created_at'], name='idx_audit_binder_company'),
            models.Index(fields=['status'], name='idx_audit_binder_status'),
        ]

    def __str__(self):
        return f"Audit Binder {self.date_range_start} to {self.date_range_end}"

    @property
    def generation_duration_seconds(self):
        if self.generation_started and self.generation_completed:
            return (self.generation_completed - self.generation_started).total_seconds()
        return None


# =============================================================================
# FSMA PRE-HARVEST AGRICULTURAL WATER ASSESSMENT MODELS
# =============================================================================

class FSMAWaterAssessment(models.Model):
    """
    Main FSMA Pre-Harvest Agricultural Water Assessment (21 CFR 112.43).

    Each farm needs one assessment per year covering all pre-harvest water sources.
    Must be reviewed and signed by a qualified supervisor.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('pending_review', 'Pending Review'),
        ('approved', 'Approved'),
        ('expired', 'Expired'),
    ]

    OUTCOME_CHOICES = [
        ('no_treatment', 'No Treatment Required'),
        ('treatment_required', 'Treatment Required'),
        ('die_off_required', 'Die-Off Period Required'),
        ('testing_required', 'Additional Testing Required'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='water_assessments'
    )
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        related_name='water_assessments'
    )
    assessment_year = models.IntegerField(
        help_text="Year this assessment covers"
    )

    # Assessment metadata
    assessment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date assessment was conducted"
    )
    assessor = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='water_assessments_conducted',
        help_text="User who conducted the assessment"
    )
    assessor_name = models.CharField(max_length=200, blank=True)
    assessor_title = models.CharField(max_length=100, blank=True)

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Risk scoring (calculated)
    overall_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated overall risk score (0-100)"
    )
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    # FDA outcome determination
    fda_outcome = models.CharField(
        max_length=30,
        choices=OUTCOME_CHOICES,
        blank=True
    )
    outcome_notes = models.TextField(
        blank=True,
        help_text="Written justification for the determination"
    )

    # Submission workflow
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_water_assessments'
    )

    # Approval workflow (required by FDA)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_water_assessments'
    )
    approval_notes = models.TextField(blank=True)

    # Signatures
    assessor_signature = models.TextField(
        blank=True,
        help_text="Base64-encoded signature image or typed name"
    )
    assessor_signature_date = models.DateTimeField(null=True, blank=True)
    approver_signature = models.TextField(
        blank=True,
        help_text="Base64-encoded signature image or typed name"
    )
    approver_signature_date = models.DateTimeField(null=True, blank=True)

    # Generated PDF
    pdf_file = models.FileField(
        upload_to='water_assessments/%Y/%m/',
        null=True,
        blank=True
    )
    pdf_generated_at = models.DateTimeField(null=True, blank=True)

    # Expiration (assessments are valid for 1 year)
    valid_until = models.DateField(null=True, blank=True)

    # Notes
    general_notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['farm', 'assessment_year']
        ordering = ['-assessment_year', 'farm__name']
        verbose_name = 'FSMA Water Assessment'
        verbose_name_plural = 'FSMA Water Assessments'
        indexes = [
            models.Index(fields=['company', '-assessment_year'], name='idx_water_asmt_company_year'),
            models.Index(fields=['status'], name='idx_water_asmt_status'),
            models.Index(fields=['valid_until'], name='idx_water_asmt_valid_until'),
        ]

    def __str__(self):
        return f"{self.farm.name} - {self.assessment_year} Water Assessment"

    @property
    def is_current(self):
        """Check if this assessment is for the current year."""
        from datetime import date
        return self.assessment_year == date.today().year

    @property
    def days_until_expiry(self):
        """Days until this assessment expires."""
        from datetime import date
        if self.valid_until:
            return (self.valid_until - date.today()).days
        return None

    @property
    def is_expired(self):
        """Check if assessment has expired."""
        from datetime import date
        if self.valid_until:
            return self.valid_until < date.today()
        return False


class FSMASourceAssessment(models.Model):
    """
    Assessment of a specific water source within an FSMA water assessment.
    Evaluates Factor 1: Agricultural Water System per FDA requirements.
    """
    CONDITION_CHOICES = [
        ('good', 'Good - No deficiencies'),
        ('fair', 'Fair - Minor issues'),
        ('poor', 'Poor - Significant deficiencies'),
        ('critical', 'Critical - Immediate action needed'),
    ]

    DISTRIBUTION_TYPE_CHOICES = [
        ('direct_contact', 'Direct Contact with Harvestable Portion'),
        ('indirect_contact', 'Indirect Contact'),
        ('no_contact', 'No Contact with Harvestable Portion'),
    ]

    CONTROL_LEVEL_CHOICES = [
        ('full', 'Fully Under Control'),
        ('partial', 'Partially Under Control'),
        ('minimal', 'Minimal Control'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='source_assessments'
    )
    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.CASCADE,
        related_name='fsma_source_assessments'
    )

    # Control level assessment
    source_control_level = models.CharField(
        max_length=20,
        choices=CONTROL_LEVEL_CHOICES,
        default='full'
    )
    distribution_control_level = models.CharField(
        max_length=20,
        choices=CONTROL_LEVEL_CHOICES,
        default='full'
    )

    # Physical condition (for wells)
    wellhead_condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        blank=True
    )
    well_cap_secure = models.BooleanField(null=True, blank=True)
    well_casing_intact = models.BooleanField(null=True, blank=True)
    backflow_prevention = models.BooleanField(null=True, blank=True)

    # Distribution system
    distribution_type = models.CharField(
        max_length=30,
        choices=DISTRIBUTION_TYPE_CHOICES,
        blank=True
    )

    # Contamination risk factors
    animal_access_possible = models.BooleanField(default=False)
    debris_present = models.BooleanField(default=False)
    standing_water_near_source = models.BooleanField(default=False)
    runoff_exposure = models.BooleanField(default=False)

    # Inspection status
    inspected_this_year = models.BooleanField(default=False)
    inspection_date = models.DateField(null=True, blank=True)
    inspection_findings = models.TextField(blank=True)

    # Overall condition
    overall_condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='good'
    )
    protection_description = models.TextField(
        blank=True,
        help_text="Describe how source is protected from contamination"
    )

    # Testing history
    last_test_date = models.DateField(null=True, blank=True)
    last_e_coli_result = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Most recent E. coli result (CFU/100mL)"
    )
    last_generic_ecoli_gm = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Geometric Mean E. coli (CFU/100mL)"
    )
    last_generic_ecoli_stv = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Statistical Threshold Value (CFU/100mL)"
    )
    meets_quality_standard = models.BooleanField(null=True, blank=True)

    # Treatment
    treatment_applied = models.CharField(max_length=100, blank=True)
    treatment_log_available = models.BooleanField(default=False)

    # Risk scoring
    source_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    source_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    # Risk factors identified (JSON list)
    risk_factors = models.JSONField(
        default=list,
        help_text="List of risk factors identified during assessment"
    )

    # Photos (optional)
    photo_1 = models.ImageField(
        upload_to='water_assessment_photos/',
        null=True,
        blank=True
    )
    photo_2 = models.ImageField(
        upload_to='water_assessment_photos/',
        null=True,
        blank=True
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['assessment', 'water_source']
        verbose_name = 'FSMA Source Assessment'
        verbose_name_plural = 'FSMA Source Assessments'

    def __str__(self):
        return f"{self.assessment} - {self.water_source.name}"


class FSMAFieldAssessment(models.Model):
    """
    Field-specific water practice assessment.
    Evaluates Factor 2 (Practices) and Factor 3 (Crop Characteristics).
    """
    APPLICATION_METHOD_CHOICES = [
        ('overhead', 'Overhead Sprinkler'),
        ('drip', 'Drip/Micro-irrigation'),
        ('micro_sprinkler', 'Micro-Sprinkler'),
        ('furrow', 'Furrow/Flood'),
        ('subsurface', 'Subsurface Drip'),
        ('hand_watering', 'Hand Watering'),
        ('none', 'No Irrigation'),
    ]

    CROP_CONTACT_CHOICES = [
        ('direct', 'Water Directly Contacts Harvestable Portion'),
        ('indirect', 'Water Contacts Non-Harvestable Portions Only'),
        ('soil_only', 'Water Applied to Soil Only'),
    ]

    GROWTH_POSITION_CHOICES = [
        ('tree', 'Tree Fruit (Elevated)'),
        ('vine', 'Vine'),
        ('ground', 'Ground Level'),
        ('root', 'Root Crop'),
    ]

    SURFACE_TYPE_CHOICES = [
        ('smooth', 'Smooth'),
        ('rough', 'Rough/Textured'),
        ('netted', 'Netted'),
        ('leafy', 'Leafy'),
    ]

    SUSCEPTIBILITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name='fsma_water_assessments'
    )

    # Water source used for this field
    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fsma_field_assessments'
    )

    # Factor 2: Water Practices
    application_method = models.CharField(
        max_length=30,
        choices=APPLICATION_METHOD_CHOICES,
        blank=True
    )
    crop_contact_type = models.CharField(
        max_length=20,
        choices=CROP_CONTACT_CHOICES,
        blank=True
    )

    # Timing relative to harvest
    typical_days_before_harvest = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical days between last irrigation and harvest"
    )
    minimum_days_before_harvest = models.IntegerField(
        null=True,
        blank=True,
        help_text="Minimum days between last irrigation and harvest"
    )

    # Foliar applications
    foliar_applications = models.BooleanField(
        default=False,
        help_text="Any foliar spray applications using this water?"
    )

    # Factor 3: Crop Characteristics
    crop_growth_position = models.CharField(
        max_length=20,
        choices=GROWTH_POSITION_CHOICES,
        default='tree'
    )
    crop_surface_type = models.CharField(
        max_length=20,
        choices=SURFACE_TYPE_CHOICES,
        default='smooth'
    )
    internalization_risk = models.CharField(
        max_length=20,
        choices=SUSCEPTIBILITY_CHOICES,
        default='low',
        help_text="Susceptibility to pathogen internalization"
    )

    # Die-off considerations
    die_off_period_adequate = models.BooleanField(null=True, blank=True)
    die_off_conditions_notes = models.TextField(
        blank=True,
        help_text="UV exposure, temperature, drying conditions, etc."
    )

    # Risk scoring
    practice_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    crop_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    field_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    field_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['assessment', 'field']
        verbose_name = 'FSMA Field Assessment'
        verbose_name_plural = 'FSMA Field Assessments'

    def __str__(self):
        return f"{self.assessment} - {self.field.name}"


class FSMAEnvironmentalAssessment(models.Model):
    """
    Environmental and adjacent land assessment.
    Evaluates Factor 4 (Environmental) and Factor 5 (Adjacent Land).
    One per FSMAWaterAssessment.
    """
    PROXIMITY_CHOICES = [
        ('within_100ft', 'Within 100 feet'),
        ('100_400ft', '100-400 feet'),
        ('400_1000ft', '400-1000 feet'),
        ('over_1000ft', 'Over 1000 feet'),
        ('none_nearby', 'None in Vicinity'),
    ]

    FLOODING_RISK_CHOICES = [
        ('none', 'No Flooding Risk'),
        ('low', 'Low - Rare flooding'),
        ('medium', 'Medium - Occasional flooding'),
        ('high', 'High - Frequent flooding'),
    ]

    WILDLIFE_PRESSURE_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='environmental_assessments'
    )

    # Factor 4: Environmental Conditions
    flooding_risk = models.CharField(
        max_length=20,
        choices=FLOODING_RISK_CHOICES,
        default='none'
    )
    flooding_history = models.BooleanField(default=False)
    last_flood_date = models.DateField(null=True, blank=True)
    flood_frequency = models.CharField(max_length=50, blank=True)
    heavy_rain_frequency = models.CharField(
        max_length=100,
        blank=True,
        help_text="Description of heavy rain patterns"
    )
    extreme_weather_notes = models.TextField(blank=True)

    # Factor 5: Adjacent Land Uses
    adjacent_land_uses = models.JSONField(
        default=list,
        blank=True,
        help_text="List of adjacent land uses"
    )

    # Animal operations
    animal_operations_nearby = models.BooleanField(default=False)
    animal_operation_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Type of animal operation (dairy, poultry, etc.)"
    )
    animal_operation_distance_ft = models.IntegerField(
        null=True,
        blank=True,
        help_text="Distance to animal operation in feet"
    )
    nearest_cafo_distance = models.CharField(
        max_length=20,
        choices=PROXIMITY_CHOICES,
        blank=True
    )
    nearest_grazing_distance = models.CharField(
        max_length=20,
        choices=PROXIMITY_CHOICES,
        blank=True
    )
    animal_intrusion_history = models.BooleanField(default=False)
    animal_intrusion_notes = models.TextField(blank=True)

    # Manure application
    manure_application_nearby = models.BooleanField(default=False)
    manure_notes = models.TextField(blank=True)

    # Human waste / septic
    human_waste_nearby = models.BooleanField(default=False)
    human_waste_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Type (septic, portable toilets, etc.)"
    )
    nearest_septic_distance = models.CharField(
        max_length=20,
        choices=PROXIMITY_CHOICES,
        blank=True
    )
    septic_system_status = models.CharField(max_length=50, blank=True)

    # Runoff
    upslope_land_uses = models.TextField(blank=True)
    runoff_management_in_place = models.BooleanField(default=False)
    runoff_management_description = models.TextField(blank=True)

    # Wildlife
    wildlife_pressure = models.CharField(
        max_length=20,
        choices=WILDLIFE_PRESSURE_CHOICES,
        blank=True
    )
    wildlife_types_observed = models.TextField(blank=True)
    wildlife_exclusion_measures = models.TextField(blank=True)

    # Other water users
    other_water_users = models.TextField(
        blank=True,
        help_text="Description of other users of water system"
    )
    other_hazards = models.TextField(
        blank=True,
        help_text="Any other identified hazards"
    )

    # Historical contamination
    previous_contamination = models.BooleanField(default=False)
    contamination_details = models.TextField(blank=True)

    # Risk scoring
    environmental_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    adjacent_land_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    environmental_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    # Whether adjacent land hazards exist (triggers same-season mitigation)
    has_adjacent_land_hazards = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'FSMA Environmental Assessment'
        verbose_name_plural = 'FSMA Environmental Assessments'

    def __str__(self):
        return f"{self.assessment} - Environmental"


class FSMAMitigationAction(models.Model):
    """
    Tracks required mitigation measures if hazards are identified.
    """
    PRIORITY_CHOICES = [
        ('critical', 'Critical - Immediate Action Required'),
        ('high', 'High - Action Required Within 7 Days'),
        ('medium', 'Medium - Action Required Within 30 Days'),
        ('low', 'Low - Action Required Before Next Assessment'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('deferred', 'Deferred'),
        ('not_required', 'No Longer Required'),
    ]

    CATEGORY_CHOICES = [
        ('infrastructure', 'Infrastructure Repair/Improvement'),
        ('testing', 'Additional Testing'),
        ('treatment', 'Water Treatment'),
        ('exclusion', 'Animal/Wildlife Exclusion'),
        ('operational', 'Operational Change'),
        ('documentation', 'Documentation/Training'),
        ('other', 'Other'),
    ]

    HAZARD_SOURCE_CHOICES = [
        ('adjacent_animal', 'Adjacent Land - Animal Activity'),
        ('adjacent_manure', 'Adjacent Land - Manure/BSAAO'),
        ('adjacent_human_waste', 'Adjacent Land - Human Waste'),
        ('on_farm', 'On-Farm Hazard'),
        ('water_system', 'Water System Issue'),
        ('environmental', 'Environmental Condition'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='mitigation_actions'
    )

    # Related sub-assessment (optional)
    source_assessment = models.ForeignKey(
        FSMASourceAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mitigation_actions'
    )
    field_assessment = models.ForeignKey(
        FSMAFieldAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mitigation_actions'
    )
    environmental_assessment = models.ForeignKey(
        FSMAEnvironmentalAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mitigation_actions'
    )

    # Action details
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    hazard_source = models.CharField(
        max_length=30,
        choices=HAZARD_SOURCE_CHOICES,
        blank=True
    )
    title = models.CharField(max_length=200)
    hazard_description = models.TextField(
        blank=True,
        help_text="Description of the hazard being mitigated"
    )
    mitigation_description = models.TextField(
        help_text="Description of the mitigation action"
    )

    # Priority and timing
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    due_date = models.DateField()
    requires_same_season = models.BooleanField(
        default=False,
        help_text="True if hazard from adjacent land (requires same-season action)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    assigned_to = models.CharField(max_length=200, blank=True)

    # Completion
    completed_date = models.DateField(null=True, blank=True)
    completed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_water_mitigations'
    )
    completion_notes = models.TextField(blank=True)

    # Verification
    verification_required = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_water_mitigations'
    )
    verified_date = models.DateField(null=True, blank=True)

    # Evidence
    evidence_file = models.FileField(
        upload_to='mitigation_evidence/',
        null=True,
        blank=True
    )
    evidence_photo = models.ImageField(
        upload_to='mitigation_photos/',
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', 'due_date']
        verbose_name = 'FSMA Mitigation Action'
        verbose_name_plural = 'FSMA Mitigation Actions'
        indexes = [
            models.Index(fields=['status', 'due_date'], name='idx_mitigation_status_due'),
        ]

    def __str__(self):
        return f"{self.assessment} - {self.title}"

    @property
    def is_overdue(self):
        """Check if action is overdue."""
        from datetime import date
        if self.status in ['pending', 'in_progress']:
            return self.due_date < date.today()
        return False

