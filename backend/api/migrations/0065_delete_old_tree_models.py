"""Delete all old satellite/LiDAR/tree detection models.

Order: children first (follow FK chains), then parents.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0064_remove_old_tree_fks'),
    ]

    operations = [
        # --- Unified tree identity (children first) ---
        migrations.DeleteModel(name='TreeFeedback'),
        migrations.DeleteModel(name='TreeObservation'),
        migrations.DeleteModel(name='TreeMatchingRun'),
        migrations.DeleteModel(name='Tree'),

        # --- Satellite detection (child then parent) ---
        migrations.DeleteModel(name='DetectedTree'),
        migrations.DeleteModel(name='TreeDetectionRun'),
        migrations.DeleteModel(name='SatelliteImage'),

        # --- LiDAR (children first) ---
        migrations.DeleteModel(name='TerrainAnalysis'),
        migrations.DeleteModel(name='LiDARDetectedTree'),
        migrations.DeleteModel(name='LiDARProcessingRun'),
        migrations.DeleteModel(name='LiDARDataset'),
    ]
