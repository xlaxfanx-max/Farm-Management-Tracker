"""
Map PUR ApplicationEvent to Farm instead of Field.
- Add farm FK (required) to ApplicationEvent
- Make field FK nullable on ApplicationEvent
- Add pur_site_id to Farm model
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0077_pur_rls_policies'),
    ]

    operations = [
        # 1. Add farm FK to ApplicationEvent (nullable first for safety)
        migrations.AddField(
            model_name='applicationevent',
            name='farm',
            field=models.ForeignKey(
                help_text='PUR reports are filed at the farm/ranch level',
                null=True,  # Temporary: will be set to non-null after data backfill
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='application_events',
                to='api.farm',
            ),
        ),

        # 2. Make field FK nullable on ApplicationEvent
        migrations.AlterField(
            model_name='applicationevent',
            name='field',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional: specific field within the farm',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='application_events',
                to='api.field',
            ),
        ),

        # 3. Backfill farm from field.farm for any existing rows
        migrations.RunSQL(
            sql="""
                UPDATE api_applicationevent
                SET farm_id = f.farm_id
                FROM api_field f
                WHERE api_applicationevent.field_id = f.id
                  AND api_applicationevent.farm_id IS NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # 4. Add pur_site_id to Farm model
        migrations.AddField(
            model_name='farm',
            name='pur_site_id',
            field=models.CharField(
                blank=True,
                help_text="Ag Commissioner site ID for PUR matching, e.g., 'FINCH FARMS, LLC 02C'",
                max_length=100,
                default='',
            ),
            preserve_default=False,
        ),
    ]
