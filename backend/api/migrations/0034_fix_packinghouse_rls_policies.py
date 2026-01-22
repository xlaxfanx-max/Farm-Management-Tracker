# Generated migration to fix Packinghouse RLS policies
# The original migration 0030 was missing WITH CHECK clauses for INSERT operations

from django.db import migrations


class Migration(migrations.Migration):
    """
    Fix RLS policies for packinghouse tables to include WITH CHECK clause
    for INSERT operations and use COALESCE pattern for superuser access.
    """

    dependencies = [
        ('api', '0033_alter_auditlog_action'),
    ]

    operations = [
        # =====================================================================
        # DROP EXISTING POLICIES
        # =====================================================================
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_packinghouse;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_pool;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_packinghousedelivery;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_packoutreport;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_packoutgradeline;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_poolsettlement;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_settlementgradeline;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_settlementdeduction;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_growerledgerentry;",
            reverse_sql="SELECT 1;"
        ),
        migrations.RunSQL(
            sql="DROP POLICY IF EXISTS tenant_isolation ON api_packinghousestatement;",
            reverse_sql="SELECT 1;"
        ),

        # =====================================================================
        # RECREATE POLICIES WITH WITH CHECK CLAUSE
        # =====================================================================

        # ----- api_packinghouse (direct company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_packinghouse
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
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_packinghouse;"
        ),

        # ----- api_pool (via packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_pool
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packinghouse_id IN (
                        SELECT id FROM api_packinghouse
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packinghouse_id IN (
                        SELECT id FROM api_packinghouse
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_pool;"
        ),

        # ----- api_packinghousedelivery (via pool.packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_packinghousedelivery
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR pool_id IN (
                        SELECT p.id FROM api_pool p
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR pool_id IN (
                        SELECT p.id FROM api_pool p
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_packinghousedelivery;"
        ),

        # ----- api_packoutreport (via pool.packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_packoutreport
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR pool_id IN (
                        SELECT p.id FROM api_pool p
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR pool_id IN (
                        SELECT p.id FROM api_pool p
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_packoutreport;"
        ),

        # ----- api_packoutgradeline (via packout_report.pool.packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_packoutgradeline
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packout_report_id IN (
                        SELECT pr.id FROM api_packoutreport pr
                        JOIN api_pool p ON pr.pool_id = p.id
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packout_report_id IN (
                        SELECT pr.id FROM api_packoutreport pr
                        JOIN api_pool p ON pr.pool_id = p.id
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_packoutgradeline;"
        ),

        # ----- api_poolsettlement (via pool.packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_poolsettlement
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR pool_id IN (
                        SELECT p.id FROM api_pool p
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR pool_id IN (
                        SELECT p.id FROM api_pool p
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_poolsettlement;"
        ),

        # ----- api_settlementgradeline (via settlement.pool.packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_settlementgradeline
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR settlement_id IN (
                        SELECT s.id FROM api_poolsettlement s
                        JOIN api_pool p ON s.pool_id = p.id
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR settlement_id IN (
                        SELECT s.id FROM api_poolsettlement s
                        JOIN api_pool p ON s.pool_id = p.id
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_settlementgradeline;"
        ),

        # ----- api_settlementdeduction (via settlement.pool.packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_settlementdeduction
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR settlement_id IN (
                        SELECT s.id FROM api_poolsettlement s
                        JOIN api_pool p ON s.pool_id = p.id
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR settlement_id IN (
                        SELECT s.id FROM api_poolsettlement s
                        JOIN api_pool p ON s.pool_id = p.id
                        JOIN api_packinghouse ph ON p.packinghouse_id = ph.id
                        WHERE ph.company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_settlementdeduction;"
        ),

        # ----- api_growerledgerentry (via packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_growerledgerentry
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packinghouse_id IN (
                        SELECT id FROM api_packinghouse
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packinghouse_id IN (
                        SELECT id FROM api_packinghouse
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_growerledgerentry;"
        ),

        # ----- api_packinghousestatement (via packinghouse.company_id) -----
        migrations.RunSQL(
            sql="""
                CREATE POLICY tenant_isolation ON api_packinghousestatement
                FOR ALL
                USING (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packinghouse_id IN (
                        SELECT id FROM api_packinghouse
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                )
                WITH CHECK (
                    COALESCE(current_setting('app.current_company_id', true), '') = ''
                    OR packinghouse_id IN (
                        SELECT id FROM api_packinghouse
                        WHERE company_id::text = current_setting('app.current_company_id', true)
                    )
                );
            """,
            reverse_sql="DROP POLICY IF EXISTS tenant_isolation ON api_packinghousestatement;"
        ),
    ]
