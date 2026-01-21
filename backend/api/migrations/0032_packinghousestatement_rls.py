# Generated migration for PackinghouseStatement RLS policy
# Ensures row-level security for multi-tenant data isolation

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0031_packinghouse_statement_upload'),
    ]

    operations = [
        # Add RLS policy for PackinghouseStatement
        # RLS chain: PackinghouseStatement -> packinghouse.company_id
        migrations.RunSQL(
            sql="""
                ALTER TABLE api_packinghousestatement ENABLE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS tenant_isolation ON api_packinghousestatement;

                CREATE POLICY tenant_isolation ON api_packinghousestatement
                    FOR ALL
                    USING (
                        packinghouse_id IN (
                            SELECT id FROM api_packinghouse
                            WHERE company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                        )
                    );

                ALTER TABLE api_packinghousestatement FORCE ROW LEVEL SECURITY;
            """,
            reverse_sql="""
                ALTER TABLE api_packinghousestatement DISABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation ON api_packinghousestatement;
            """
        ),
    ]
