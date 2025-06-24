from django.core.management.base import BaseCommand
from queue_qr.models import QueueType


class Command(BaseCommand):
    help = 'Create default queue types with ticket number ranges'

    def handle(self, *args, **options):
        queue_types_data = [
            {
                'name': 'BACHELOR_GRANT',
                'min_ticket_number': 1,
                'max_ticket_number': 499,
            },
            {
                'name': 'BACHELOR_PAID',
                'min_ticket_number': 500,
                'max_ticket_number': 599,
            },
            {
                'name': 'MASTER',
                'min_ticket_number': 600,
                'max_ticket_number': 699,
            },
            {
                'name': 'PHD',
                'min_ticket_number': 700,
                'max_ticket_number': 799,
            },
            {
                'name': 'PLATONUS',
                'min_ticket_number': 800,
                'max_ticket_number': 999,
            },
        ]

        for queue_data in queue_types_data:
            queue_type, created = QueueType.objects.get_or_create(
                name=queue_data['name'],
                defaults={
                    'min_ticket_number': queue_data['min_ticket_number'],
                    'max_ticket_number': queue_data['max_ticket_number'],
                }
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Создан тип очереди: {queue_type.get_name_display()} '
                        f'({queue_data["min_ticket_number"]}-{queue_data["max_ticket_number"]})'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'Тип очереди уже существует: {queue_type.get_name_display()}'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS('Все типы очередей созданы успешно!')
        )