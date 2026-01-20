"""
Migration to add irrigation scheduling models.

Creates:
- IrrigationZone
- CropCoefficientProfile
- CIMISDataCache
- IrrigationRecommendation
- SoilMoistureReading

Modifies IrrigationEvent to add zone-based fields.

Includes Row-Level Security (RLS) policies for tenant isolation.
"""

from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_quarantine_status'),
    ]

    operations = [
        # =====================================================================
        # CREATE NEW MODELS
        # =====================================================================

        # IrrigationZone
        migrations.CreateModel(
            name='IrrigationZone',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text="Zone name (e.g., 'Block A Drip')", max_length=200)),
                ('acres', models.DecimalField(decimal_places=2, help_text='Zone acreage', max_digits=8, null=True, blank=True)),
                ('crop_type', models.CharField(default='citrus', help_text='Primary crop type', max_length=50)),
                ('tree_age', models.IntegerField(blank=True, help_text='Tree age in years', null=True)),
                ('tree_spacing_ft', models.DecimalField(decimal_places=1, help_text='Tree spacing in feet', max_digits=5, null=True, blank=True)),
                ('irrigation_method', models.CharField(choices=[
                    ('drip', 'Drip'), ('micro_sprinkler', 'Micro-Sprinkler'),
                    ('flood', 'Flood'), ('furrow', 'Furrow'), ('sprinkler', 'Sprinkler')
                ], default='drip', max_length=20)),
                ('emitters_per_tree', models.IntegerField(blank=True, help_text='Number of emitters per tree', null=True)),
                ('emitter_gph', models.DecimalField(decimal_places=2, help_text='Emitter flow rate (GPH)', max_digits=5, null=True, blank=True)),
                ('application_rate', models.DecimalField(decimal_places=3, default=Decimal('0.05'), help_text='Water application rate (inches per hour)', max_digits=5, null=True, blank=True)),
                ('distribution_uniformity', models.IntegerField(default=85, help_text='System efficiency (0-100%)')),
                ('soil_type', models.CharField(blank=True, choices=[
                    ('sandy', 'Sandy'), ('sandy_loam', 'Sandy Loam'), ('loam', 'Loam'),
                    ('clay_loam', 'Clay Loam'), ('clay', 'Clay')
                ], max_length=30)),
                ('soil_water_holding_capacity', models.DecimalField(decimal_places=2, default=Decimal('1.5'), help_text='Available water (inches per foot)', max_digits=4, null=True, blank=True)),
                ('root_depth_inches', models.IntegerField(default=36, help_text='Effective root zone depth')),
                ('management_allowable_depletion', models.IntegerField(default=50, help_text='MAD threshold (0-100%)')),
                ('cimis_target', models.CharField(blank=True, help_text='CIMIS station ID or zip code', max_length=20)),
                ('cimis_target_type', models.CharField(choices=[('station', 'Station'), ('spatial', 'Spatial (Zip)')], default='station', max_length=10)),
                ('active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('field', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='irrigation_zones', to='api.field')),
                ('water_source', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='irrigation_zones', to='api.watersource')),
            ],
            options={
                'verbose_name': 'Irrigation Zone',
                'verbose_name_plural': 'Irrigation Zones',
                'ordering': ['field__name', 'name'],
            },
        ),

        # CropCoefficientProfile
        migrations.CreateModel(
            name='CropCoefficientProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('crop_type', models.CharField(help_text="Crop type", max_length=50)),
                ('growth_stage', models.CharField(blank=True, help_text='Growth stage (e.g., mature, young)', max_length=50)),
                ('kc_jan', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_feb', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_mar', models.DecimalField(decimal_places=2, default=Decimal('0.70'), max_digits=3)),
                ('kc_apr', models.DecimalField(decimal_places=2, default=Decimal('0.70'), max_digits=3)),
                ('kc_may', models.DecimalField(decimal_places=2, default=Decimal('0.70'), max_digits=3)),
                ('kc_jun', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_jul', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_aug', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_sep', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_oct', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_nov', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('kc_dec', models.DecimalField(decimal_places=2, default=Decimal('0.65'), max_digits=3)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('zone', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='kc_profiles', to='api.irrigationzone')),
            ],
            options={
                'verbose_name': 'Crop Coefficient Profile',
                'verbose_name_plural': 'Crop Coefficient Profiles',
            },
        ),

        # CIMISDataCache
        migrations.CreateModel(
            name='CIMISDataCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(help_text='Data date')),
                ('source_id', models.CharField(help_text='Station ID or zip code', max_length=20)),
                ('data_source', models.CharField(choices=[('station', 'Station'), ('spatial', 'Spatial')], default='station', max_length=10)),
                ('eto', models.DecimalField(blank=True, decimal_places=3, help_text='Reference evapotranspiration (inches)', max_digits=6, null=True)),
                ('precipitation', models.DecimalField(blank=True, decimal_places=3, help_text='Precipitation (inches)', max_digits=6, null=True)),
                ('air_temp_avg', models.DecimalField(blank=True, decimal_places=1, max_digits=5, null=True)),
                ('air_temp_max', models.DecimalField(blank=True, decimal_places=1, max_digits=5, null=True)),
                ('air_temp_min', models.DecimalField(blank=True, decimal_places=1, max_digits=5, null=True)),
                ('eto_qc', models.CharField(blank=True, help_text='ETo quality control flag', max_length=5)),
                ('fetched_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'CIMIS Data Cache',
                'verbose_name_plural': 'CIMIS Data Cache',
                'ordering': ['-date'],
                'unique_together': {('date', 'source_id', 'data_source')},
            },
        ),

        # IrrigationRecommendation
        migrations.CreateModel(
            name='IrrigationRecommendation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recommended_date', models.DateField(help_text='Recommended irrigation date')),
                ('recommended_depth_inches', models.DecimalField(decimal_places=3, help_text='Recommended depth (inches)', max_digits=6)),
                ('recommended_duration_hours', models.DecimalField(blank=True, decimal_places=2, help_text='Recommended duration (hours)', max_digits=6, null=True)),
                ('days_since_last_irrigation', models.IntegerField(blank=True, null=True)),
                ('cumulative_etc', models.DecimalField(blank=True, decimal_places=3, help_text='Cumulative ETc since last irrigation', max_digits=6, null=True)),
                ('effective_rainfall', models.DecimalField(blank=True, decimal_places=3, help_text='Effective rainfall credit', max_digits=6, null=True)),
                ('soil_moisture_depletion_pct', models.DecimalField(blank=True, decimal_places=1, help_text='Current depletion %', max_digits=5, null=True)),
                ('status', models.CharField(choices=[
                    ('pending', 'Pending'), ('applied', 'Applied'),
                    ('skipped', 'Skipped'), ('expired', 'Expired')
                ], default='pending', max_length=20)),
                ('calculation_details', models.JSONField(blank=True, default=dict, help_text='Detailed calculation breakdown')),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('zone', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recommendations', to='api.irrigationzone')),
            ],
            options={
                'verbose_name': 'Irrigation Recommendation',
                'verbose_name_plural': 'Irrigation Recommendations',
                'ordering': ['-recommended_date', '-generated_at'],
            },
        ),

        # SoilMoistureReading
        migrations.CreateModel(
            name='SoilMoistureReading',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reading_datetime', models.DateTimeField(help_text='Reading date/time')),
                ('sensor_id', models.CharField(blank=True, help_text='Sensor identifier', max_length=50)),
                ('sensor_depth_inches', models.IntegerField(default=12, help_text='Sensor depth')),
                ('volumetric_water_content', models.DecimalField(blank=True, decimal_places=2, help_text='VWC percentage', max_digits=5, null=True)),
                ('soil_tension_cb', models.DecimalField(blank=True, decimal_places=1, help_text='Soil tension (centibars)', max_digits=6, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('zone', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='moisture_readings', to='api.irrigationzone')),
            ],
            options={
                'verbose_name': 'Soil Moisture Reading',
                'verbose_name_plural': 'Soil Moisture Readings',
                'ordering': ['-reading_datetime'],
            },
        ),

        # =====================================================================
        # ADD FIELDS TO EXISTING IrrigationEvent MODEL
        # =====================================================================

        # Make field nullable (zone-based events may not have a field directly)
        migrations.AlterField(
            model_name='irrigationevent',
            name='field',
            field=models.ForeignKey(blank=True, null=True, help_text='Field irrigated (optional if zone is set)', on_delete=django.db.models.deletion.CASCADE, related_name='irrigation_events', to='api.field'),
        ),

        # Add zone FK
        migrations.AddField(
            model_name='irrigationevent',
            name='zone',
            field=models.ForeignKey(blank=True, null=True, help_text='Irrigation zone (for scheduling module)', on_delete=django.db.models.deletion.CASCADE, related_name='irrigation_events', to='api.irrigationzone'),
        ),

        # Add recommendation FK
        migrations.AddField(
            model_name='irrigationevent',
            name='recommendation',
            field=models.ForeignKey(blank=True, null=True, help_text='Recommendation this event fulfills', on_delete=django.db.models.deletion.SET_NULL, related_name='events', to='api.irrigationrecommendation'),
        ),

        # Add date field (alias for irrigation_date)
        migrations.AddField(
            model_name='irrigationevent',
            name='date',
            field=models.DateField(blank=True, null=True, help_text='Alias for irrigation_date (for scheduling module)'),
        ),

        # Add depth_inches field
        migrations.AddField(
            model_name='irrigationevent',
            name='depth_inches',
            field=models.DecimalField(blank=True, decimal_places=3, help_text='Application depth (inches) for scheduling', max_digits=5, null=True),
        ),

        # Add method field
        migrations.AddField(
            model_name='irrigationevent',
            name='method',
            field=models.CharField(choices=[('scheduled', 'Scheduled'), ('manual', 'Manual'), ('rainfall', 'Rainfall (Natural)')], default='manual', help_text='How irrigation was triggered', max_length=20),
        ),

        # Add source field
        migrations.AddField(
            model_name='irrigationevent',
            name='source',
            field=models.CharField(choices=[('manual', 'Manual Entry'), ('recommendation', 'From Recommendation'), ('sensor', 'Sensor Triggered'), ('schedule', 'Automated Schedule')], default='manual', help_text='Source of irrigation event record', max_length=20),
        ),

        # =====================================================================
        # ADD INDEXES
        # =====================================================================

        migrations.AddIndex(
            model_name='irrigationzone',
            index=models.Index(fields=['field'], name='api_irrigat_field_i_idx'),
        ),
        migrations.AddIndex(
            model_name='irrigationrecommendation',
            index=models.Index(fields=['zone', 'recommended_date'], name='api_irrigat_zone_re_idx'),
        ),
        migrations.AddIndex(
            model_name='irrigationrecommendation',
            index=models.Index(fields=['status'], name='api_irrigat_status_idx'),
        ),
        migrations.AddIndex(
            model_name='cimisdatacache',
            index=models.Index(fields=['source_id', 'date'], name='api_cimisda_source_idx'),
        ),

        # =====================================================================
        # ROW-LEVEL SECURITY POLICIES
        # =====================================================================

        migrations.RunSQL(
            sql="""
            -- Enable RLS on irrigation tables
            ALTER TABLE api_irrigationzone ENABLE ROW LEVEL SECURITY;
            ALTER TABLE api_irrigationrecommendation ENABLE ROW LEVEL SECURITY;
            ALTER TABLE api_soilmoisturereading ENABLE ROW LEVEL SECURITY;

            -- IrrigationZone: company through field.farm
            CREATE POLICY irrigationzone_tenant_isolation ON api_irrigationzone
                USING (
                    EXISTS (
                        SELECT 1 FROM api_field f
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE f.id = api_irrigationzone.field_id
                        AND fa.company_id = current_setting('app.current_company_id', true)::integer
                    )
                );

            -- IrrigationRecommendation: company through zone.field.farm
            CREATE POLICY irrigationrecommendation_tenant_isolation ON api_irrigationrecommendation
                USING (
                    EXISTS (
                        SELECT 1 FROM api_irrigationzone z
                        JOIN api_field f ON z.field_id = f.id
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE z.id = api_irrigationrecommendation.zone_id
                        AND fa.company_id = current_setting('app.current_company_id', true)::integer
                    )
                );

            -- SoilMoistureReading: company through zone.field.farm
            CREATE POLICY soilmoisturereading_tenant_isolation ON api_soilmoisturereading
                USING (
                    EXISTS (
                        SELECT 1 FROM api_irrigationzone z
                        JOIN api_field f ON z.field_id = f.id
                        JOIN api_farm fa ON f.farm_id = fa.id
                        WHERE z.id = api_soilmoisturereading.zone_id
                        AND fa.company_id = current_setting('app.current_company_id', true)::integer
                    )
                );
            """,
            reverse_sql="""
            DROP POLICY IF EXISTS irrigationzone_tenant_isolation ON api_irrigationzone;
            DROP POLICY IF EXISTS irrigationrecommendation_tenant_isolation ON api_irrigationrecommendation;
            DROP POLICY IF EXISTS soilmoisturereading_tenant_isolation ON api_soilmoisturereading;
            ALTER TABLE api_irrigationzone DISABLE ROW LEVEL SECURITY;
            ALTER TABLE api_irrigationrecommendation DISABLE ROW LEVEL SECURITY;
            ALTER TABLE api_soilmoisturereading DISABLE ROW LEVEL SECURITY;
            """
        ),

        # =====================================================================
        # DEFAULT KC PROFILES
        # =====================================================================

        migrations.RunSQL(
            sql="""
            -- Insert default Kc profiles (zone=null means system default)
            INSERT INTO api_cropcoefficientprofile (crop_type, growth_stage, kc_jan, kc_feb, kc_mar, kc_apr, kc_may, kc_jun, kc_jul, kc_aug, kc_sep, kc_oct, kc_nov, kc_dec, notes, created_at, updated_at, zone_id)
            VALUES
            ('citrus', 'mature', 0.65, 0.65, 0.70, 0.70, 0.70, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65, 'Mature citrus (>5 years)', NOW(), NOW(), NULL),
            ('citrus', 'young', 0.50, 0.50, 0.55, 0.55, 0.55, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 'Young citrus (1-5 years)', NOW(), NOW(), NULL),
            ('avocado', 'mature', 0.60, 0.60, 0.65, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.65, 0.60, 0.60, 'Mature avocado', NOW(), NOW(), NULL)
            ON CONFLICT DO NOTHING;
            """,
            reverse_sql="DELETE FROM api_cropcoefficientprofile WHERE zone_id IS NULL;"
        ),
    ]
