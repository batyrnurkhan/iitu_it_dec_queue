from rest_framework import serializers
from .models import Queue, QueueTicket


class QueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Queue
        fields = ['type', 'current_number']


class QueueTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueueTicket
        fields = ['id', 'number', 'full_name', 'queue', 'token', 'served', 'created_at']
        read_only_fields = ['id', 'number', 'token', 'served', 'created_at']


class JoinQueueSerializer(serializers.Serializer):
    type = serializers.CharField(max_length=10)
    full_name = serializers.CharField(max_length=255, required=True)

    def validate_full_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("ФИО обязательно для заполнения")
        return value.strip()