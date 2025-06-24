from rest_framework import serializers
from .models import Queue, QueueTicket, QueueType


class QueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Queue
        fields = ['type', 'current_number']


class QueueTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueueTicket
        fields = ['id', 'number', 'full_name', 'queue_type', 'token', 'served', 'created_at']
        read_only_fields = ['id', 'number', 'token', 'served', 'created_at']


class JoinQueueSerializer(serializers.Serializer):
    VALID_QUEUE_TYPES = [
        'BACHELOR_GRANT',
        'BACHELOR_PAID',
        'MASTER',
        'PHD',
        'PLATONUS'
    ]

    type = serializers.ChoiceField(choices=VALID_QUEUE_TYPES)
    full_name = serializers.CharField(max_length=255, required=True)

    def validate_full_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("ФИО обязательно для заполнения")
        return value.strip()

    def validate_type(self, value):
        """Проверяем, что тип очереди существует в базе"""
        if not QueueType.objects.filter(name=value).exists():
            raise serializers.ValidationError(f"Тип очереди '{value}' не найден")
        return value


class QueueTypeSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='get_name_display', read_only=True)

    class Meta:
        model = QueueType
        fields = ['name', 'display_name', 'min_ticket_number', 'max_ticket_number']