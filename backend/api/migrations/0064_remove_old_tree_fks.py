"""Remove foreign key references to old tree detection models.

This must run before deleting the old models so Django can drop
the FK constraints cleanly.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0063_auto_number_fields_blank'),
    ]

    operations = [
        # --- Field model: remove satellite/LiDAR/terrain fields ---
        migrations.RemoveField(model_name='field', name='latest_satellite_tree_count'),
        migrations.RemoveField(model_name='field', name='latest_satellite_trees_per_acre'),
        migrations.RemoveField(model_name='field', name='satellite_canopy_coverage_percent'),
        migrations.RemoveField(model_name='field', name='latest_detection_date'),
        migrations.RemoveField(model_name='field', name='latest_detection_run'),
        migrations.RemoveField(model_name='field', name='lidar_tree_count'),
        migrations.RemoveField(model_name='field', name='lidar_trees_per_acre'),
        migrations.RemoveField(model_name='field', name='lidar_avg_tree_height_m'),
        migrations.RemoveField(model_name='field', name='lidar_canopy_coverage_percent'),
        migrations.RemoveField(model_name='field', name='lidar_detection_date'),
        migrations.RemoveField(model_name='field', name='latest_lidar_run'),
        migrations.RemoveField(model_name='field', name='avg_slope_degrees'),
        migrations.RemoveField(model_name='field', name='primary_aspect'),
        migrations.RemoveField(model_name='field', name='frost_risk_level'),

        # --- DiseaseAnalysisRun: remove satellite/detection FKs ---
        migrations.RemoveField(model_name='diseaseanalysisrun', name='satellite_image'),
        migrations.RemoveField(model_name='diseaseanalysisrun', name='tree_detection_run'),

        # --- TreeHealthRecord: remove detection FK ---
        migrations.RemoveField(model_name='treehealthrecord', name='last_detection_run'),
    ]
