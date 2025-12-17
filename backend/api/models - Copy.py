from django.db import models
from django.core.validators import MinValueValidator
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone
import uuid
from decimal import Decimal
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
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)
    
    # Business Details (for PUR reporting)
    operator_id = models.CharField(max_length=50, blank=True,
        help_text="California DPR Operator ID Number")
    business_license = models.CharField(max_length=50, blank=True)
    
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
    
    def can_add_farm(self):
        """Check if company can add another farm based on subscription."""
        return self.farm_count < self.max_farms
    
    def can_add_user(self):
        """Check if company can add another user based on subscription."""
        return self.user_count < self.max_users

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


class Farm(models.Model):
    """Farm/Ranch information"""
    name = models.CharField(max_length=200)
    farm_number = models.CharField(max_length=50, blank=True, help_text="Internal farm ID or permit number")
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='farms',
        null=True,  # Temporarily nullable for migration
        blank=True
    )

    # Owner/Operator information
    owner_name = models.CharField(max_length=200, blank=True)
    operator_name = models.CharField(max_length=200, blank=True)
    
    # Primary location
    address = models.TextField(blank=True)
    county = models.CharField(max_length=100)

    gps_lat = models.DecimalField(
        max_digits=10, 
        decimal_places=7, 
        null=True, 
        blank=True,
        verbose_name="Latitude",
        help_text="GPS latitude coordinate (e.g., 36.7378)"
    )
    gps_long = models.DecimalField(
        max_digits=10, 
        decimal_places=7, 
        null=True, 
        blank=True,
        verbose_name="Longitude", 
        help_text="GPS longitude coordinate (e.g., -119.7871)"
    )
    
    # Contact info
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
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

class Field(models.Model):
    """Farm field/block information"""
    name = models.CharField(max_length=200)
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='fields', null=True, blank=True)
    field_number = models.CharField(max_length=50)
    
    # Location data (required for PUR)
    county = models.CharField(max_length=100)
    section = models.CharField(max_length=50, blank=True)
    township = models.CharField(max_length=50, blank=True)
    range_value = models.CharField(max_length=50, blank=True)
    
    # GPS coordinates (optional)
    gps_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_long = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

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
    current_crop = models.CharField(max_length=100)
    planting_date = models.DateField(null=True, blank=True)
    
    # Status
    active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.field_number})"


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

class WaterSource(models.Model):
    """Water sources used on the farm"""
    
    SOURCE_TYPE_CHOICES = [
        ('well', 'Well'),
        ('municipal', 'Municipal/Public'),
        ('surface', 'Surface Water (pond, stream, etc.)'),
        ('other', 'Other'),
    ]
    
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='water_sources')
    name = models.CharField(max_length=200, help_text="e.g., 'Well #1', 'North Pond'")
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    
    # Location
    location_description = models.TextField(blank=True, help_text="Physical location or GPS coordinates")
    
    # Usage
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
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm', 'name']

    def __str__(self):
        return f"{self.farm.name} - {self.name}"
    
    def next_test_due(self):
        """Calculate next test due date based on most recent test"""
        latest_test = self.water_tests.filter(test_date__isnull=False).order_by('-test_date').first()
        if latest_test:
            from datetime import timedelta
            return latest_test.test_date + timedelta(days=self.test_frequency_days)
        return None
    
    def is_test_overdue(self):
        """Check if test is overdue"""
        next_due = self.next_test_due()
        if next_due:
            from django.utils import timezone
            return timezone.now().date() > next_due
        return True  # No tests = overdue


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
    
    def __str__(self):
        return f"{self.name} ({self.get_buyer_type_display()})"


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR MODEL
# -----------------------------------------------------------------------------

class LaborContractor(models.Model):
    """
    Represents a harvest labor contractor/crew company.
    """
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
# WELL MODEL
# -----------------------------------------------------------------------------

