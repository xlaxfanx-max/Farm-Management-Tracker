"""Create new TreeSurvey and DetectedTree models for YOLO detection."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0065_delete_old_tree_models'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TreeSurvey',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image_file', models.FileField(upload_to='tree_surveys/%Y/%m/')),
                ('image_type', models.CharField(choices=[('rgb', 'RGB (3-band)'), ('multispectral', 'Multispectral (RGB+NIR)')], default='rgb', max_length=20)),
                ('file_size_mb', models.FloatField(blank=True, null=True)),
                ('capture_date', models.DateField(help_text='Date imagery was captured')),
                ('source', models.CharField(blank=True, help_text="Imagery provider (e.g. 'drone', 'Planet', 'NAIP')", max_length=100)),
                ('resolution_m', models.FloatField(blank=True, help_text='Ground sample distance in meters', null=True)),
                ('crs', models.CharField(default='EPSG:4326', max_length=50)),
                ('bounds_west', models.FloatField(blank=True, null=True)),
                ('bounds_east', models.FloatField(blank=True, null=True)),
                ('bounds_south', models.FloatField(blank=True, null=True)),
                ('bounds_north', models.FloatField(blank=True, null=True)),
                ('has_nir', models.BooleanField(default=False, help_text='Has NIR band for NDVI health scoring')),
                ('status', models.CharField(choices=[('uploading', 'Uploading'), ('pending', 'Pending Detection'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('error_message', models.TextField(blank=True)),
                ('detection_model', models.CharField(default='deepforest', help_text='Detection model used (e.g. deepforest, yolov8-tree)', max_length=50)),
                ('detection_params', models.JSONField(blank=True, default=dict)),
                ('tree_count', models.IntegerField(blank=True, null=True)),
                ('trees_per_acre', models.FloatField(blank=True, null=True)),
                ('avg_confidence', models.FloatField(blank=True, null=True)),
                ('avg_ndvi', models.FloatField(blank=True, help_text='Mean NDVI of detected trees (multispectral only)', null=True)),
                ('canopy_coverage_percent', models.FloatField(blank=True, null=True)),
                ('processing_time_seconds', models.FloatField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tree_surveys', to='api.company')),
                ('field', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tree_surveys', to='api.field')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tree_surveys', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='treesurvey',
            index=models.Index(fields=['company', 'field'], name='api_treesur_company_idx'),
        ),
        migrations.AddIndex(
            model_name='treesurvey',
            index=models.Index(fields=['field', 'status'], name='api_treesur_field_s_idx'),
        ),
        migrations.AddIndex(
            model_name='treesurvey',
            index=models.Index(fields=['capture_date'], name='api_treesur_capture_idx'),
        ),
        migrations.CreateModel(
            name='DetectedTree',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('bbox_x_min', models.IntegerField(help_text='Left edge pixel')),
                ('bbox_y_min', models.IntegerField(help_text='Top edge pixel')),
                ('bbox_x_max', models.IntegerField(help_text='Right edge pixel')),
                ('bbox_y_max', models.IntegerField(help_text='Bottom edge pixel')),
                ('confidence', models.FloatField(help_text='Detection confidence 0-1')),
                ('canopy_diameter_m', models.FloatField(blank=True, help_text='Estimated canopy diameter from bbox + resolution', null=True)),
                ('ndvi_mean', models.FloatField(blank=True, null=True)),
                ('ndvi_min', models.FloatField(blank=True, null=True)),
                ('ndvi_max', models.FloatField(blank=True, null=True)),
                ('health_category', models.CharField(choices=[('healthy', 'Healthy'), ('moderate', 'Moderate Stress'), ('stressed', 'Stressed'), ('critical', 'Critical'), ('unknown', 'Unknown')], default='unknown', max_length=20)),
                ('survey', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='detected_trees', to='api.treesurvey')),
            ],
        ),
        migrations.AddIndex(
            model_name='detectedtree',
            index=models.Index(fields=['survey'], name='api_dettree_survey_idx'),
        ),
        migrations.AddIndex(
            model_name='detectedtree',
            index=models.Index(fields=['health_category'], name='api_dettree_health_idx'),
        ),
        migrations.AddIndex(
            model_name='detectedtree',
            index=models.Index(fields=['latitude', 'longitude'], name='api_dettree_latlon_idx'),
        ),
    ]
