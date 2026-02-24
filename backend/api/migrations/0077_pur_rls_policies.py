"""
Add Row-Level Security (RLS) policies for new PUR models:
- Product (direct company_id, nullable = global/shared)
- Applicator (direct company_id, nullable)
- ApplicationEvent (direct company_id)
- TankMixItem (via application_event -> company_id)
"""

from django.db import migrations


def add_rls_policies(apps, schema_editor):
    """Create RLS policies for new PUR tables."""
    if schema_editor.connection.vendor != 'postgresql':
        return

    sql_statements = []

    # Product — nullable company_id (null = global/shared, non-null = company-specific)
    sql_statements.append("""
        ALTER TABLE api_product ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_product;

        CREATE POLICY tenant_isolation ON api_product
            FOR ALL
            USING (
                company_id IS NULL
                OR company_id::text = current_setting('app.current_company_id', true)
            )
            WITH CHECK (
                company_id IS NULL
                OR company_id::text = current_setting('app.current_company_id', true)
            );
    """)

    # Applicator — nullable company_id
    sql_statements.append("""
        ALTER TABLE api_applicator ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_applicator;

        CREATE POLICY tenant_isolation ON api_applicator
            FOR ALL
            USING (
                company_id IS NULL
                OR company_id::text = current_setting('app.current_company_id', true)
            )
            WITH CHECK (
                company_id IS NULL
                OR company_id::text = current_setting('app.current_company_id', true)
            );
    """)

    # ApplicationEvent — direct company_id
    sql_statements.append("""
        ALTER TABLE api_applicationevent ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_applicationevent;

        CREATE POLICY tenant_isolation ON api_applicationevent
            FOR ALL
            USING (
                company_id::text = current_setting('app.current_company_id', true)
            )
            WITH CHECK (
                company_id::text = current_setting('app.current_company_id', true)
            );
    """)

    # TankMixItem — via application_event.company_id
    sql_statements.append("""
        ALTER TABLE api_tankmixitem ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_tankmixitem;

        CREATE POLICY tenant_isolation ON api_tankmixitem
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM api_applicationevent ae
                    WHERE ae.id = application_event_id
                    AND ae.company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM api_applicationevent ae
                    WHERE ae.id = application_event_id
                    AND ae.company_id::text = current_setting('app.current_company_id', true)
                )
            );
    """)

    with schema_editor.connection.cursor() as cursor:
        for sql in sql_statements:
            cursor.execute(sql)


def remove_rls_policies(apps, schema_editor):
    """Remove RLS policies for PUR tables."""
    if schema_editor.connection.vendor != 'postgresql':
        return

    tables = ['api_product', 'api_applicator', 'api_applicationevent', 'api_tankmixitem']
    with schema_editor.connection.cursor() as cursor:
        for table in tables:
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
            cursor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0076_applicationevent_product_crop_dpr_commodity_code_and_more'),
    ]

    operations = [
        migrations.RunPython(add_rls_policies, remove_rls_policies),
    ]