class Well(models.Model):
    """
    SGMA-specific well information. Links to WaterSource where source_type='well'.
    Tracks all data needed for GSA reporting and compliance.
    """
    
    # Link to parent WaterSource
    water_source = models.OneToOneField(
        'WaterSource',
        on_delete=models.CASCADE,
        related_name='well_details',
        limit_choices_to={'source_type': 'well'}
    )
    
    # === WELL IDENTIFICATION ===
    well_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Common name for the well"
    )
    state_well_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="California DWR State Well Number (e.g., 04N21W36H001S)"
    )
    local_well_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="County well permit number"
    )
    gsa_well_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="GSA-assigned well identifier"
    )
    
    # === GSA / BASIN INFORMATION ===
    gsa = models.CharField(
        max_length=20,
        choices=GSA_CHOICES,
        default='obgma',
        help_text="Groundwater Sustainability Agency managing this well"
    )
    gsa_account_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="Account number with the GSA for billing/reporting"
    )
    basin = models.CharField(
        max_length=30,
        choices=GROUNDWATER_BASIN_CHOICES,
        default='ojai_valley',
        help_text="DWR Bulletin 118 groundwater basin"
    )
    basin_priority = models.CharField(
        max_length=20,
        choices=BASIN_PRIORITY_CHOICES,
        default='medium',
        help_text="DWR basin priority classification"
    )
    
    # === WELL PHYSICAL CHARACTERISTICS ===
    well_depth_ft = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total well depth in feet"
    )
    casing_diameter_inches = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Well casing diameter in inches"
    )
    screen_interval_top_ft = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Top of perforated/screened interval (ft below ground)"
    )
    screen_interval_bottom_ft = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Bottom of perforated/screened interval (ft below ground)"
    )
    static_water_level_ft = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Static water level (ft below ground surface)"
    )
    static_level_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date static water level was measured"
    )
    aquifer_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name of aquifer (e.g., Upper Aquifer, San Pedro Formation)"
    )
    
    # === LOCATION ===
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
    township = models.CharField(max_length=10, blank=True)
    range_value = models.CharField(max_length=10, blank=True)
    section = models.CharField(max_length=10, blank=True)
    quarter_quarter = models.CharField(
        max_length=10,
        blank=True,
        help_text="Quarter-quarter section (e.g., NE/SW)"
    )
    parcel_apn = models.CharField(
        max_length=20,
        blank=True,
        help_text="Assessor's Parcel Number"
    )
    
    # === PUMP INFORMATION ===
    pump_type = models.CharField(
        max_length=20,
        choices=PUMP_TYPE_CHOICES,
        blank=True
    )
    pump_horsepower = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Pump motor horsepower"
    )
    pump_flow_rate_gpm = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Pump flow rate in gallons per minute (GPM)"
    )
    pump_efficiency = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Pump efficiency percentage"
    )
    pump_installation_date = models.DateField(null=True, blank=True)
    pump_manufacturer = models.CharField(max_length=100, blank=True)
    pump_model = models.CharField(max_length=100, blank=True)
    
    # === POWER SOURCE ===
    power_source = models.CharField(
        max_length=20,
        choices=POWER_SOURCE_CHOICES,
        blank=True
    )
    utility_meter_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="Electric utility meter number"
    )
    
    # === FLOWMETER INFORMATION ===
    has_flowmeter = models.BooleanField(
        default=True,
        help_text="Is a flowmeter installed on this well?"
    )
    flowmeter_make = models.CharField(max_length=100, blank=True)
    flowmeter_model = models.CharField(max_length=100, blank=True)
    flowmeter_serial_number = models.CharField(max_length=100, blank=True)
    flowmeter_size_inches = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Flowmeter pipe size in inches"
    )
    flowmeter_installation_date = models.DateField(null=True, blank=True)
    flowmeter_units = models.CharField(
        max_length=20,
        choices=FLOWMETER_UNIT_CHOICES,
        default='acre_feet'
    )
    flowmeter_multiplier = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=1.0,
        help_text="Multiplier to convert meter reading to actual units"
    )
    flowmeter_decimal_places = models.IntegerField(
        default=2,
        help_text="Number of decimal places on meter display"
    )
    
    # === ADVANCED METERING INFRASTRUCTURE (AMI) ===
    has_ami = models.BooleanField(
        default=False,
        help_text="Is the well equipped with AMI (automated meter reading)?"
    )
    ami_vendor = models.CharField(
        max_length=100,
        blank=True,
        help_text="AMI vendor (e.g., Ranch Systems)"
    )
    ami_device_id = models.CharField(max_length=100, blank=True)
    ami_installation_date = models.DateField(null=True, blank=True)
    
    # === WELL DATES & STATUS ===
    well_construction_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date well was drilled/constructed"
    )
    well_permit_date = models.DateField(null=True, blank=True)
    well_permit_number = models.CharField(max_length=50, blank=True)
    driller_name = models.CharField(max_length=100, blank=True)
    driller_license = models.CharField(max_length=50, blank=True)
    well_log_available = models.BooleanField(
        default=False,
        help_text="Is well completion report/log on file?"
    )
    well_log_file = models.FileField(
        upload_to='well_logs/',
        null=True,
        blank=True
    )
    
    status = models.CharField(
        max_length=20,
        choices=WELL_STATUS_CHOICES,
        default='active'
    )
    
    # === DE MINIMIS EXEMPTION ===
    is_de_minimis = models.BooleanField(
        default=False,
        help_text="Domestic well extracting < 2 AF/year (exempt from most SGMA reporting)"
    )
    
    # === COMPLIANCE TRACKING ===
    registered_with_gsa = models.BooleanField(default=False)
    gsa_registration_date = models.DateField(null=True, blank=True)
    meter_calibration_current = models.BooleanField(default=False)
    next_calibration_due = models.DateField(null=True, blank=True)
    
    # === NOTES ===
    notes = models.TextField(blank=True)
    
    # === TIMESTAMPS ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Wells"
        ordering = ['water_source__farm__name', 'well_name']
    
    def __str__(self):
        name = self.well_name or self.water_source.name
        return f"{name} ({self.get_gsa_display()})"
    
    def get_latest_reading(self):
        """Get the most recent meter reading."""
        return self.readings.order_by('-reading_date', '-reading_time').first()
    
    def get_ytd_extraction_af(self):
        """Get year-to-date extraction in acre-feet for current water year."""
        from django.db.models import Sum
        from datetime import date
        
        today = date.today()
        # Water year starts October 1
        if today.month >= 10:
            wy_start = date(today.year, 10, 1)
        else:
            wy_start = date(today.year - 1, 10, 1)
        
        total = self.readings.filter(
            reading_date__gte=wy_start
        ).aggregate(Sum('extraction_acre_feet'))['extraction_acre_feet__sum']
        
        return total or Decimal('0')
    
    def get_allocation_for_year(self, water_year=None):
        """Get total allocation for a water year."""
        from django.db.models import Sum
        
        if not water_year:
            from datetime import date
            today = date.today()
            if today.month >= 10:
                water_year = f"{today.year}-{today.year + 1}"
            else:
                water_year = f"{today.year - 1}-{today.year}"
        
        total = self.allocations.filter(
            water_year=water_year
        ).exclude(
            allocation_type='transferred_out'
        ).aggregate(Sum('allocated_acre_feet'))['allocated_acre_feet__sum']
        
        return total or Decimal('0')
    
    def is_calibration_due(self, days_warning=30):
        """Check if calibration is due or coming due soon."""
        if not self.next_calibration_due:
            return True
        from datetime import date, timedelta
        warning_date = date.today() + timedelta(days=days_warning)
        return self.next_calibration_due <= warning_date


