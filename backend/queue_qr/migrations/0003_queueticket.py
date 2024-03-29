# Generated by Django 4.2.6 on 2023-10-17 11:25

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('queue_qr', '0002_queue_currently_serving'),
    ]

    operations = [
        migrations.CreateModel(
            name='QueueTicket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('number', models.PositiveIntegerField()),
                ('queue', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='queue_qr.queue')),
            ],
        ),
    ]
