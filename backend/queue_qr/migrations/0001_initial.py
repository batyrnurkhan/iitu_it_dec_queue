# Generated by Django 4.2.6 on 2023-10-16 18:27

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Queue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('BACHELOR', 'Bachelor'), ('MASTER', 'Master'), ('PHD', 'PhD')], max_length=10)),
                ('current_number', models.IntegerField(default=0)),
            ],
        ),
    ]
