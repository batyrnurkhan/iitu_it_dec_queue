from datetime import datetime, time
from django.db.models import Count, Q
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Queue, QueueTicket, ApiStatus, QueueType
from .serializers import JoinQueueSerializer, QueueTypeSerializer
import qrcode
from django.http import HttpResponse, JsonResponse
from io import BytesIO
from rest_framework.authtoken.models import Token
from accounts.models import ManagerActionLog, DailyTicketReport, Table
from gtts import gTTS
from django.conf import settings
import os
import logging
from accounts.models import CustomUser

logger = logging.getLogger(__name__)


def broadcast_ticket_count_update(manager_type):
    try:
        queue_type = QueueType.objects.get(name=manager_type)
        tickets_count = QueueTicket.objects.filter(
            queue_type=queue_type,
            served=False
        ).count()

        ticket_counts = {manager_type: tickets_count}

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "queue_ticket_count_update",
                "message": {"ticket_counts": ticket_counts}
            }
        )
    except QueueType.DoesNotExist:
        print(f"QueueType {manager_type} not found")


def is_within_restricted_hours():
    now = datetime.now().time()
    start_time = time(6, 0)
    end_time = time(22, 30)
    if start_time <= now or now <= end_time:
        return False
    return True


def api_enabled_required(func):
    def wrapper(request, *args, **kwargs):
        api_status, created = ApiStatus.objects.get_or_create(name='API_STATUS')
        if not api_status.status:
            return JsonResponse({'error': 'API is currently disabled.'}, status=403)
        return func(request, *args, **kwargs)
    return wrapper


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def join_queue(request):
    print("Request received")
    if is_within_restricted_hours():
        print("Request made outside working hours")
        return Response({"message": "НЕ РАБОЧЕЕ ВРЕМЯ"}, status=status.HTTP_200_OK)

    # Используем сериализатор для валидации данных
    serializer = JoinQueueSerializer(data=request.data)
    if not serializer.is_valid():
        print(f"Validation errors: {serializer.errors}")
        return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    queue_type_name = serializer.validated_data['type']
    full_name = serializer.validated_data['full_name']

    print(f"Queue type: {queue_type_name}, Full name: {full_name}")

    try:
        queue_type = QueueType.objects.get(name=queue_type_name)
        print(f"Queue type found: {queue_type}")
    except QueueType.DoesNotExist:
        print("Queue type not found")
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Используем новый метод для получения следующего номера
        new_ticket_number = queue_type.get_next_ticket_number()
        print(f"New ticket number: {new_ticket_number}")

        # Создаем талон
        ticket = QueueTicket.objects.create(
            queue_type=queue_type,
            number=new_ticket_number,
            full_name=full_name
        )
        print(f"New ticket created: Ticket {ticket.number} for {ticket.full_name}")

        # Отправляем WebSocket уведомления
        broadcast_new_ticket(ticket)
        broadcast_ticket_count_update(queue_type_name)

        print("WebSocket notifications sent")

        return Response({
            "ticket": ticket.number,
            "ticket_id": ticket.id,
            "full_name": ticket.full_name,
            "queue_type": queue_type_name,
            "queue_type_display": queue_type.get_name_display(),
            "token": ticket.token
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        print(f"Error creating queue ticket: {str(e)}")
        logger.error(f"Error creating queue ticket: {str(e)}")
        return Response({"error": "An error occurred while joining the queue"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def broadcast_new_ticket(ticket):
    """Уведомление о создании нового талона"""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "queues",
        {
            "type": "new_ticket_created",
            "message": {
                "queue_type": ticket.queue_type.name,
                "queue_type_display": ticket.queue_type.get_name_display(),
                "ticket_number": ticket.number,
                "full_name": ticket.full_name,
                "timestamp": ticket.created_at.isoformat()
            }
        }
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_queues(request):
    queue_types = QueueType.objects.all()
    result = []

    latest_tickets_per_manager = {}
    for queue_type in queue_types:
        # Получаем необслуженные талоны для этого типа очереди
        waiting_tickets = QueueTicket.objects.filter(
            queue_type=queue_type,
            served=False
        ).order_by('created_at').values('number', 'full_name')

        ticket_info = [{"number": ticket['number'], "full_name": ticket['full_name']} for ticket in waiting_tickets]

        # Получаем обслуживаемые талоны - ИСПРАВЛЕНО: добавляем full_name
        serving_tickets = QueueTicket.objects.filter(
            queue_type=queue_type,
            served=True
        ).select_related('serving_manager').order_by('-id')

        for serving_ticket in serving_tickets:
            manager_username = serving_ticket.serving_manager.username if serving_ticket.serving_manager else 'Unknown'
            if manager_username not in latest_tickets_per_manager:
                latest_tickets_per_manager[manager_username] = {
                    'ticket_number': serving_ticket.number,
                    'full_name': serving_ticket.full_name,  # ✅ ФИО уже есть!
                    'manager_username': manager_username,
                    'queue_type': serving_ticket.queue_type.name,
                    'queue_type_display': serving_ticket.queue_type.get_name_display()
                }

        result.append({
            'Очередь': queue_type.get_name_display(),
            'queue_type_code': queue_type.name,
            'Зарегестрированные талоны': ticket_info,
        })

    result.append({
        'Все обслуживаемые талоны': list(latest_tickets_per_manager.values())
    })

    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_queue_types(request):
    """Новый endpoint для получения всех типов очередей"""
    queue_types = QueueType.objects.all()
    serializer = QueueTypeSerializer(queue_types, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
@api_enabled_required
def generate_qr(request):
    img = qrcode.make('https://queue.iitu.edu.kz/join-queue/')
    response = HttpResponse(content_type="image/png")
    img.save(response, "PNG")
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
@api_enabled_required
def current_serving(request):
    queue_types = QueueType.objects.all()
    data = {}
    for queue_type in queue_types:
        # Находим последний обслуженный талон для этого типа
        last_served = QueueTicket.objects.filter(
            queue_type=queue_type,
            served=True
        ).order_by('-id').first()

        data[queue_type.name] = {
            'last_served_number': last_served.number if last_served else 0,
            'queue_type_display': queue_type.get_name_display()
        }
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_queue(request):
    queue_type_name = request.data.get('type')
    try:
        queue_type = QueueType.objects.get(name=queue_type_name)

        # Удаляем все талоны этого типа
        deleted_count = QueueTicket.objects.filter(queue_type=queue_type).count()
        QueueTicket.objects.filter(queue_type=queue_type).delete()

        return Response({
            "message": f"Очередь '{queue_type.get_name_display()}' сброшена. Удалено талонов: {deleted_count}"
        }, status=status.HTTP_200_OK)
    except QueueType.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)


def increment_ticket_count(manager):
    report, created = DailyTicketReport.objects.get_or_create(
        manager=manager, date=datetime.today(), defaults={'ticket_count': 0}
    )
    report.ticket_count += 1
    report.save()


def log_manager_action(manager, action_description, ticket_number=None, full_name=None, queue_type=None):
    from accounts.models import ManagerActionLog

    action_text = action_description
    if full_name:
        action_text += f" ({full_name})"
    if queue_type:
        action_text += f" - {queue_type}"

    ManagerActionLog.objects.create(
        manager=manager,
        action=action_text,
        ticket_number=ticket_number,
        queue_type=queue_type,
        timestamp=datetime.now()
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_next(request):
    queue_type_name = request.data.get('type')

    # Проверяем, может ли менеджер обслуживать этот тип очереди
    if not request.user.can_serve_queue_type(queue_type_name):
        return Response({
            "error": f"У вас нет разрешения на обслуживание очереди '{queue_type_name}'. "
                     f"Разрешенные типы: {', '.join(request.user.get_allowed_queue_types())}"
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        queue_type = QueueType.objects.get(name=queue_type_name)

        ticket = QueueTicket.objects.filter(
            queue_type=queue_type,
            served=False
        ).order_by('created_at').first()

        if ticket is None:
            return Response({"message": "Queue is empty."}, status=status.HTTP_200_OK)

        ticket.served = True
        ticket.serving_manager = request.user
        ticket.save()

        ticket_number = ticket.number
        full_name = ticket.full_name
        manager_location = request.user.get_manager_location()

        # Создаем TTS для объявления
        tts_text = f"Талон номер {ticket_number}, подойдите к {manager_location}."

        tts = gTTS(tts_text, lang='ru')

        audio_filename = f"ticket_{ticket_number}_{request.user.username}.mp3"
        audio_path = os.path.join(settings.MEDIA_ROOT, audio_filename)
        tts.save(audio_path)

        audio_url = request.build_absolute_uri(settings.MEDIA_URL + audio_filename)

        # Отправляем WebSocket уведомление
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "queue.ticket_called",
                "message": {
                    "queue_type": queue_type_name,
                    "queue_type_display": queue_type.get_name_display(),
                    "ticket_id": ticket.id,
                    "ticket_number": ticket.number,
                    "full_name": full_name,
                    "manager_username": request.user.username,
                    "manager_location": manager_location,
                    "audio_url": audio_url
                }
            }
        )

        broadcast_ticket_count_update(queue_type_name)
        increment_ticket_count(request.user)

        # Обновленное логирование с типом очереди
        log_manager_action(
            request.user,
            f"Вызван талон: {ticket.number}",
            ticket.number,
            full_name,
            queue_type_name
        )

        return Response({
            "ticket_id": ticket.id,
            "ticket_number": ticket.number,
            "full_name": full_name,
            "queue_type": queue_type_name,
            "queue_type_display": queue_type.get_name_display(),
            "manager_location": manager_location,
            "audio_url": audio_url
        }, status=status.HTTP_200_OK)

    except QueueType.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        print(f"Error in call_next: {str(e)}")
        return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def delete_audio(request):
    audio_filename = request.data.get('audio_filename')

    if not audio_filename:
        return JsonResponse({"error": "Filename not provided"}, status=status.HTTP_400_BAD_REQUEST)

    audio_path = os.path.join(settings.MEDIA_ROOT, audio_filename)

    if os.path.exists(audio_path):
        os.remove(audio_path)
        return JsonResponse({"message": "Audio deleted successfully"}, status=status.HTTP_200_OK)
    else:
        return JsonResponse({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)