# -----------------------------------------------------------------------------
# WELL READING MODEL
# -----------------------------------------------------------------------------

class WellReading(models.Model):
    """
    Individual meter readings for tracking groundwater extraction.
    Used to calculate total extraction for reporting periods.
    """
    
    well = models.ForeignKey(
        'Well',
        on_delete=models.CASCADE,
        related_name='readings'
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
    
    # === METADATA ===
    recorded_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-reading_date', '-reading_time']
        indexes = [
            models.Index(fields=['well', '-reading_date']),
        ]
    
    def __str__(self):
        return f"{self.well} - {self.reading_date}: {self.meter_reading}"
    
    def save(self, *args, **kwargs):
        """Auto-calculate extraction on save."""
        # Get previous reading if not set
        if self.previous_reading is None:
            prev = WellReading.objects.filter(
                well=self.well,
                reading_date__lt=self.reading_date
            ).order_by('-reading_date', '-reading_time').first()
            
            if prev:
                self.previous_reading = prev.meter_reading
                self.previous_reading_date = prev.reading_date
        
        # Calculate extraction
        if self.previous_reading is not None and self.meter_reading is not None:
            multiplier = self.well.flowmeter_multiplier or Decimal('1.0')
            raw_extraction = (self.meter_reading - self.previous_reading) * multiplier
            self.extraction_native_units = raw_extraction
            
            # Convert to acre-feet
            self.extraction_acre_feet = self._convert_to_acre_feet(raw_extraction)
            # Convert to gallons (1 AF = 325,851 gallons)
            if self.extraction_acre_feet:
                self.extraction_gallons = self.extraction_acre_feet * Decimal('325851')
        
        super().save(*args, **kwargs)
    
    def _convert_to_acre_feet(self, value):
        """Convert native units to acre-feet."""
        unit = self.well.flowmeter_units
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
    """
    
    well = models.ForeignKey(
        'Well',
        on_delete=models.CASCADE,
        related_name='calibrations'
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
        return f"{self.well} - {self.calibration_date} - {status}"
    
    def save(self, *args, **kwargs):
        """Update well's calibration status on save."""
        super().save(*args, **kwargs)
        
        # Update well's calibration status
        if self.passed:
            self.well.meter_calibration_current = True
            self.well.next_calibration_due = self.next_calibration_due
            
            # Update meter info if replaced
            if self.meter_replaced and self.new_meter_serial:
                self.well.flowmeter_serial_number = self.new_meter_serial
                if self.new_meter_make:
                    self.well.flowmeter_make = self.new_meter_make
                if self.new_meter_model:
                    self.well.flowmeter_model = self.new_meter_model
            
            self.well.save()


# -----------------------------------------------------------------------------
# WATER ALLOCATION MODEL
# -----------------------------------------------------------------------------

class WaterAllocation(models.Model):
    """
    Water extraction allocations assigned by GSA.
    Tracks annual/seasonal limits and allocation sources.
    """
    
    well = models.ForeignKey(
        'Well',
        on_delete=models.CASCADE,
        related_name='allocations'
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
        ordering = ['-water_year', 'well']
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
    """
    
    well = models.ForeignKey(
        'Well',
        on_delete=models.CASCADE,
        related_name='extraction_reports'
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
        ordering = ['-period_start_date', 'well']
        unique_together = ['well', 'reporting_period']
        verbose_name = "Extraction Report"
        verbose_name_plural = "Extraction Reports"
    
    def __str__(self):
        return f"{self.well} - {self.reporting_period}: {self.total_extraction_af} AF"
    
    def calculate_extraction(self):
        """Calculate extraction from meter readings."""
        if self.beginning_meter_reading and self.ending_meter_reading:
            multiplier = self.well.flowmeter_multiplier or Decimal('1.0')
            raw = (self.ending_meter_reading - self.beginning_meter_reading) * multiplier
            self.total_extraction_native = raw
            
            # Convert based on meter units
            unit = self.well.flowmeter_units
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
    """
    
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='irrigation_events'
    )
    well = models.ForeignKey(
        'Well',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='irrigation_events'
    )
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='irrigation_events',
        help_text="Use if source is not a well (e.g., surface water)"
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
        return f"{self.field} - {self.irrigation_date}: {self.water_applied_af or 0} AF"
    
    def save(self, *args, **kwargs):
        """Auto-calculate duration and water conversions."""
        # Calculate duration from times
        if self.start_time and self.end_time and not self.duration_hours:
            from datetime import datetime, timedelta
            start = datetime.combine(self.irrigation_date, self.start_time)
            end = datetime.combine(self.irrigation_date, self.end_time)
            if end < start:  # Crossed midnight
                end += timedelta(days=1)
            delta = end - start
            self.duration_hours = Decimal(str(round(delta.total_seconds() / 3600, 2)))
        
        # Calculate water applied from flow rate and duration
        if self.well and self.duration_hours and not self.water_applied_af:
            if self.well.pump_flow_rate_gpm:
                gallons = self.well.pump_flow_rate_gpm * self.duration_hours * 60
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


