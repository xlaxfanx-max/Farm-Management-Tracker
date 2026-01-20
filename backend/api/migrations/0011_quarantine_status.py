"""
Migration to add QuarantineStatus model for HLB quarantine tracking.

Includes Row-Level Security (RLS) policy to ensure tenant isolation.
QuarantineStatus records are accessible based on their linked farm/field's company.
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_weathercache'),
    ]

    operations = [
        # Create the QuarantineStatus model
        migrations.CreateModel(
            name='QuarantineStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quarantine_type', models.CharField(
                    choices=[
                        ('HLB', 'Huanglongbing (Citrus Greening)'),
                        ('ACP_BULK', 'Asian Citrus Psyllid Bulk Citrus')
                    ],
                    default='HLB',
                    help_text='Type of quarantine check',
                    max_length=20
                )),
                ('in_quarantine', models.BooleanField(
                    blank=True,
                    help_text='True if in quarantine, False if not, null if unknown/error',
                    null=True
                )),
                ('zone_name', models.CharField(
                    blank=True,
                    help_text='Name of the quarantine zone if applicable',
                    max_length=255
                )),
                ('last_checked', models.DateTimeField(
                    auto_now=True,
                    help_text='When the status was last checked'
                )),
                ('last_changed', models.DateTimeField(
                    blank=True,
                    help_text='When the quarantine status actually changed',
                    null=True
                )),
                ('check_latitude', models.DecimalField(
                    blank=True,
                    decimal_places=7,
                    help_text='Latitude used for the check',
                    max_digits=10,
                    null=True
                )),
                ('check_longitude', models.DecimalField(
                    blank=True,
                    decimal_places=7,
                    help_text='Longitude used for the check',
                    max_digits=10,
                    null=True
                )),
                ('raw_response', models.JSONField(
                    blank=True,
                    help_text='Raw response from CDFA API for debugging',
                    null=True
                )),
                ('error_message', models.TextField(
                    blank=True,
                    help_text='Error message if the check failed'
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('farm', models.ForeignKey(
                    blank=True,
                    help_text='Farm being checked for quarantine status',
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='quarantine_statuses',
                    to='api.farm'
                )),
                ('field', models.ForeignKey(
                    blank=True,
                    help_text='Field being checked for quarantine status',
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='quarantine_statuses',
                    to='api.field'
                )),
            ],
            options={
                'verbose_name': 'Quarantine Status',
                'verbose_name_plural': 'Quarantine Statuses',
                'ordering': ['-last_checked'],
            },
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='quarantinestatus',
            index=models.Index(fields=['farm', 'quarantine_type'], name='api_quarant_farm_id_idx'),
        ),
        migrations.AddIndex(
            model_name='quarantinestatus',
            index=models.Index(fields=['field', 'quarantine_type'], name='api_quarant_field_i_idx'),
        ),
        migrations.AddIndex(
            model_name='quarantinestatus',
            index=models.Index(fields=['last_checked'], name='api_quarant_last_ch_idx'),
        ),
        # Add unique constraints
        migrations.AddConstraint(
            model_name='quarantinestatus',
            constraint=models.UniqueConstraint(
                condition=models.Q(('farm__isnull', False)),
                fields=('farm', 'quarantine_type'),
                name='unique_farm_quarantine_type'
            ),
        ),
        migrations.AddConstraint(
            model_name='quarantinestatus',
            constraint=models.UniqueConstraint(
                condition=models.Q(('field__isnull', False)),
                fields=('field', 'quarantine_type'),
                name='unique_field_quarantine_type'
            ),
        ),
        # Add RLS policy for tenant isolation
        # QuarantineStatus inherits company from farm or field->farm
        migrations.RunSQL(
            sql="""
                ALTER TABLE api_quarantinestatus ENABLE ROW LEVEL SECURITY;

                DROP POLICY IF EXISTS tenant_isolation ON api_quarantinestatus;

                CREATE POLICY tenant_isolation ON api_quarantinestatus
                    FOR ALL
                    USING (
                        -- Check farm's company directly
                        (farm_id IS NOT NULL AND farm_id IN (
                            SELECT id FROM api_farm
                            WHERE company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                        ))
                        OR
                        -- Check field's farm's company
                        (field_id IS NOT NULL AND field_id IN (
                            SELECT f.id FROM api_field f
                            JOIN api_farm fm ON f.farm_id = fm.id
                            WHERE fm.company_id = NULLIF(current_setting('app.current_company_id', true), '')::integer
                        ))
                    );

                ALTER TABLE api_quarantinestatus FORCE ROW LEVEL SECURITY;
            """,
            reverse_sql="""
                DROP POLICY IF EXISTS tenant_isolation ON api_quarantinestatus;
                ALTER TABLE api_quarantinestatus DISABLE ROW LEVEL SECURITY;
            """,
        ),
    ]
