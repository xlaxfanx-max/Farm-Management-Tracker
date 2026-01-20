"""
Fix RLS policy for satellite imagery tables and quarantine status to match the pattern used by other tables.

The issue is that the policy was using integer comparison but should use text comparison
like other tables, and also needs to allow inserts when the company_id matches.
"""

from django.db import migrations


def build_fix_rls_sql():
    """Generate SQL to fix RLS on satellite imagery and quarantine tables."""

    sql = """
        -- =================================================================
        -- SatelliteImage RLS - Fix to match other tables pattern
        -- =================================================================
        DROP POLICY IF EXISTS tenant_isolation ON api_satelliteimage;

        CREATE POLICY tenant_isolation ON api_satelliteimage
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR company_id::text = current_setting('app.current_company_id', true)
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR company_id::text = current_setting('app.current_company_id', true)
            );

        -- =================================================================
        -- TreeDetectionRun RLS - Fix to match other tables pattern
        -- =================================================================
        DROP POLICY IF EXISTS tenant_isolation ON api_treedetectionrun;

        CREATE POLICY tenant_isolation ON api_treedetectionrun
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR satellite_image_id IN (
                    SELECT id FROM api_satelliteimage
                    WHERE company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR satellite_image_id IN (
                    SELECT id FROM api_satelliteimage
                    WHERE company_id::text = current_setting('app.current_company_id', true)
                )
            );

        -- =================================================================
        -- DetectedTree RLS - Fix to match other tables pattern
        -- =================================================================
        DROP POLICY IF EXISTS tenant_isolation ON api_detectedtree;

        CREATE POLICY tenant_isolation ON api_detectedtree
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR field_id IN (
                    SELECT f.id FROM api_field f
                    JOIN api_farm fm ON f.farm_id = fm.id
                    WHERE fm.company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR field_id IN (
                    SELECT f.id FROM api_field f
                    JOIN api_farm fm ON f.farm_id = fm.id
                    WHERE fm.company_id::text = current_setting('app.current_company_id', true)
                )
            );

        -- =================================================================
        -- QuarantineStatus RLS - Fix to match other tables pattern
        -- =================================================================
        DROP POLICY IF EXISTS tenant_isolation ON api_quarantinestatus;

        CREATE POLICY tenant_isolation ON api_quarantinestatus
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR
                -- Check farm's company directly
                (farm_id IS NOT NULL AND farm_id IN (
                    SELECT id FROM api_farm
                    WHERE company_id::text = current_setting('app.current_company_id', true)
                ))
                OR
                -- Check field's farm's company
                (field_id IS NOT NULL AND field_id IN (
                    SELECT f.id FROM api_field f
                    JOIN api_farm fm ON f.farm_id = fm.id
                    WHERE fm.company_id::text = current_setting('app.current_company_id', true)
                ))
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR
                (farm_id IS NOT NULL AND farm_id IN (
                    SELECT id FROM api_farm
                    WHERE company_id::text = current_setting('app.current_company_id', true)
                ))
                OR
                (field_id IS NOT NULL AND field_id IN (
                    SELECT f.id FROM api_field f
                    JOIN api_farm fm ON f.farm_id = fm.id
                    WHERE fm.company_id::text = current_setting('app.current_company_id', true)
                ))
            );
    """
    return sql


def build_reverse_sql():
    """Reverse SQL - restore original policies."""
    sql = """
        -- Restore original policies (same as 0015)
        DROP POLICY IF EXISTS tenant_isolation ON api_satelliteimage;
        CREATE POLICY tenant_isolation ON api_satelliteimage
            FOR ALL
            USING (
                company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
            );

        DROP POLICY IF EXISTS tenant_isolation ON api_treedetectionrun;
        CREATE POLICY tenant_isolation ON api_treedetectionrun
            FOR ALL
            USING (
                satellite_image_id IN (
                    SELECT id FROM api_satelliteimage
                    WHERE company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                )
            );

        DROP POLICY IF EXISTS tenant_isolation ON api_detectedtree;
        CREATE POLICY tenant_isolation ON api_detectedtree
            FOR ALL
            USING (
                field_id IN (
                    SELECT f.id FROM api_field f
                    JOIN api_farm fm ON f.farm_id = fm.id
                    WHERE fm.company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                )
            );

        DROP POLICY IF EXISTS tenant_isolation ON api_quarantinestatus;
        CREATE POLICY tenant_isolation ON api_quarantinestatus
            FOR ALL
            USING (
                (farm_id IS NOT NULL AND farm_id IN (
                    SELECT id FROM api_farm
                    WHERE company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                ))
                OR
                (field_id IS NOT NULL AND field_id IN (
                    SELECT f.id FROM api_field f
                    JOIN api_farm fm ON f.farm_id = fm.id
                    WHERE fm.company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                ))
            );
    """
    return sql


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_satellite_imagery_tree_detection'),
    ]

    operations = [
        migrations.RunSQL(
            sql=build_fix_rls_sql(),
            reverse_sql=build_reverse_sql(),
        ),
    ]
