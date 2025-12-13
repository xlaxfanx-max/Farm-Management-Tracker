from django.db import models

class Farm(models.Model):
    """Farm/Ranch information"""
    name = models.CharField(max_length=200)
    farm_number = models.CharField(max_length=50, blank=True, help_text="Internal farm ID or permit number")
    
    # Owner/Operator information
    owner_name = models.CharField(max_length=200, blank=True)
    operator_name = models.CharField(max_length=200, blank=True)
    
    # Primary location
    address = models.TextField(blank=True)
    county = models.CharField(max_length=100)
    
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
    """Pesticide product catalog"""
    epa_registration_number = models.CharField(max_length=50, unique=True, db_index=True)
    product_name = models.CharField(max_length=200)
    manufacturer = models.CharField(max_length=200, blank=True)
    
    # Active ingredients
    active_ingredients = models.TextField()
    
    formulation_type = models.CharField(max_length=100, blank=True)
    restricted_use = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product_name']

    def __str__(self):
        return f"{self.product_name} ({self.epa_registration_number})"


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