# Generated migration for batch upload feature

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0035_fsma_compliance_module'),
    ]

    operations = [
        # Create StatementBatchUpload model first (since PackinghouseStatement references it)
        migrations.CreateModel(
            name='StatementBatchUpload',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('batch_id', models.UUIDField(editable=False, help_text='Unique identifier for this batch', unique=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('partial', 'Partial Success'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('total_files', models.PositiveIntegerField(default=0, help_text='Total number of files in batch')),
                ('processed_count', models.PositiveIntegerField(default=0, help_text='Number of files processed')),
                ('success_count', models.PositiveIntegerField(default=0, help_text='Number of successfully extracted files')),
                ('failed_count', models.PositiveIntegerField(default=0, help_text='Number of failed extractions')),
                ('error_message', models.TextField(blank=True, help_text='Error message if batch failed')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, help_text='When processing completed', null=True)),
                ('packinghouse', models.ForeignKey(help_text='Packinghouse these statements are from', on_delete=django.db.models.deletion.CASCADE, related_name='batch_uploads', to='api.packinghouse')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='batch_uploads', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Statement Batch Upload',
                'verbose_name_plural': 'Statement Batch Uploads',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='statementbatchupload',
            index=models.Index(fields=['batch_id'], name='idx_batch_id'),
        ),
        migrations.AddIndex(
            model_name='statementbatchupload',
            index=models.Index(fields=['packinghouse', '-created_at'], name='idx_batch_pkghs'),
        ),
        migrations.AddIndex(
            model_name='statementbatchupload',
            index=models.Index(fields=['status'], name='idx_batch_status'),
        ),

        # Create PackinghouseGrowerMapping model
        migrations.CreateModel(
            name='PackinghouseGrowerMapping',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('grower_name_pattern', models.CharField(help_text='Grower name as it appears in statements (e.g., "THACKER FARMS")', max_length=255)),
                ('grower_id_pattern', models.CharField(blank=True, help_text='Grower ID as it appears in statements (e.g., "THACR641")', max_length=100)),
                ('block_name_pattern', models.CharField(blank=True, help_text='Block/ranch name pattern for field-level matching', max_length=100)),
                ('use_count', models.PositiveIntegerField(default=1, help_text='Number of times this mapping has been used')),
                ('last_used_at', models.DateTimeField(auto_now=True, help_text='When this mapping was last used')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_grower_mappings', to=settings.AUTH_USER_MODEL)),
                ('created_from_statement', models.ForeignKey(blank=True, help_text='Statement that created this mapping', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_mappings', to='api.packinghousestatement')),
                ('farm', models.ForeignKey(help_text='Farm this grower name maps to', on_delete=django.db.models.deletion.CASCADE, related_name='packinghouse_mappings', to='api.farm')),
                ('field', models.ForeignKey(blank=True, help_text='Optional specific field this block name maps to', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='packinghouse_mappings', to='api.field')),
                ('packinghouse', models.ForeignKey(help_text='Packinghouse this mapping applies to', on_delete=django.db.models.deletion.CASCADE, related_name='grower_mappings', to='api.packinghouse')),
            ],
            options={
                'verbose_name': 'Packinghouse Grower Mapping',
                'verbose_name_plural': 'Packinghouse Grower Mappings',
                'ordering': ['-use_count', '-last_used_at'],
                'unique_together': {('packinghouse', 'grower_name_pattern', 'block_name_pattern')},
            },
        ),
        migrations.AddIndex(
            model_name='packinghousegrowermapping',
            index=models.Index(fields=['packinghouse', 'grower_name_pattern'], name='idx_mapping_grower'),
        ),
        migrations.AddIndex(
            model_name='packinghousegrowermapping',
            index=models.Index(fields=['packinghouse', 'grower_id_pattern'], name='idx_mapping_grower_id'),
        ),
        migrations.AddIndex(
            model_name='packinghousegrowermapping',
            index=models.Index(fields=['farm'], name='idx_mapping_farm'),
        ),

        # Add batch_upload field to PackinghouseStatement
        migrations.AddField(
            model_name='packinghousestatement',
            name='batch_upload',
            field=models.ForeignKey(blank=True, help_text='Batch this statement belongs to (if uploaded via batch)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='statements', to='api.statementbatchupload'),
        ),

        # Add auto_match_result field to PackinghouseStatement
        migrations.AddField(
            model_name='packinghousestatement',
            name='auto_match_result',
            field=models.JSONField(blank=True, default=dict, help_text='Auto-matching result with confidence scores'),
        ),
    ]
