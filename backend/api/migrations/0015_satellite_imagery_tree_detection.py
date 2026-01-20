"""
Migration for Satellite Imagery & Tree Detection feature.

Creates:
- SatelliteImage model
- TreeDetectionRun model
- DetectedTree model
- Adds tree detection fields to Field model
- Sets up Row-Level Security policies for new tables
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def build_enable_rls_sql():
    """Generate SQL to enable RLS on new satellite imagery tables."""

    sql = """
        -- =================================================================
        -- SatelliteImage RLS - Direct company_id
        -- =================================================================
        ALTER TABLE api_satelliteimage ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_satelliteimage;

        CREATE POLICY tenant_isolation ON api_satelliteimage
            FOR ALL
            USING (
                company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
            );

        ALTER TABLE api_satelliteimage FORCE ROW LEVEL SECURITY;

        -- =================================================================
        -- TreeDetectionRun RLS - Via satellite_image -> company_id
        -- =================================================================
        ALTER TABLE api_treedetectionrun ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_treedetectionrun;

        CREATE POLICY tenant_isolation ON api_treedetectionrun
            FOR ALL
            USING (
                satellite_image_id IN (
                    SELECT id FROM api_satelliteimage
                    WHERE company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                )
            );

        ALTER TABLE api_treedetectionrun FORCE ROW LEVEL SECURITY;

        -- =================================================================
        -- DetectedTree RLS - Via field -> farm -> company_id
        -- =================================================================
        ALTER TABLE api_detectedtree ENABLE ROW LEVEL SECURITY;

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

        ALTER TABLE api_detectedtree FORCE ROW LEVEL SECURITY;
    """
    return sql


def build_disable_rls_sql():
    """Generate SQL to disable RLS on satellite imagery tables (for rollback)."""

    sql = """
        DROP POLICY IF EXISTS tenant_isolation ON api_satelliteimage;
        ALTER TABLE api_satelliteimage DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_treedetectionrun;
        ALTER TABLE api_treedetectionrun DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON api_detectedtree;
        ALTER TABLE api_detectedtree DISABLE ROW LEVEL SECURITY;
    """
    return sql


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_seed_default_crops_rootstocks'),
    ]

    operations = [
        # =================================================================
        # Add satellite detection fields to Field model
        # =================================================================
        migrations.AddField(
            model_name='field',
            name='latest_satellite_tree_count',
            field=models.IntegerField(
                blank=True,
                help_text='Tree count from most recent satellite detection',
                null=True
            ),
        ),
        migrations.AddField(
            model_name='field',
            name='latest_satellite_trees_per_acre',
            field=models.FloatField(
                blank=True,
                help_text='Tree density from satellite detection',
                null=True
            ),
        ),
        migrations.AddField(
            model_name='field',
            name='satellite_canopy_coverage_percent',
            field=models.FloatField(
                blank=True,
                help_text='Canopy coverage percentage from satellite detection',
                null=True
            ),
        ),
        migrations.AddField(
            model_name='field',
            name='latest_detection_date',
            field=models.DateField(
                blank=True,
                help_text='Date of imagery used for latest tree detection',
                null=True
            ),
        ),

        # =================================================================
        # Create SatelliteImage model
        # =================================================================
        migrations.CreateModel(
            name='SatelliteImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(help_text='Uploaded GeoTIFF file', upload_to='imagery/%Y/%m/')),
                ('file_size_mb', models.FloatField(help_text='File size in megabytes')),
                ('capture_date', models.DateField(help_text='Date the imagery was captured')),
                ('resolution_m', models.FloatField(help_text='Ground sample distance in meters (e.g., 0.38 for 38cm)')),
                ('bands', models.IntegerField(default=3, help_text='Number of spectral bands (3 for RGB, 4 for BGRN)')),
                ('has_nir', models.BooleanField(default=False, help_text='Has near-infrared band for NDVI calculation')),
                ('source', models.CharField(help_text='Imagery provider (e.g., SkyWatch, NAIP, Planet, Maxar)', max_length=50)),
                ('source_product_id', models.CharField(blank=True, help_text="Provider's product/order ID for reference", max_length=100)),
                ('bounds_west', models.FloatField(help_text='Western boundary longitude')),
                ('bounds_east', models.FloatField(help_text='Eastern boundary longitude')),
                ('bounds_south', models.FloatField(help_text='Southern boundary latitude')),
                ('bounds_north', models.FloatField(help_text='Northern boundary latitude')),
                ('crs', models.CharField(default='EPSG:4326', help_text='Coordinate Reference System', max_length=50)),
                ('metadata_json', models.JSONField(blank=True, default=dict, help_text='Full provider metadata (cloud cover, sun angle, etc.)')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(
                    help_text='Company that owns this imagery',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='satellite_images',
                    to='api.company'
                )),
                ('farm', models.ForeignKey(
                    help_text='Farm this imagery covers',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='satellite_images',
                    to='api.farm'
                )),
                ('uploaded_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='uploaded_satellite_images',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Satellite Image',
                'verbose_name_plural': 'Satellite Images',
                'ordering': ['-capture_date'],
            },
        ),

        # =================================================================
        # Create TreeDetectionRun model
        # =================================================================
        migrations.CreateModel(
            name='TreeDetectionRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('processing', 'Processing'),
                        ('completed', 'Completed'),
                        ('failed', 'Failed')
                    ],
                    default='pending',
                    max_length=20
                )),
                ('error_message', models.TextField(blank=True, help_text='Error details if detection failed')),
                ('algorithm_version', models.CharField(default='1.0', help_text='Version of detection algorithm used', max_length=20)),
                ('vegetation_index', models.CharField(default='NDVI', help_text='Vegetation index used (NDVI or ExG)', max_length=10)),
                ('parameters', models.JSONField(
                    default=dict,
                    help_text='Detection parameters: min_canopy_diameter_m, max_canopy_diameter_m, min_tree_spacing_m, vegetation_threshold_percentile'
                )),
                ('tree_count', models.IntegerField(help_text='Total trees detected', null=True)),
                ('trees_per_acre', models.FloatField(help_text='Tree density (trees/acre)', null=True)),
                ('avg_canopy_diameter_m', models.FloatField(help_text='Average canopy diameter in meters', null=True)),
                ('canopy_coverage_percent', models.FloatField(help_text='Percentage of field covered by canopy', null=True)),
                ('processing_time_seconds', models.FloatField(help_text='Time taken to process in seconds', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(help_text='When processing completed', null=True)),
                ('review_notes', models.TextField(blank=True, help_text='Notes from user review')),
                ('is_approved', models.BooleanField(default=False, help_text='User verified results are accurate')),
                ('field', models.ForeignKey(
                    help_text='Field being analyzed',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='detection_runs',
                    to='api.field'
                )),
                ('satellite_image', models.ForeignKey(
                    help_text='Source imagery for detection',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='detection_runs',
                    to='api.satelliteimage'
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_detection_runs',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Tree Detection Run',
                'verbose_name_plural': 'Tree Detection Runs',
                'ordering': ['-created_at'],
                'get_latest_by': 'created_at',
            },
        ),

        # =================================================================
        # Create DetectedTree model
        # =================================================================
        migrations.CreateModel(
            name='DetectedTree',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.FloatField(help_text='Tree center latitude')),
                ('longitude', models.FloatField(help_text='Tree center longitude')),
                ('pixel_x', models.IntegerField(help_text='X pixel coordinate in source image')),
                ('pixel_y', models.IntegerField(help_text='Y pixel coordinate in source image')),
                ('canopy_diameter_m', models.FloatField(help_text='Estimated canopy diameter in meters', null=True)),
                ('ndvi_value', models.FloatField(help_text='NDVI value at tree center (0-1 scale)', null=True)),
                ('confidence_score', models.FloatField(help_text='Detection confidence score (0-1)')),
                ('status', models.CharField(
                    choices=[
                        ('active', 'Active'),
                        ('dead', 'Dead/Removed'),
                        ('uncertain', 'Uncertain'),
                        ('false_positive', 'False Positive')
                    ],
                    default='active',
                    max_length=20
                )),
                ('is_verified', models.BooleanField(default=False, help_text='User has manually verified this tree')),
                ('notes', models.TextField(blank=True, help_text='User notes about this tree')),
                ('detection_run', models.ForeignKey(
                    help_text='Detection run that identified this tree',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='trees',
                    to='api.treedetectionrun'
                )),
                ('field', models.ForeignKey(
                    help_text='Field containing this tree',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='detected_trees',
                    to='api.field'
                )),
            ],
            options={
                'verbose_name': 'Detected Tree',
                'verbose_name_plural': 'Detected Trees',
            },
        ),

        # =================================================================
        # Add latest_detection_run FK to Field (after TreeDetectionRun exists)
        # =================================================================
        migrations.AddField(
            model_name='field',
            name='latest_detection_run',
            field=models.ForeignKey(
                blank=True,
                help_text='Most recent approved tree detection run',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='api.treedetectionrun'
            ),
        ),

        # =================================================================
        # Add indexes
        # =================================================================
        migrations.AddIndex(
            model_name='satelliteimage',
            index=models.Index(fields=['company', 'farm'], name='api_satelli_company_4b8e5f_idx'),
        ),
        migrations.AddIndex(
            model_name='satelliteimage',
            index=models.Index(fields=['capture_date'], name='api_satelli_capture_0c2a3f_idx'),
        ),
        migrations.AddIndex(
            model_name='treedetectionrun',
            index=models.Index(fields=['field', 'status'], name='api_treede_field_i_1a2b3c_idx'),
        ),
        migrations.AddIndex(
            model_name='treedetectionrun',
            index=models.Index(fields=['satellite_image'], name='api_treede_satelli_4d5e6f_idx'),
        ),
        migrations.AddIndex(
            model_name='treedetectionrun',
            index=models.Index(fields=['created_at'], name='api_treede_created_7g8h9i_idx'),
        ),
        migrations.AddIndex(
            model_name='detectedtree',
            index=models.Index(fields=['field', 'status'], name='api_detect_field_s_1j2k3l_idx'),
        ),
        migrations.AddIndex(
            model_name='detectedtree',
            index=models.Index(fields=['detection_run'], name='api_detect_detecti_4m5n6o_idx'),
        ),
        migrations.AddIndex(
            model_name='detectedtree',
            index=models.Index(fields=['latitude', 'longitude'], name='api_detect_lat_lng_7p8q9r_idx'),
        ),

        # =================================================================
        # Enable Row-Level Security
        # =================================================================
        migrations.RunSQL(
            sql=build_enable_rls_sql(),
            reverse_sql=build_disable_rls_sql(),
        ),
    ]
