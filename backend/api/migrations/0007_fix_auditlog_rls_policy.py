"""
Fix RLS policy for api_auditlog to allow INSERT operations.

The problem: AuditLog entries are created during login (before the RLS 
context is fully set), so we need a more permissive INSERT policy.

Solution: Allow INSERT for any authenticated session, but restrict 
SELECT/UPDATE/DELETE to the current company only.
"""

from django.db import migrations


class Migration(migrations.Migration):
    
    dependencies = [
        ('api', '0006_add_row_level_security'),
    ]
    
    operations = [
        migrations.RunSQL(
            sql="""
                -- Drop the existing policy
                DROP POLICY IF EXISTS tenant_isolation ON api_auditlog;
                
                -- Create separate policies for different operations
                
                -- SELECT: Only see your company's logs
                CREATE POLICY auditlog_select ON api_auditlog
                    FOR SELECT
                    USING (
                        company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    );
                
                -- INSERT: Allow insert if company_id matches OR if no context set yet
                -- (This allows audit logs to be created during login)
                CREATE POLICY auditlog_insert ON api_auditlog
                    FOR INSERT
                    WITH CHECK (
                        current_setting('app.current_company_id', true) = '' 
                        OR current_setting('app.current_company_id', true) IS NULL
                        OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    );
                
                -- UPDATE: Only update your company's logs
                CREATE POLICY auditlog_update ON api_auditlog
                    FOR UPDATE
                    USING (
                        company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    );
                
                -- DELETE: Only delete your company's logs
                CREATE POLICY auditlog_delete ON api_auditlog
                    FOR DELETE
                    USING (
                        company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    );
            """,
            reverse_sql="""
                DROP POLICY IF EXISTS auditlog_select ON api_auditlog;
                DROP POLICY IF EXISTS auditlog_insert ON api_auditlog;
                DROP POLICY IF EXISTS auditlog_update ON api_auditlog;
                DROP POLICY IF EXISTS auditlog_delete ON api_auditlog;
                
                -- Restore original policy
                CREATE POLICY tenant_isolation ON api_auditlog
                    FOR ALL
                    USING (
                        company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    );
            """,
        ),
    ]
