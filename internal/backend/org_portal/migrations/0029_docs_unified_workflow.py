from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('org_portal', '0028_formsubmission_archive'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documenttemplate',
            name='category',
            field=models.CharField(
                max_length=20,
                default='required',
                choices=[
                    ('required',    'Required'),
                    ('policy',      'Policy'),
                    ('form',        'Form'),
                    ('certificate', 'Certificate'),
                    ('agreement',   'Agreement'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='documenttemplate',
            name='allow_resign',
            field=models.BooleanField(
                default=False,
                help_text='Allow member to re-sign after already signing',
            ),
        ),
        migrations.AlterField(
            model_name='memberdocument',
            name='status',
            field=models.CharField(
                max_length=20,
                default='assigned',
                choices=[
                    ('assigned',       'Assigned'),
                    ('uploaded',       'Uploaded'),
                    ('pending_review', 'Pending Review'),
                    ('approved',       'Approved'),
                    ('rejected',       'Rejected'),
                    ('signed',         'Signed'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='memberdocument',
            name='consent_ip',
            field=models.GenericIPAddressField(null=True, blank=True),
        ),
    ]
