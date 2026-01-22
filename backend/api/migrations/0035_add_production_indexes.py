"""
Add database indexes for production performance.

These indexes optimize common query patterns identified in the codebase:
- Foreign key lookups
- Date-based filtering
- Status filtering
- Multi-tenant (company) queries
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0034_fix_packinghouse_rls_policies'),
    ]

    operations = [
        # =========================================================================
        # PESTICIDE APPLICATION - Core feature, heavily queried
        # =========================================================================
        migrations.AddIndex(
            model_name='pesticideapplication',
            index=models.Index(
                fields=['field', '-application_date'],
                name='idx_app_field_date'
            ),
        ),
        migrations.AddIndex(
            model_name='pesticideapplication',
            index=models.Index(
                fields=['product'],
                name='idx_app_product'
            ),
        ),
        migrations.AddIndex(
            model_name='pesticideapplication',
            index=models.Index(
                fields=['status'],
                name='idx_app_status'
            ),
        ),

        # =========================================================================
        # FIELD - Core entity, frequently filtered
        # =========================================================================
        migrations.AddIndex(
            model_name='field',
            index=models.Index(
                fields=['farm', 'active'],
                name='idx_field_farm_active'
            ),
        ),
        migrations.AddIndex(
            model_name='field',
            index=models.Index(
                fields=['crop'],
                name='idx_field_crop'
            ),
        ),

        # =========================================================================
        # WATER SOURCE - Filtered by farm and type
        # =========================================================================
        migrations.AddIndex(
            model_name='watersource',
            index=models.Index(
                fields=['farm', 'source_type'],
                name='idx_ws_farm_type'
            ),
        ),
        migrations.AddIndex(
            model_name='watersource',
            index=models.Index(
                fields=['active'],
                name='idx_ws_active'
            ),
        ),

        # =========================================================================
        # WATER TEST - Time series queries
        # =========================================================================
        migrations.AddIndex(
            model_name='watertest',
            index=models.Index(
                fields=['water_source', '-test_date'],
                name='idx_wt_source_date'
            ),
        ),

        # =========================================================================
        # IRRIGATION - Zone and date filtering
        # =========================================================================
        migrations.AddIndex(
            model_name='irrigationrecommendation',
            index=models.Index(
                fields=['zone', 'status'],
                name='idx_rec_zone_status'
            ),
        ),
        migrations.AddIndex(
            model_name='irrigationrecommendation',
            index=models.Index(
                fields=['-recommended_date'],
                name='idx_rec_date'
            ),
        ),
        migrations.AddIndex(
            model_name='irrigationevent',
            index=models.Index(
                fields=['field', '-irrigation_date'],
                name='idx_ie_field_date'
            ),
        ),
        migrations.AddIndex(
            model_name='irrigationevent',
            index=models.Index(
                fields=['zone', '-irrigation_date'],
                name='idx_ie_zone_date'
            ),
        ),

        # =========================================================================
        # COMPANY MEMBERSHIP - Critical for auth/RLS lookups
        # =========================================================================
        migrations.AddIndex(
            model_name='companymembership',
            index=models.Index(
                fields=['user', 'is_active'],
                name='idx_member_user_active'
            ),
        ),
        migrations.AddIndex(
            model_name='companymembership',
            index=models.Index(
                fields=['company', 'is_active'],
                name='idx_member_co_active'
            ),
        ),

        # =========================================================================
        # FARM - Company filtering
        # =========================================================================
        migrations.AddIndex(
            model_name='farm',
            index=models.Index(
                fields=['company', 'active'],
                name='idx_farm_company_active'
            ),
        ),

        # =========================================================================
        # INVITATION - Token lookup and status filtering
        # =========================================================================
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(
                fields=['token'],
                name='idx_invite_token'
            ),
        ),
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(
                fields=['company', 'status'],
                name='idx_invite_co_status'
            ),
        ),

        # =========================================================================
        # EXTRACTION REPORT - Reporting period queries
        # =========================================================================
        migrations.AddIndex(
            model_name='extractionreport',
            index=models.Index(
                fields=['water_source', '-period_start_date'],
                name='idx_extract_ws_period'
            ),
        ),
        migrations.AddIndex(
            model_name='extractionreport',
            index=models.Index(
                fields=['status'],
                name='idx_extract_status'
            ),
        ),

        # =========================================================================
        # METER CALIBRATION - Due date tracking
        # =========================================================================
        migrations.AddIndex(
            model_name='metercalibration',
            index=models.Index(
                fields=['water_source', '-calibration_date'],
                name='idx_calib_ws_date'
            ),
        ),

        # =========================================================================
        # WATER ALLOCATION - Water year queries
        # =========================================================================
        migrations.AddIndex(
            model_name='waterallocation',
            index=models.Index(
                fields=['water_source', 'water_year'],
                name='idx_alloc_ws_year'
            ),
        ),
    ]
