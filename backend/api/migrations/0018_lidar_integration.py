"""
LiDAR Integration Migration

This migration adds:
1. LiDARDataset model for storing uploaded LAZ/LAS files
2. LiDARProcessingRun model for processing runs
3. LiDARDetectedTree model for individual tree detections
4. TerrainAnalysis model for terrain analysis results
5. New fields on Field model for LiDAR-derived data
6. RLS policies for all new tables
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def build_rls_sql():
    """Generate SQL for RLS policies on LiDAR tables."""
    sql = """
        -- =================================================================
        -- Enable RLS on LiDAR tables
        -- =================================================================
        ALTER TABLE api_lidar_dataset ENABLE ROW LEVEL SECURITY;
        ALTER TABLE api_lidar_processing_run ENABLE ROW LEVEL SECURITY;
        ALTER TABLE api_lidar_detected_tree ENABLE ROW LEVEL SECURITY;
        ALTER TABLE api_terrain_analysis ENABLE ROW LEVEL SECURITY;

        -- =================================================================
        -- LiDARDataset RLS - Direct company_id
        -- =================================================================
        CREATE POLICY tenant_isolation ON api_lidar_dataset
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
        -- LiDARProcessingRun RLS - Via LiDARDataset -> Company
        -- =================================================================
        CREATE POLICY tenant_isolation ON api_lidar_processing_run
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR lidar_dataset_id IN (
                    SELECT id FROM api_lidar_dataset
                    WHERE company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR lidar_dataset_id IN (
                    SELECT id FROM api_lidar_dataset
                    WHERE company_id::text = current_setting('app.current_company_id', true)
                )
            );

        -- =================================================================
        -- LiDARDetectedTree RLS - Via ProcessingRun -> LiDARDataset -> Company
        -- =================================================================
        CREATE POLICY tenant_isolation ON api_lidar_detected_tree
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR processing_run_id IN (
                    SELECT lr.id FROM api_lidar_processing_run lr
                    JOIN api_lidar_dataset ld ON lr.lidar_dataset_id = ld.id
                    WHERE ld.company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR processing_run_id IN (
                    SELECT lr.id FROM api_lidar_processing_run lr
                    JOIN api_lidar_dataset ld ON lr.lidar_dataset_id = ld.id
                    WHERE ld.company_id::text = current_setting('app.current_company_id', true)
                )
            );

        -- =================================================================
        -- TerrainAnalysis RLS - Via ProcessingRun -> LiDARDataset -> Company
        -- =================================================================
        CREATE POLICY tenant_isolation ON api_terrain_analysis
            FOR ALL
            USING (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR processing_run_id IN (
                    SELECT lr.id FROM api_lidar_processing_run lr
                    JOIN api_lidar_dataset ld ON lr.lidar_dataset_id = ld.id
                    WHERE ld.company_id::text = current_setting('app.current_company_id', true)
                )
            )
            WITH CHECK (
                COALESCE(current_setting('app.current_company_id', true), '') = ''
                OR processing_run_id IN (
                    SELECT lr.id FROM api_lidar_processing_run lr
                    JOIN api_lidar_dataset ld ON lr.lidar_dataset_id = ld.id
                    WHERE ld.company_id::text = current_setting('app.current_company_id', true)
                )
            );
    """
    return sql


def build_reverse_rls_sql():
    """Reverse SQL - drop RLS policies."""
    sql = """
        -- Drop RLS policies
        DROP POLICY IF EXISTS tenant_isolation ON api_lidar_dataset;
        DROP POLICY IF EXISTS tenant_isolation ON api_lidar_processing_run;
        DROP POLICY IF EXISTS tenant_isolation ON api_lidar_detected_tree;
        DROP POLICY IF EXISTS tenant_isolation ON api_terrain_analysis;

        -- Disable RLS on tables
        ALTER TABLE api_lidar_dataset DISABLE ROW LEVEL SECURITY;
        ALTER TABLE api_lidar_processing_run DISABLE ROW LEVEL SECURITY;
        ALTER TABLE api_lidar_detected_tree DISABLE ROW LEVEL SECURITY;
        ALTER TABLE api_terrain_analysis DISABLE ROW LEVEL SECURITY;
    """
    return sql


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_rename_api_detect_field_s_1j2k3l_idx_api_detecte_field_i_c78d1f_idx_and_more'),
    ]

    operations = [
        # =================================================================
        # Create LiDARDataset model
        # =================================================================
        migrations.CreateModel(
            name='LiDARDataset',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(help_text='LAZ or LAS point cloud file', upload_to='lidar/%Y/%m/')),
                ('file_size_mb', models.FloatField(blank=True, help_text='File size in megabytes', null=True)),
                ('name', models.CharField(help_text='User-friendly name for the dataset', max_length=255)),
                ('source', models.CharField(choices=[('USGS_3DEP', 'USGS 3DEP'), ('NOAA', 'NOAA Digital Coast'), ('CUSTOM_DRONE', 'Custom Drone Flight'), ('COMMERCIAL', 'Commercial Provider')], help_text='Data source/provider', max_length=50)),
                ('capture_date', models.DateField(blank=True, help_text='Date the LiDAR data was captured', null=True)),
                ('point_count', models.BigIntegerField(blank=True, help_text='Total number of points in the dataset', null=True)),
                ('point_density_per_sqm', models.FloatField(blank=True, help_text='Point density (points per square meter)', null=True)),
                ('crs', models.CharField(blank=True, help_text='Coordinate Reference System (e.g., EPSG:6414)', max_length=100, null=True)),
                ('bounds_west', models.FloatField(blank=True, help_text='Western boundary (longitude)', null=True)),
                ('bounds_east', models.FloatField(blank=True, help_text='Eastern boundary (longitude)', null=True)),
                ('bounds_south', models.FloatField(blank=True, help_text='Southern boundary (latitude)', null=True)),
                ('bounds_north', models.FloatField(blank=True, help_text='Northern boundary (latitude)', null=True)),
                ('has_classification', models.BooleanField(default=False, help_text='Whether point cloud has LAS classification codes')),
                ('status', models.CharField(choices=[('uploaded', 'Uploaded'), ('validating', 'Validating'), ('ready', 'Ready'), ('error', 'Error')], default='uploaded', max_length=20)),
                ('error_message', models.TextField(blank=True, help_text='Error message if validation failed')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('metadata_json', models.JSONField(blank=True, default=dict, help_text='Additional metadata extracted from file header')),
                ('company', models.ForeignKey(help_text='Company that owns this dataset', on_delete=django.db.models.deletion.CASCADE, related_name='lidar_datasets', to='api.company')),
                ('farm', models.ForeignKey(blank=True, help_text='Optional farm association', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='lidar_datasets', to='api.farm')),
                ('uploaded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_lidar_datasets', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'LiDAR Dataset',
                'verbose_name_plural': 'LiDAR Datasets',
                'db_table': 'api_lidar_dataset',
                'ordering': ['-uploaded_at'],
            },
        ),

        # =================================================================
        # Create LiDARProcessingRun model
        # =================================================================
        migrations.CreateModel(
            name='LiDARProcessingRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('processing_type', models.CharField(choices=[('TREE_DETECTION', 'Tree Detection'), ('TERRAIN_ANALYSIS', 'Terrain Analysis'), ('FULL', 'Full Analysis')], default='FULL', max_length=50)),
                ('parameters', models.JSONField(blank=True, default=dict, help_text='Processing parameters (resolution, thresholds, etc.)')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('error_message', models.TextField(blank=True, help_text='Error message if processing failed')),
                ('tree_count', models.IntegerField(blank=True, help_text='Number of trees detected', null=True)),
                ('trees_per_acre', models.FloatField(blank=True, help_text='Tree density (trees per acre)', null=True)),
                ('avg_tree_height_m', models.FloatField(blank=True, help_text='Average tree height in meters', null=True)),
                ('max_tree_height_m', models.FloatField(blank=True, help_text='Maximum tree height in meters', null=True)),
                ('min_tree_height_m', models.FloatField(blank=True, help_text='Minimum tree height in meters', null=True)),
                ('avg_canopy_diameter_m', models.FloatField(blank=True, help_text='Average canopy diameter in meters', null=True)),
                ('canopy_coverage_percent', models.FloatField(blank=True, help_text='Percentage of field covered by tree canopy', null=True)),
                ('avg_slope_degrees', models.FloatField(blank=True, help_text='Average slope in degrees', null=True)),
                ('max_slope_degrees', models.FloatField(blank=True, help_text='Maximum slope in degrees', null=True)),
                ('elevation_range_m', models.FloatField(blank=True, help_text='Elevation range (max - min) in meters', null=True)),
                ('dtm_file', models.FileField(blank=True, help_text='Digital Terrain Model (bare ground)', null=True, upload_to='lidar_products/%Y/%m/')),
                ('dsm_file', models.FileField(blank=True, help_text='Digital Surface Model (including vegetation)', null=True, upload_to='lidar_products/%Y/%m/')),
                ('chm_file', models.FileField(blank=True, help_text='Canopy Height Model (DSM - DTM)', null=True, upload_to='lidar_products/%Y/%m/')),
                ('is_approved', models.BooleanField(default=False, help_text='Whether results have been approved')),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('review_notes', models.TextField(blank=True, help_text='Notes from reviewer')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('processing_time_seconds', models.IntegerField(blank=True, help_text='Total processing time in seconds', null=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_lidar_runs', to=settings.AUTH_USER_MODEL)),
                ('field', models.ForeignKey(help_text='Field being analyzed', on_delete=django.db.models.deletion.CASCADE, related_name='lidar_runs', to='api.field')),
                ('lidar_dataset', models.ForeignKey(help_text='Source LiDAR dataset', on_delete=django.db.models.deletion.CASCADE, related_name='processing_runs', to='api.lidardataset')),
            ],
            options={
                'verbose_name': 'LiDAR Processing Run',
                'verbose_name_plural': 'LiDAR Processing Runs',
                'db_table': 'api_lidar_processing_run',
                'ordering': ['-created_at'],
            },
        ),

        # =================================================================
        # Create LiDARDetectedTree model
        # =================================================================
        migrations.CreateModel(
            name='LiDARDetectedTree',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.FloatField(help_text='Tree crown center latitude')),
                ('longitude', models.FloatField(help_text='Tree crown center longitude')),
                ('height_m', models.FloatField(help_text='Tree height in meters (from CHM)')),
                ('canopy_diameter_m', models.FloatField(blank=True, help_text='Estimated canopy diameter in meters', null=True)),
                ('canopy_area_sqm', models.FloatField(blank=True, help_text='Estimated canopy area in square meters', null=True)),
                ('ground_elevation_m', models.FloatField(blank=True, help_text='Ground elevation at tree base (from DTM)', null=True)),
                ('status', models.CharField(choices=[('active', 'Active'), ('dead', 'Dead/Missing'), ('uncertain', 'Uncertain'), ('false_positive', 'False Positive')], default='active', max_length=20)),
                ('is_verified', models.BooleanField(default=False, help_text='User has manually verified this tree')),
                ('notes', models.TextField(blank=True, help_text='User notes about this tree')),
                ('field', models.ForeignKey(help_text='Field containing this tree', on_delete=django.db.models.deletion.CASCADE, related_name='lidar_detected_trees', to='api.field')),
                ('processing_run', models.ForeignKey(help_text='Processing run that detected this tree', on_delete=django.db.models.deletion.CASCADE, related_name='detected_trees', to='api.lidarprocessingrun')),
            ],
            options={
                'verbose_name': 'LiDAR Detected Tree',
                'verbose_name_plural': 'LiDAR Detected Trees',
                'db_table': 'api_lidar_detected_tree',
            },
        ),

        # =================================================================
        # Create TerrainAnalysis model
        # =================================================================
        migrations.CreateModel(
            name='TerrainAnalysis',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('min_elevation_m', models.FloatField(help_text='Minimum ground elevation in meters')),
                ('max_elevation_m', models.FloatField(help_text='Maximum ground elevation in meters')),
                ('mean_elevation_m', models.FloatField(help_text='Mean ground elevation in meters')),
                ('mean_slope_degrees', models.FloatField(help_text='Mean slope in degrees')),
                ('max_slope_degrees', models.FloatField(help_text='Maximum slope in degrees')),
                ('slope_aspect_dominant', models.CharField(choices=[('N', 'North'), ('NE', 'Northeast'), ('E', 'East'), ('SE', 'Southeast'), ('S', 'South'), ('SW', 'Southwest'), ('W', 'West'), ('NW', 'Northwest'), ('FLAT', 'Flat')], help_text='Dominant slope aspect (direction facing)', max_length=20)),
                ('slope_0_2_percent', models.FloatField(blank=True, help_text='Percentage of field with 0-2 degree slope', null=True)),
                ('slope_2_5_percent', models.FloatField(blank=True, help_text='Percentage of field with 2-5 degree slope', null=True)),
                ('slope_5_10_percent', models.FloatField(blank=True, help_text='Percentage of field with 5-10 degree slope', null=True)),
                ('slope_over_10_percent', models.FloatField(blank=True, help_text='Percentage of field with >10 degree slope', null=True)),
                ('frost_risk_zones', models.JSONField(blank=True, default=dict, help_text='GeoJSON of frost risk zones')),
                ('frost_risk_summary', models.JSONField(blank=True, default=dict, help_text='Summary statistics for frost risk')),
                ('drainage_direction', models.CharField(blank=True, choices=[('N', 'North'), ('NE', 'Northeast'), ('E', 'East'), ('SE', 'Southeast'), ('S', 'South'), ('SW', 'Southwest'), ('W', 'West'), ('NW', 'Northwest'), ('FLAT', 'Flat')], help_text='Primary drainage direction', max_length=20, null=True)),
                ('low_spot_count', models.IntegerField(blank=True, help_text='Number of low spots that may pool water', null=True)),
                ('field', models.ForeignKey(help_text='Field being analyzed', on_delete=django.db.models.deletion.CASCADE, related_name='terrain_analyses', to='api.field')),
                ('processing_run', models.OneToOneField(help_text='Processing run that generated this analysis', on_delete=django.db.models.deletion.CASCADE, related_name='terrain_analysis', to='api.lidarprocessingrun')),
            ],
            options={
                'verbose_name': 'Terrain Analysis',
                'verbose_name_plural': 'Terrain Analyses',
                'db_table': 'api_terrain_analysis',
            },
        ),

        # =================================================================
        # Add indexes to LiDARDetectedTree
        # =================================================================
        migrations.AddIndex(
            model_name='lidardetectedtree',
            index=models.Index(fields=['processing_run', 'field'], name='api_lidar_d_process_7d8e9f_idx'),
        ),
        migrations.AddIndex(
            model_name='lidardetectedtree',
            index=models.Index(fields=['field', 'status'], name='api_lidar_d_field_i_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='lidardetectedtree',
            index=models.Index(fields=['latitude', 'longitude'], name='api_lidar_d_latitud_d4e5f6_idx'),
        ),

        # =================================================================
        # Add LiDAR fields to Field model
        # =================================================================
        migrations.AddField(
            model_name='field',
            name='lidar_tree_count',
            field=models.IntegerField(blank=True, help_text='Tree count from LiDAR detection', null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='lidar_trees_per_acre',
            field=models.FloatField(blank=True, help_text='Tree density from LiDAR detection', null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='lidar_avg_tree_height_m',
            field=models.FloatField(blank=True, help_text='Average tree height from LiDAR (meters)', null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='lidar_canopy_coverage_percent',
            field=models.FloatField(blank=True, help_text='Canopy coverage percentage from LiDAR', null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='lidar_detection_date',
            field=models.DateField(blank=True, help_text='Date of LiDAR data used for detection', null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='latest_lidar_run',
            field=models.ForeignKey(blank=True, help_text='Most recent approved LiDAR processing run', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='api.lidarprocessingrun'),
        ),
        migrations.AddField(
            model_name='field',
            name='avg_slope_degrees',
            field=models.FloatField(blank=True, help_text='Average slope in degrees from LiDAR terrain analysis', null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='primary_aspect',
            field=models.CharField(blank=True, help_text='Primary slope aspect (N, NE, E, SE, S, SW, W, NW, FLAT)', max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='field',
            name='frost_risk_level',
            field=models.CharField(blank=True, choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')], help_text='Frost risk level based on terrain analysis', max_length=20, null=True),
        ),

        # =================================================================
        # Add RLS policies
        # =================================================================
        migrations.RunSQL(
            sql=build_rls_sql(),
            reverse_sql=build_reverse_rls_sql(),
        ),
    ]
