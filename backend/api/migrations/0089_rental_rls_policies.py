"""
Add Row-Level Security (RLS) policies for the rental models:
- RentalProperty     (direct company_id)
- RentalCategory     (direct company_id)
- RentalLedgerEntry  (direct company_id)
- RentalUnit         (via rental_property -> company_id)
- Lease              (via unit -> rental_property -> company_id)

Structure copied from 0077_pur_rls_policies.py, including the postgresql vendor
guard. A green SQLite test suite proves nothing about production RLS — these
policies must be verified with psql after deploy.
"""

from django.db import migrations


def add_rls_policies(apps, schema_editor):
    """Create RLS policies for rental tables."""
    if schema_editor.connection.vendor != 'postgresql':
        return

    sql_statements = []

    # Direct company_id tables — a rental row always belongs to exactly one
    # company. Unlike Product/Applicator there is no shared/global case here,
    # so no NULL escape hatch.
    for table in ('api_rentalproperty', 'api_rentalcategory', 'api_rentalledgerentry'):
        sql_statements.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS tenant_isolation ON {table};

            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    company_id::text = current_setting('app.current_company_id', true)
                )
                WITH CHECK (
                    company_id::text = current_setting('app.current_company_id', true)
                );
        """)

    # RentalUnit — via rental_property.company_id
    sql_statements.append("""
        ALTER TABLE api_rentalunit ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_rentalunit;

        CREATE POLICY tenant_isolation ON api_rentalunit
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM api_rentalproperty rp
                    WHERE rp.id = rental_property_id
                    AND rp.company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM api_rentalproperty rp
                    WHERE rp.id = rental_property_id
                    AND rp.company_id::text = current_setting('app.current_company_id', true)
                )
            );
    """)

    # Lease — via unit -> rental_property.company_id. Two hops because rent
    # lives on the lease and a leaked lease row would leak a rent figure.
    sql_statements.append("""
        ALTER TABLE api_lease ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_lease;

        CREATE POLICY tenant_isolation ON api_lease
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM api_rentalunit ru
                    JOIN api_rentalproperty rp ON rp.id = ru.rental_property_id
                    WHERE ru.id = unit_id
                    AND rp.company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM api_rentalunit ru
                    JOIN api_rentalproperty rp ON rp.id = ru.rental_property_id
                    WHERE ru.id = unit_id
                    AND rp.company_id::text = current_setting('app.current_company_id', true)
                )
            );
    """)

    with schema_editor.connection.cursor() as cursor:
        for sql in sql_statements:
            cursor.execute(sql)


def remove_rls_policies(apps, schema_editor):
    """Remove RLS policies for rental tables."""
    if schema_editor.connection.vendor != 'postgresql':
        return

    tables = [
        'api_rentalproperty',
        'api_rentalcategory',
        'api_rentalledgerentry',
        'api_rentalunit',
        'api_lease',
    ]
    with schema_editor.connection.cursor() as cursor:
        for table in tables:
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
            cursor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0088_rental'),
    ]

    operations = [
        migrations.RunPython(add_rls_policies, remove_rls_policies),
    ]
