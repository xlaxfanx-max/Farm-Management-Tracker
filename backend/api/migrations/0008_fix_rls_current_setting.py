# Generated migration to fix RLS policies
# Run this after 0007_fix_auditlog_rls_policy.py
# File: backend/api/migrations/0008_fix_rls_current_setting.py

from django.db import migrations


class Migration(migrations.Migration):
    """
    Fix RLS policies to use current_setting() with the 'missing_ok' parameter.
    
    The issue was that current_setting('app.current_company_id') throws an error
    if the parameter doesn't exist. Using current_setting('app.current_company_id', true)
    returns NULL instead of throwing an error.
    
    Also updates policies to allow access when no company context is set (for superusers
    or when RLS should be bypassed).
    """

    dependencies = [
        ('api', '0007_fix_auditlog_rls_policy'),  # Adjust this to your last migration
    ]

    operations = [
        # =====================================================================
        # DROP ALL EXISTING POLICIES
        # =====================================================================
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS farm_isolation_policy ON api_farm;",
            reverse_sql="SELECT 1;"  # No-op for reverse
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS farm_insert_policy ON api_farm;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS field_isolation_policy ON api_field;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS watersource_isolation_policy ON api_watersource;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS application_isolation_policy ON api_pesticideapplication;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS harvest_isolation_policy ON api_harvest;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS harvestload_isolation_policy ON api_harvestload;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS harvestlabor_isolation_policy ON api_harvestlabor;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS watertest_isolation_policy ON api_watertest;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS wellreading_isolation_policy ON api_wellreading;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS metercalibration_isolation_policy ON api_metercalibration;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS waterallocation_isolation_policy ON api_waterallocation;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS extractionreport_isolation_policy ON api_extractionreport;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS irrigationevent_isolation_policy ON api_irrigationevent;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS nutrientapplication_isolation_policy ON api_nutrientapplication;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS nutrientplan_isolation_policy ON api_nutrientplan;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS fertilizerproduct_isolation_policy ON api_fertilizerproduct;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS farmparcel_isolation_policy ON api_farmparcel;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS invitation_isolation_policy ON api_invitation;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS companymembership_isolation_policy ON api_companymembership;",
            reverse_sql="SELECT 1;"
        ),
        
        # =====================================================================
        # RECREATE POLICIES WITH FIXED current_setting() CALL
        # Using current_setting(name, missing_ok) where missing_ok=true returns NULL
        # instead of throwing an error when the setting doesn't exist.
        # =====================================================================
        
        # ----- api_farm (direct company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY farm_isolation_policy ON api_farm
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = '' 
                    OR company_id::text = current_setting('app.current_company_id', true)
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = '' 
                    OR company_id::text = current_setting('app.current_company_id', true)
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS farm_isolation_policy ON api_farm;"
        ),
        
        # ----- api_field (via farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY field_isolation_policy ON api_field
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR farm_id IN (
                        SELECT id FROM api_farm 
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS field_isolation_policy ON api_field;"
        ),
        
        # ----- api_farmparcel (via farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY farmparcel_isolation_policy ON api_farmparcel
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR farm_id IN (
                        SELECT id FROM api_farm 
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS farmparcel_isolation_policy ON api_farmparcel;"
        ),
        
        # ----- api_watersource (via farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY watersource_isolation_policy ON api_watersource
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR farm_id IN (
                        SELECT id FROM api_farm 
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS watersource_isolation_policy ON api_watersource;"
        ),
        
        # ----- api_pesticideapplication (via field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY application_isolation_policy ON api_pesticideapplication
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR field_id IN (
                        SELECT f.id FROM api_field f
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS application_isolation_policy ON api_pesticideapplication;"
        ),
        
        # ----- api_harvest (via field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY harvest_isolation_policy ON api_harvest
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR field_id IN (
                        SELECT f.id FROM api_field f
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS harvest_isolation_policy ON api_harvest;"
        ),
        
        # ----- api_harvestload (via harvest->field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY harvestload_isolation_policy ON api_harvestload
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR harvest_id IN (
                        SELECT h.id FROM api_harvest h
                        JOIN api_field f ON h.field_id = f.id
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS harvestload_isolation_policy ON api_harvestload;"
        ),
        
        # ----- api_harvestlabor (via harvest->field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY harvestlabor_isolation_policy ON api_harvestlabor
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR harvest_id IN (
                        SELECT h.id FROM api_harvest h
                        JOIN api_field f ON h.field_id = f.id
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS harvestlabor_isolation_policy ON api_harvestlabor;"
        ),
        
        # ----- api_watertest (via water_source->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY watertest_isolation_policy ON api_watertest
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR water_source_id IN (
                        SELECT ws.id FROM api_watersource ws
                        JOIN api_farm fa ON ws.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS watertest_isolation_policy ON api_watertest;"
        ),
        
        # ----- api_wellreading (via water_source->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY wellreading_isolation_policy ON api_wellreading
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR water_source_id IN (
                        SELECT ws.id FROM api_watersource ws
                        JOIN api_farm fa ON ws.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS wellreading_isolation_policy ON api_wellreading;"
        ),
        
        # ----- api_metercalibration (via water_source->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY metercalibration_isolation_policy ON api_metercalibration
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR water_source_id IN (
                        SELECT ws.id FROM api_watersource ws
                        JOIN api_farm fa ON ws.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS metercalibration_isolation_policy ON api_metercalibration;"
        ),
        
        # ----- api_waterallocation (via water_source->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY waterallocation_isolation_policy ON api_waterallocation
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR water_source_id IN (
                        SELECT ws.id FROM api_watersource ws
                        JOIN api_farm fa ON ws.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS waterallocation_isolation_policy ON api_waterallocation;"
        ),
        
        # ----- api_extractionreport (via water_source->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY extractionreport_isolation_policy ON api_extractionreport
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR water_source_id IN (
                        SELECT ws.id FROM api_watersource ws
                        JOIN api_farm fa ON ws.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS extractionreport_isolation_policy ON api_extractionreport;"
        ),
        
        # ----- api_irrigationevent (via field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY irrigationevent_isolation_policy ON api_irrigationevent
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR field_id IN (
                        SELECT f.id FROM api_field f
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS irrigationevent_isolation_policy ON api_irrigationevent;"
        ),
        
        # ----- api_nutrientapplication (via field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY nutrientapplication_isolation_policy ON api_nutrientapplication
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR field_id IN (
                        SELECT f.id FROM api_field f
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS nutrientapplication_isolation_policy ON api_nutrientapplication;"
        ),
        
        # ----- api_nutrientplan (via field->farm) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY nutrientplan_isolation_policy ON api_nutrientplan
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR field_id IN (
                        SELECT f.id FROM api_field f
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE fa.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS nutrientplan_isolation_policy ON api_nutrientplan;"
        ),
        
        # ----- api_fertilizerproduct (direct company_id, but can be NULL for global) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY fertilizerproduct_isolation_policy ON api_fertilizerproduct
                FOR ALL
                USING (
                    company_id IS NULL  -- Global products visible to all
                    OR COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR company_id::text = current_setting('app.current_company_id', true)
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS fertilizerproduct_isolation_policy ON api_fertilizerproduct;"
        ),
        
        # ----- api_invitation (direct company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY invitation_isolation_policy ON api_invitation
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR company_id::text = current_setting('app.current_company_id', true)
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS invitation_isolation_policy ON api_invitation;"
        ),
        
        # ----- api_companymembership (direct company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY companymembership_isolation_policy ON api_companymembership
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR company_id::text = current_setting('app.current_company_id', true)
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS companymembership_isolation_policy ON api_companymembership;"
        ),
    ]
