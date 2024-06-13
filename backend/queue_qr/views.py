from datetime import date
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Queue, QueueTicket, ApiStatus
import qrcode
from django.http import HttpResponse
from io import BytesIO
from rest_framework.authtoken.models import Token
from django.db.models import Count
from accounts.models import ManagerActionLog, DailyTicketReport
from gtts import gTTS
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)


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
    queue_type = request.data.get('type')
    if not queue_type:
        return Response({"error": "Queue type is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        queue = Queue.objects.get(type=queue_type)
    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        last_ticket_number = QueueTicket.objects.order_by(
            '-number').first().number if QueueTicket.objects.exists() else 0
        new_ticket_number = (last_ticket_number % 500) + 1

        ticket = QueueTicket.objects.create(queue=queue, number=new_ticket_number)

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "send_queue_update",
                "text": {"message": f"New ticket {ticket.number} created for {queue_type} queue."}
            }
        )

        return Response({"ticket": ticket.number, "token": ticket.token}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error creating queue ticket: {str(e)}")
        return Response({"error": "An error occurred while joining the queue"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
@api_enabled_required
def get_queues(request):
    queues = Queue.objects.all().annotate(ticket_count=Count('queueticket'))
    result = []

    latest_tickets_per_manager = {}

    for queue in queues:
        ticket_numbers = list(queue.queueticket_set.filter(served=False).values_list('number', flat=True))

        serving_tickets = queue.queueticket_set.filter(served=True).select_related('serving_manager').order_by('-id')

        for serving_ticket in serving_tickets:
            manager_username = serving_ticket.serving_manager.username if serving_ticket.serving_manager else 'Unknown'
            if manager_username not in latest_tickets_per_manager:
                latest_tickets_per_manager[manager_username] = {
                    'ticket_number': serving_ticket.number,
                    'manager_username': manager_username
                }

        result.append({
            'Очередь': queue.type,
            'Зарегестрированные талоны': ticket_numbers,
        })

    result.append({
        'Все обслуживаемые талоны': list(latest_tickets_per_manager.values())
    })

    return Response(result)



@api_view(['GET'])
@permission_classes([AllowAny])
@api_enabled_required
def generate_qr(request):
    img = qrcode.make('http://localhost:3000/join-queue/')
    response = HttpResponse(content_type="image/png")
    img.save(response, "PNG")
    return response

@api_view(['GET'])
@permission_classes([AllowAny])
@api_enabled_required
def current_serving(request):
    queues = Queue.objects.all()
    data = {}
    for queue in queues:
        data[queue.type] = queue.currently_serving
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_queue(request):
    queue_type = request.data.get('type')
    try:
        queue = Queue.objects.get(type=queue_type)
        queue.current_number = 0
        queue.save()

        QueueTicket.objects.filter(queue=queue).delete()

        return Response({"message": f"{queue_type} queue has been reset."}, status=status.HTTP_200_OK)
    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_next(request):
    queue_type = request.data.get('type')
    try:
        queue = Queue.objects.get(type=queue_type)
        ticket = QueueTicket.objects.filter(queue=queue, served=False).order_by('number').first()
        if ticket is None:
            return Response({"message": "Queue is empty."}, status=status.HTTP_200_OK)

        ticket.served = True
        ticket.serving_manager = request.user
        ticket.save()

        queue.currently_serving = ticket.number
        queue.save()

        text_to_speak = f"Талон под номером {ticket.number}, подойдите к {request.user.username}."
        tts = gTTS(text=text_to_speak, lang='ru')
        audio_filename = f"ticket_{ticket.number}.mp3"
        audio_path = os.path.join(settings.MEDIA_ROOT, audio_filename)
        tts.save(audio_path)
        audio_url = request.build_absolute_uri(settings.MEDIA_URL + audio_filename)

        # Log the action
        logger.debug(f"Ticket {ticket.number} called by {request.user.username}")

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "queue.ticket_called",
                "message": {
                    "queue_type": queue_type,
                    "ticket_number": ticket.number,
                    "manager_username": request.user.username,
                    "audio_url": audio_url
                }
            }
        )
        # Log the WebSocket message
        logger.debug(f"WebSocket message sent for ticket {ticket.number} in queue {queue_type}")

        return Response({
            "ticket_number": ticket.number,
            "audio_url": audio_url
        }, status=status.HTTP_200_OK)

    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)






# When a manager calls a ticket
def increment_ticket_count(manager):
    report, created = DailyTicketReport.objects.get_or_create(manager=manager, date=date.today(), defaults={'ticket_count': 0})
    report.ticket_count += 1
    report.save()




from django.http import JsonResponse
@api_view(['POST'])
#@permission_classes([IsAuthenticated])
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