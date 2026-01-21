# Generated migration for PackinghouseStatement model
# and source_statement fields on PackoutReport and PoolSettlement

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0030_packinghouse_pool_tracking'),
    ]

    operations = [
        # Create PackinghouseStatement model
        migrations.CreateModel(
            name='PackinghouseStatement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pdf_file', models.FileField(help_text='Uploaded PDF file', upload_to='packinghouse_statements/%Y/%m/')),
                ('original_filename', models.CharField(help_text='Original filename of uploaded PDF', max_length=255)),
                ('file_size_bytes', models.PositiveIntegerField(help_text='File size in bytes')),
                ('statement_type', models.CharField(blank=True, choices=[('packout', 'Packout Statement'), ('settlement', 'Pool Settlement'), ('wash_report', 'Wash Report'), ('grower_statement', 'Grower Pool Statement')], help_text='Type of statement (auto-detected or user-specified)', max_length=20)),
                ('packinghouse_format', models.CharField(choices=[('vpoa', 'Villa Park Orchards (VPOA)'), ('sla', 'Saticoy Lemon Association (SLA)'), ('generic', 'Generic/Other')], default='generic', help_text='Format/template used by packinghouse (auto-detected)', max_length=20)),
                ('status', models.CharField(choices=[('uploaded', 'Uploaded'), ('extracting', 'Extracting'), ('extracted', 'Extracted'), ('review', 'Awaiting Review'), ('completed', 'Completed'), ('failed', 'Extraction Failed')], default='uploaded', max_length=20)),
                ('extracted_data', models.JSONField(blank=True, default=dict, help_text='Raw extracted data from PDF for preview/editing')),
                ('extraction_confidence', models.DecimalField(blank=True, decimal_places=2, help_text='AI confidence in extraction accuracy', max_digits=3, null=True)),
                ('extraction_error', models.TextField(blank=True, help_text='Error message if extraction failed')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('packinghouse', models.ForeignKey(help_text='Packinghouse this statement is from', on_delete=django.db.models.deletion.CASCADE, related_name='statements', to='api.packinghouse')),
                ('pool', models.ForeignKey(blank=True, help_text='Pool this statement belongs to (set during confirmation)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_statements', to='api.pool')),
                ('field', models.ForeignKey(blank=True, help_text='Field this statement is for (set during confirmation)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_statements', to='api.field')),
                ('uploaded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_statements', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Packinghouse Statement',
                'verbose_name_plural': 'Packinghouse Statements',
                'ordering': ['-created_at'],
            },
        ),
        # Add indexes for PackinghouseStatement
        migrations.AddIndex(
            model_name='packinghousestatement',
            index=models.Index(fields=['packinghouse', '-created_at'], name='idx_stmt_pkghs_created'),
        ),
        migrations.AddIndex(
            model_name='packinghousestatement',
            index=models.Index(fields=['status'], name='idx_stmt_status'),
        ),
        migrations.AddIndex(
            model_name='packinghousestatement',
            index=models.Index(fields=['statement_type'], name='idx_stmt_type'),
        ),
        # Add source_statement field to PackoutReport
        migrations.AddField(
            model_name='packoutreport',
            name='source_statement',
            field=models.OneToOneField(blank=True, help_text='Source PDF statement if created via upload', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='packout_report', to='api.packinghousestatement'),
        ),
        # Add source_statement field to PoolSettlement
        migrations.AddField(
            model_name='poolsettlement',
            name='source_statement',
            field=models.OneToOneField(blank=True, help_text='Source PDF statement if created via upload', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pool_settlement', to='api.packinghousestatement'),
        ),
    ]
