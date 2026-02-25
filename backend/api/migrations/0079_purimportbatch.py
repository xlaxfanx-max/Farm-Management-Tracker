"""
Add PURImportBatch model for tracking import history + make farm non-null.
"""

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0078_pur_farm_mapping'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Make farm FK non-nullable (backfill was done in 0078)
        migrations.AlterField(
            model_name='applicationevent',
            name='farm',
            field=models.ForeignKey(
                help_text='PUR reports are filed at the farm/ranch level',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='application_events',
                to='api.farm',
            ),
        ),

        # 2. Create PURImportBatch model
        migrations.CreateModel(
            name='PURImportBatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('batch_id', models.CharField(db_index=True, default=uuid.uuid4, help_text='Unique batch identifier linking to ApplicationEvent.import_batch_id', max_length=36, unique=True)),
                ('source_pdf', models.FileField(help_text='Original uploaded PUR PDF', upload_to='pur_imports/%Y/%m/')),
                ('filename', models.CharField(max_length=255)),
                ('report_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pur_import_batches', to='api.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pur_import_batches', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
