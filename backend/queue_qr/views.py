from datetime import datetime, time
from django.db.models import Count, Q
import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Queue, QueueTicket, ApiStatus
import qrcode
from django.http import HttpResponse, JsonResponse
from io import BytesIO
from rest_framework.authtoken.models import Token
from accounts.models import ManagerActionLog, DailyTicketReport
from gtts import gTTS
from django.conf import settings
import os
import logging
from accounts.models import CustomUser


logger = logging.getLogger(__name__)

def broadcast_ticket_count_update(manager_type):
    queues = Queue.objects.filter(type=manager_type).annotate(
        ticket_count=Count('queueticket', filter=Q(queueticket__served=False)))
    ticket_counts = {queue.type: queue.ticket_count for queue in queues}

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "queues",
        {
            "type": "queue_ticket_count_update",
            "message": {"ticket_counts": ticket_counts}
        }
    )

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



def adjust_ticket_number(queue_type, last_ticket_number):
    if queue_type == 'BACHELOR':
        if last_ticket_number < 400:
            return last_ticket_number + 1
        else:
            return 1
    elif queue_type == 'MASTER':
        if 400 <= last_ticket_number < 450:
            return last_ticket_number + 1
        else:
            return 401
    elif queue_type == 'PHD':
        if 450 <= last_ticket_number < 500:
            return last_ticket_number + 1
        else:
            return 451
    return 1



@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def join_queue(request):
    print("Request received")  # Debug print
    if is_within_restricted_hours():
        print("Request made outside working hours")  # Debug print
        return Response({"message": "НЕ РАБОЧЕЕ ВРЕМЯ"}, status=status.HTTP_200_OK)

    queue_type = request.data.get('type')
    print(f"Queue type: {queue_type}")  # Debug print
    if not queue_type:
        print("Queue type not provided")  # Debug print
        return Response({"error": "Queue type is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        queue = Queue.objects.get(type=queue_type)
        print(f"Queue found: {queue}")  # Debug print
    except Queue.DoesNotExist:
        print("Queue type not found")  # Debug print
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Get the highest ticket number for the specific queue type
        last_ticket = QueueTicket.objects.filter(queue=queue).order_by('-created_at').first()
        print(f"Last ticket: {last_ticket.number if last_ticket else 'None'}")  # Debug print

        if last_ticket:
            new_ticket_number = adjust_ticket_number(queue_type, last_ticket.number)
        else:
            new_ticket_number = adjust_ticket_number(queue_type, 0)  # Start from the beginning

        print(f"New ticket number: {new_ticket_number}")  # Debug print

        ticket = QueueTicket.objects.create(queue=queue, number=new_ticket_number)
        print(f"New ticket created: Ticket {ticket.number}")  # Debug print

        # Notify via channels layer about the new ticket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "send_queue_update",
                "text": {"message": f"New ticket {ticket.number} created for {queue_type} queue."}
            }
        )
        print("Notification sent via channels layer")  # Debug print

        # Broadcast the ticket count update
        broadcast_ticket_count_update(queue_type)
        print("Broadcasted ticket count update")  # Debug print

        return Response({"ticket": ticket.number, "ticket.id": ticket.id, "token": ticket.token}, status=status.HTTP_201_CREATED)
    except Exception as e:
        print(f"Error creating queue ticket: {str(e)}")  # Debug print
        logger.error(f"Error creating queue ticket: {str(e)}")
        return Response({"error": "An error occurred while joining the queue"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



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
    img = qrcode.make('https://queue.iitu.edu.kz/join-queue/')
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

def increment_ticket_count(manager):
    report, created = DailyTicketReport.objects.get_or_create(
        manager=manager, date=datetime.today(), defaults={'ticket_count': 0}
    )
    report.ticket_count += 1
    report.save()

def log_manager_action(manager, action_description, ticket_number=None):
    ManagerActionLog.objects.create(
        manager=manager,
        action=action_description,
        ticket_number=ticket_number,
        timestamp=datetime.now()
    )

from pydub import AudioSegment
from django.http import Http404



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_next(request):
    queue_type = request.data.get('type')
    try:
        queue = Queue.objects.get(type=queue_type)
        ticket = QueueTicket.objects.filter(queue=queue, served=False).order_by('created_at').first()
        if ticket is None:
            return Response({"message": "Queue is empty."}, status=status.HTTP_200_OK)

        ticket.served = True
        ticket.serving_manager = request.user
        ticket.save()

        ticket_number = ticket.number
        username = request.user.username.lower()
        stol_number = username[-1]  # Assuming stol number is the last character of the username

        # Determine the speech text based on the username
        if username in ['auditoria111', 'aauditoria111']:
            location_text = "к аудитории 111"
        elif username in ['auditoria303', 'auditoria305', 'auditoria306']:
            location_text = f"к аудитории {username[-3:]}"
        else:
            location_text = f"к столу номер {stol_number}"

        # Create TTS for the announcement
        tts_text = f"Номер {ticket_number}, подойдите {location_text}."
        tts = gTTS(tts_text, lang='ru')
        
        audio_filename = f"ticket_{ticket_number}_{request.user.username}.mp3"
        audio_path = os.path.join(settings.MEDIA_ROOT, audio_filename)
        
        tts.save(audio_path)

        audio_url = request.build_absolute_uri(settings.MEDIA_URL + audio_filename).replace("http://", "https://")

        # Debug print statements
        print(f"Sending WebSocket message for ticket {ticket.id}")
        print(f"Manager username: {request.user.username}")
        print(f"Audio URL: {audio_url}")

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "queue.ticket_called",
                "message": {
                    "queue_type": queue_type,
                    "ticket_id": ticket.id,
                    "ticket_number": ticket.number,
                    "manager_username": request.user.username,
                    "audio_url": audio_url
                }
            }
        )

        broadcast_ticket_count_update(queue_type)
        increment_ticket_count(request.user)
        log_manager_action(request.user, f"Вызван талон: {ticket.number}", ticket.number)

        return Response({
            "ticket_id": ticket.id,
            "ticket_number": ticket.number,
            "audio_url": audio_url
        }, status=status.HTTP_200_OK)

    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)
    except Http404 as e:
        return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"Error in call_next: {str(e)}")
        return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['POST'])
#@permission_classes([IsAuthenticated])
def delete_audio(request):
    audio_filename = request.data.get('audio_filename')

    if not audio_filename:
        return JsonResponse({"error": "Filename not provided"}, status=status.HTTP_400_BAD_REQUEST)

    audio_path = os.path.join(settings.MEDIA_ROOT, audio_filename)

    if (os.path.exists(audio_path)):
        os.remove(audio_path)
        return JsonResponse({"message": "Audio deleted successfully"}, status=status.HTTP_200_OK)
    else:
        return JsonResponse({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)
