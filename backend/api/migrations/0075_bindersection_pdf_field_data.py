from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0074_merge_20260223_1024'),
    ]

    operations = [
        migrations.AddField(
            model_name='bindersection',
            name='pdf_field_data',
            field=models.JSONField(
                blank=True,
                help_text="PDF form field values keyed by AcroForm field names, e.g. {'1-a-100': 'Sunrise Ranch'}",
                null=True,
            ),
        ),
    ]
