# your_app/management/commands/reset_queues.py

from django.core.management.base import BaseCommand
from queue_qr.models import Queue

class Command(BaseCommand):
    help = 'Resets the tickets in the queues'

    def handle(self, *args, **kwargs):
        queues = Queue.objects.filter(type__in=[Queue.BACHELOR, Queue.MASTER, Queue.PHD])
        for queue in queues:
            queue.reset_tickets()
            self.stdout.write(self.style.SUCCESS(f'Successfully reset queue: {queue.type}'))
