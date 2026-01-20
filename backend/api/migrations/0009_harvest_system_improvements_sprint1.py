# Generated migration for harvest system improvements - Sprint 1
# Adds:
# - Performance indexes for harvest queries
# - Multi-tenancy company scoping for Buyer and LaborContractor
# - Payment due date tracking for HarvestLoad

from django.db import migrations, models
import django.db.models.deletion


def assign_buyers_to_companies(apps, schema_editor):
    """
    Assign existing Buyer records to companies based on the harvests they're associated with.
    Strategy: For each buyer, find the most common company from their associated harvest loads.
    """
    Buyer = apps.get_model('api', 'Buyer')
    HarvestLoad = apps.get_model('api', 'HarvestLoad')
    Company = apps.get_model('api', 'Company')

    for buyer in Buyer.objects.filter(company__isnull=True):
        # Find loads associated with this buyer
        loads = HarvestLoad.objects.filter(buyer=buyer).select_related('harvest__field__farm')

        if loads.exists():
            # Get the most common company from associated harvests
            company_counts = {}
            for load in loads:
                try:
                    company = load.harvest.field.farm.company
                    if company:
                        company_counts[company.id] = company_counts.get(company.id, 0) + 1
                except AttributeError:
                    continue

            if company_counts:
                # Assign to the most common company
                most_common_company_id = max(company_counts, key=company_counts.get)
                buyer.company_id = most_common_company_id
                buyer.save()
        else:
            # No loads found - assign to the first company as a fallback
            first_company = Company.objects.first()
            if first_company:
                buyer.company_id = first_company.id
                buyer.save()


