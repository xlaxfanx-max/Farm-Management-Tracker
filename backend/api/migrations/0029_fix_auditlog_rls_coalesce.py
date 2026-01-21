# Fix auditlog RLS policies to use COALESCE pattern
# This matches the pattern used in migration 0008 for other tables

from django.db import migrations


class Migration(migrations.Migration):
    """
    Fix the api_auditlog RLS policies to handle NULL values properly.

    The issue: Migration 0007 used `current_setting(..., true) = ''` but when
    the setting doesn't exist, current_setting returns NULL, not ''.
    NULL = '' evaluates to NULL (not TRUE), causing policy check to fail.

    This migration updates the auditlog policies to use the same COALESCE
    pattern as other tables in migration 0008.
    """

    dependencies = [
        ('api', '0028_quarantine_zone'),
    ]

    operations = [
        # Drop existing auditlog policies
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS auditlog_select ON api_auditlog;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS auditlog_insert ON api_auditlog;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS auditlog_update ON api_auditlog;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS auditlog_delete ON api_auditlog;",
            reverse_sql="SELECT 1;"
        ),

        # Recreate with COALESCE pattern (matching migration 0008 style)

        # SELECT: Only see your company's logs, or all logs if no context set
        migrations.RunSQL(
            sql="""
                CREATE POLICY auditlog_select ON api_auditlog
                    FOR SELECT
                    USING (
                        COALESCE(current_setting('app.current_company_id', true), '') = ''
                        OR company_id::text = current_setting('app.current_company_id', true)
                    );
            """,
            reverse_sql="DROP POLICY IF EXISTS auditlog_select ON api_auditlog;"
        ),

        # INSERT: Allow insert when no context set (for registration/login)
        # or when company_id matches current context
        migrations.RunSQL(
            sql="""
                CREATE POLICY auditlog_insert ON api_auditlog
                    FOR INSERT
                    WITH CHECK (
                        COALESCE(current_setting('app.current_company_id', true), '') = ''
                        OR company_id::text = current_setting('app.current_company_id', true)
                    );
            """,
            reverse_sql="DROP POLICY IF EXISTS auditlog_insert ON api_auditlog;"
        ),

        # UPDATE: Only update your company's logs
        migrations.RunSQL(
            sql="""
                CREATE POLICY auditlog_update ON api_auditlog
                    FOR UPDATE
                    USING (
                        COALESCE(current_setting('app.current_company_id', true), '') = ''
                        OR company_id::text = current_setting('app.current_company_id', true)
                    );
            """,
            reverse_sql="DROP POLICY IF EXISTS auditlog_update ON api_auditlog;"
        ),

        # DELETE: Only delete your company's logs
        migrations.RunSQL(
            sql="""
                CREATE POLICY auditlog_delete ON api_auditlog
                    FOR DELETE
                    USING (
                        COALESCE(current_setting('app.current_company_id', true), '') = ''
                        OR company_id::text = current_setting('app.current_company_id', true)
                    );
            """,
            reverse_sql="DROP POLICY IF EXISTS auditlog_delete ON api_auditlog;"
        ),
    ]
