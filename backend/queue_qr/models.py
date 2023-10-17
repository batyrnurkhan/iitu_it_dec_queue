from django.db import models

class Queue(models.Model):
    BACHELOR = 'BACHELOR'
    MASTER = 'MASTER'
    PHD = 'PHD'

    QUEUE_CHOICES = [
        (BACHELOR, 'Bachelor'),
        (MASTER, 'Master'),
        (PHD, 'PhD'),
    ]

    type = models.CharField(max_length=10, choices=QUEUE_CHOICES)
    current_number = models.IntegerField(default=0)

    def __str__(self):
        return self.type