def assign_contractors_to_companies(apps, schema_editor):
    """
    Assign existing LaborContractor records to companies based on harvests they're associated with.
    Strategy: For each contractor, find the most common company from their associated harvest labor records.
    """
    LaborContractor = apps.get_model('api', 'LaborContractor')
    HarvestLabor = apps.get_model('api', 'HarvestLabor')
    Company = apps.get_model('api', 'Company')

    for contractor in LaborContractor.objects.filter(company__isnull=True):
        # Find labor records associated with this contractor
        labor_records = HarvestLabor.objects.filter(contractor=contractor).select_related('harvest__field__farm')

        if labor_records.exists():
            # Get the most common company from associated harvests
            company_counts = {}
            for labor in labor_records:
                try:
                    company = labor.harvest.field.farm.company
                    if company:
                        company_counts[company.id] = company_counts.get(company.id, 0) + 1
                except AttributeError:
                    continue

            if company_counts:
                # Assign to the most common company
                most_common_company_id = max(company_counts, key=company_counts.get)
                contractor.company_id = most_common_company_id
                contractor.save()
        else:
            # No labor records found - assign to the first company as a fallback
            first_company = Company.objects.first()
            if first_company:
                contractor.company_id = first_company.id
                contractor.save()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_fix_rls_current_setting'),
    ]

    operations = [
        # =====================================================================
        # MULTI-TENANCY: Add company field to Buyer
        # =====================================================================
        migrations.AddField(
            model_name='buyer',
            name='company',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='buyers',
                to='api.company',
                help_text='Company that owns this buyer record'
            ),
        ),

        # =====================================================================
        # MULTI-TENANCY: Add company field to LaborContractor
        # =====================================================================
        migrations.AddField(
            model_name='laborcontractor',
            name='company',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='labor_contractors',
                to='api.company',
                help_text='Company that owns this labor contractor record'
            ),
        ),

        # =====================================================================
        # PAYMENT TRACKING: Add payment_due_date to HarvestLoad
        # =====================================================================
        migrations.AddField(
            model_name='harvestload',
            name='payment_due_date',
            field=models.DateField(
                null=True,
                blank=True,
                help_text='Expected payment date based on buyer payment terms'
            ),
        ),

        # =====================================================================
        # PERFORMANCE: Add indexes for harvest-related queries
        # =====================================================================

        # Index on payment_status for filtering pending/paid loads
        migrations.AddIndex(
            model_name='harvestload',
            index=models.Index(
                fields=['payment_status'],
                name='idx_load_pay_status'
            ),
        ),

        # Index on crop_variety for filtering harvests by crop type
        migrations.AddIndex(
            model_name='harvest',
            index=models.Index(
                fields=['crop_variety'],
                name='idx_harv_crop_var'
            ),
        ),

        # Index on harvest_date for date-based queries and sorting
        migrations.AddIndex(
            model_name='harvest',
            index=models.Index(
                fields=['harvest_date'],
                name='idx_harv_date'
            ),
        ),

        # Index on contractor for filtering labor by contractor
        migrations.AddIndex(
            model_name='harvestlabor',
            index=models.Index(
                fields=['contractor'],
                name='idx_labor_contractor'
            ),
        ),

        # Composite index on field_id + harvest_date for common queries
        migrations.AddIndex(
            model_name='harvest',
            index=models.Index(
                fields=['field', 'harvest_date'],
                name='idx_harv_field_date'
            ),
        ),

        # Index on buyer for filtering loads by buyer
        migrations.AddIndex(
            model_name='harvestload',
            index=models.Index(
                fields=['buyer'],
                name='idx_load_buyer'
            ),
        ),

        # Index on company for Buyer (multi-tenancy queries)
        migrations.AddIndex(
            model_name='buyer',
            index=models.Index(
                fields=['company', 'active'],
                name='idx_buyer_co_active'
            ),
        ),

        # Index on company for LaborContractor (multi-tenancy queries)
        migrations.AddIndex(
            model_name='laborcontractor',
            index=models.Index(
                fields=['company', 'active'],
                name='idx_contr_co_active'
            ),
        ),

        # =====================================================================
        # ROW-LEVEL SECURITY: Add RLS policies for Buyer
        # =====================================================================
        migrations.RunSQL(
            sql="""
            -- Drop existing policy if it exists
            DROP POLICY IF EXISTS buyer_company_isolation ON api_buyer;

            -- Create RLS policy for Buyer
            CREATE POLICY buyer_company_isolation ON api_buyer
                USING (
                    company_id IS NULL OR
                    company_id = current_setting('app.current_company_id', TRUE)::INTEGER
                );

            -- Enable RLS on Buyer table
            ALTER TABLE api_buyer ENABLE ROW LEVEL SECURITY;
            """,
            reverse_sql="""
            -- Disable RLS on Buyer table
            ALTER TABLE api_buyer DISABLE ROW LEVEL SECURITY;

            -- Drop RLS policy
            DROP POLICY IF EXISTS buyer_company_isolation ON api_buyer;
            """
        ),

        # =====================================================================
        # ROW-LEVEL SECURITY: Add RLS policies for LaborContractor
        # =====================================================================
        migrations.RunSQL(
            sql="""
            -- Drop existing policy if it exists
            DROP POLICY IF EXISTS laborcontractor_company_isolation ON api_laborcontractor;

            -- Create RLS policy for LaborContractor
            CREATE POLICY laborcontractor_company_isolation ON api_laborcontractor
                USING (
                    company_id IS NULL OR
                    company_id = current_setting('app.current_company_id', TRUE)::INTEGER
                );

            -- Enable RLS on LaborContractor table
            ALTER TABLE api_laborcontractor ENABLE ROW LEVEL SECURITY;
            """,
            reverse_sql="""
            -- Disable RLS on LaborContractor table
            ALTER TABLE api_laborcontractor DISABLE ROW LEVEL SECURITY;

            -- Drop RLS policy
            DROP POLICY IF EXISTS laborcontractor_company_isolation ON api_laborcontractor;
            """
        ),

        # =====================================================================
        # DATA MIGRATION: Assign existing buyers to companies
        # =====================================================================
        migrations.RunPython(
            code=assign_buyers_to_companies,
            reverse_code=migrations.RunPython.noop,
        ),

        # =====================================================================
        # DATA MIGRATION: Assign existing labor contractors to companies
        # =====================================================================
        migrations.RunPython(
            code=assign_contractors_to_companies,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
