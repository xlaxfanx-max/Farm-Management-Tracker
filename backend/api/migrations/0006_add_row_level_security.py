"""
Migration to add Row-Level Security (RLS) policies for multi-tenant isolation.

This ensures that even if application code forgets a company filter,
the database itself will only return rows for the current tenant.

How it works:
1. Each request sets a session variable: app.current_company_id
2. RLS policies check this variable against each row's company ownership
3. Rows not belonging to the current company are invisible

NOTE: Some tables (Buyer, LaborContractor, PesticideProduct) don't have 
company FKs in the current model - they're shared/global. Consider adding
company FKs to these tables in a future migration for full tenant isolation.
"""

from django.db import migrations

# Tables with direct company_id foreign key
DIRECT_COMPANY_TABLES = [
    'api_farm',
    'api_invitation',
    'api_auditlog',
]

# FertilizerProduct has nullable company_id - needs special handling
# (null = global/shared, non-null = company-specific)

# Tables nested under Farm (farm_id -> farm.company_id)
NESTED_UNDER_FARM = [
    ('api_farmparcel', 'farm_id'),
    ('api_field', 'farm_id'),
    ('api_watersource', 'farm_id'),
]

# Tables nested under Field (field_id -> field.farm_id -> farm.company_id)
NESTED_UNDER_FIELD = [
    ('api_pesticideapplication', 'field_id'),
    ('api_nutrientapplication', 'field_id'),
    ('api_nutrientplan', 'field_id'),
    ('api_harvest', 'field_id'),
    ('api_irrigationevent', 'field_id'),
]

# Tables nested under Harvest (harvest_id -> harvest.field_id -> ...)
NESTED_UNDER_HARVEST = [
    ('api_harvestload', 'harvest_id'),
    ('api_harvestlabor', 'harvest_id'),
]

# Tables nested under WaterSource (water_source_id -> watersource.farm_id -> ...)
NESTED_UNDER_WATERSOURCE = [
    ('api_watertest', 'water_source_id'),
    ('api_wellreading', 'water_source_id'),
    ('api_metercalibration', 'water_source_id'),
    ('api_waterallocation', 'water_source_id'),
    ('api_extractionreport', 'water_source_id'),
]

# NOTE: These tables do NOT have company isolation currently:
# - api_buyer (no company FK - shared across all tenants)
# - api_laborcontractor (no company FK - shared across all tenants)
# - api_pesticideproduct (no company FK - shared reference data)
# Consider adding company FKs to Buyer and LaborContractor in a future migration.


def build_enable_rls_sql():
    """Generate SQL to create all RLS policies."""
    
    sql_statements = []
    
    # Direct company_id tables
    for table in DIRECT_COMPANY_TABLES:
        sql_statements.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            
            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                );
            
            ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
        """)
    
    # FertilizerProduct - special case: null company_id means global/shared
    sql_statements.append("""
        ALTER TABLE api_fertilizerproduct ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS tenant_isolation ON api_fertilizerproduct;
        
        CREATE POLICY tenant_isolation ON api_fertilizerproduct
            FOR ALL
            USING (
                company_id IS NULL 
                OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
            );
        
        ALTER TABLE api_fertilizerproduct FORCE ROW LEVEL SECURITY;
    """)
    
    # Tables nested under Farm (one level: table.farm_id -> farm.company_id)
    for table, fk_column in NESTED_UNDER_FARM:
        sql_statements.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            
            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    {fk_column} IN (
                        SELECT id FROM api_farm
                        WHERE company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    )
                );
            
            ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
        """)
    
    # Tables nested under Field (two levels: table.field_id -> field.farm_id -> farm.company_id)
    for table, fk_column in NESTED_UNDER_FIELD:
        sql_statements.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            
            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    {fk_column} IN (
                        SELECT f.id FROM api_field f
                        JOIN api_farm fm ON f.farm_id = fm.id
                        WHERE fm.company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    )
                );
            
            ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
        """)
    
    # Tables nested under Harvest (three levels deep)
    for table, fk_column in NESTED_UNDER_HARVEST:
        sql_statements.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            
            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    {fk_column} IN (
                        SELECT h.id FROM api_harvest h
                        JOIN api_field f ON h.field_id = f.id
                        JOIN api_farm fm ON f.farm_id = fm.id
                        WHERE fm.company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    )
                );
            
            ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
        """)
    
    # Tables nested under WaterSource (two levels: table.water_source_id -> watersource.farm_id -> farm.company_id)
    for table, fk_column in NESTED_UNDER_WATERSOURCE:
        sql_statements.append(f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            
            CREATE POLICY tenant_isolation ON {table}
                FOR ALL
                USING (
                    {fk_column} IN (
                        SELECT ws.id FROM api_watersource ws
                        JOIN api_farm fm ON ws.farm_id = fm.id
                        WHERE fm.company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                    )
                );
            
            ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
        """)
    
    # CompanyMembership - users can only see memberships for their current company
    sql_statements.append("""
        ALTER TABLE api_companymembership ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS tenant_isolation ON api_companymembership;
        
        CREATE POLICY tenant_isolation ON api_companymembership
            FOR ALL
            USING (
                company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
            );
        
        ALTER TABLE api_companymembership FORCE ROW LEVEL SECURITY;
    """)
    
    return "\n".join(sql_statements)


def build_disable_rls_sql():
    """Generate SQL to remove all RLS policies (for rollback)."""
    
    all_tables = (
        DIRECT_COMPANY_TABLES + 
        ['api_fertilizerproduct'] +
        [t[0] for t in NESTED_UNDER_FARM] +
        [t[0] for t in NESTED_UNDER_FIELD] +
        [t[0] for t in NESTED_UNDER_HARVEST] +
        [t[0] for t in NESTED_UNDER_WATERSOURCE] +
        ['api_companymembership']
    )
    
    sql_statements = []
    for table in all_tables:
        sql_statements.append(f"""
            DROP POLICY IF EXISTS tenant_isolation ON {table};
            ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
        """)
    
    return "\n".join(sql_statements)


class Migration(migrations.Migration):
    
    dependencies = [
        ('api', '0005_company_county_company_federal_tax_id_company_notes_and_more'),
    ]
    
    operations = [
        migrations.RunSQL(
            sql=build_enable_rls_sql(),
            reverse_sql=build_disable_rls_sql(),
        ),
    ]
