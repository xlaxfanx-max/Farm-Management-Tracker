"""Let REIPostingRecord be sourced from ApplicationEvent (tank-mix flow).

Sprays recorded through the modern ApplicationEvent flow previously never
produced REI postings — the worker-safety ticker and REI alerts only saw
legacy PesticideApplication records.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0083_add_moa_and_cost_to_pur_product'),
    ]

    operations = [
        migrations.AlterField(
            model_name='reipostingrecord',
            name='application',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='rei_posting',
                to='api.pesticideapplication',
            ),
        ),
        migrations.AddField(
            model_name='reipostingrecord',
            name='event',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='rei_posting',
                to='api.applicationevent',
            ),
        ),
        migrations.AddConstraint(
            model_name='reipostingrecord',
            constraint=models.CheckConstraint(
                check=(
                    (models.Q(application__isnull=False) & models.Q(event__isnull=True))
                    | (models.Q(application__isnull=True) & models.Q(event__isnull=False))
                ),
                name='rei_posting_exactly_one_source',
            ),
        ),
    ]
