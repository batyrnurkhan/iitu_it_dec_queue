from datetime import date

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
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
from django.utils import timezone
from rest_framework import permissions
def api_enabled_required(func):
    def wrapper(request, *args, **kwargs):
        api_status, created = ApiStatus.objects.get_or_create(name='API_STATUS')
        if not api_status.status:
            return JsonResponse({'error': 'API is currently disabled.'}, status=403)
        return func(request, *args, **kwargs)
    return wrapper



@api_view(['POST'])
@permission_classes([AllowAny])
@api_enabled_required
def join_queue(request):
    queue_type = request.data.get('type')
    try:
        queue = Queue.objects.get(type=queue_type)

        # Get the last ticket number across all queues without updating the current number of the queue
        last_ticket_number = QueueTicket.objects.order_by(
            '-number').first().number if QueueTicket.objects.exists() else 0
        new_ticket_number = (last_ticket_number % 500) + 1


        # Create a ticket with the new ticket number
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
    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
@api_enabled_required
def get_queues(request):
    queues = Queue.objects.all().annotate(ticket_count=Count('queueticket'))
    result = []

    for queue in queues:
        ticket_numbers = list(queue.queueticket_set.values_list('number', flat=True))

        result.append({
            'Очередь': queue.type,
            'Сейчас обслуживается талон': queue.current_number,
            'Зарегестрированные талоны': ticket_numbers,
            "manager_table": queue.manager.table.name if queue.manager and queue.manager.table else ""

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

        # Удаление очереди
        QueueTicket.objects.filter(queue=queue).delete()

        return Response({"message": f"{queue_type} queue has been reset."}, status=status.HTTP_200_OK)
    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_next(request):
    queue_type = request.data.get('type')

    # Check if manager's type matches the queue type
    if request.user.manager_type != queue_type:
        return Response({
            "error": f"A {request.user.manager_type} manager can only call the {request.user.manager_type} queue."
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        queue = Queue.objects.get(type=queue_type)

        # If there are no tickets and the queue is dynamically created, delete it
        if not QueueTicket.objects.filter(queue=queue).exists() and queue.dynamic_created:
            queue.delete()
            # Notify the frontend that a queue was removed
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "queues",
                {
                    "type": "send_queue_update",
                    "text": {
                        "type": "queue_deleted",
                        "message": f"Queue {queue_type} has been removed."
                    }
                }
            )
            return Response({"message": "Queue is empty and has been removed."}, status=status.HTTP_200_OK)

        # Get the oldest (first-in) ticket from the QueueTicket model for the specific queue
        ticket = QueueTicket.objects.filter(queue=queue).order_by('number').first()

        if not ticket:
            # If the queue does not have a manager assigned, create a new queue for the manager
            if not queue.manager:
                new_queue = Queue.objects.create(type=queue_type, dynamic_created=True)
                new_queue.manager = request.user
                new_queue.save()
                # Notify the frontend about the new queue
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    "queues",
                    {
                        "type": "send_queue_update",
                        "text": {
                            "type": "new_queue_created",
                            "message": f"New queue {queue_type} created for manager {request.user.username}."
                        }
                    }
                )
                return Response({"message": "Queue was empty. A new queue has been created."}, status=status.HTTP_200_OK)
            else:
                # Log the action for calling an empty queue
                log = ManagerActionLog(manager=request.user, action="CALLED EMPTY QUEUE.")
                log.save()
                return Response({"message": "Queue is empty.", "current_number": 0}, status=status.HTTP_200_OK)

        # Update the current serving number for the queue
        queue.current_number = ticket.number
        queue.save()

        # Generate voice-over
        text_to_speak = f"Талон {ticket.number} подойдите к менеджеру номер 1"
        tts = gTTS(text=text_to_speak, lang='ru')
        audio_filename = f"ticket_{ticket.number}.mp3"

        # Check if the directory exists, if not create it
        if not os.path.exists(settings.MEDIA_ROOT):
            os.makedirs(settings.MEDIA_ROOT)

        path_to_save = os.path.join(settings.MEDIA_ROOT, audio_filename)
        tts.save(path_to_save)
        audio_url = request.build_absolute_uri(settings.MEDIA_URL + audio_filename)

        # Return the ticket number, token, and audio URL to the manager
        response_data = {
            "ticket": ticket.number,
            "token": ticket.token,
            "audio_url": audio_url,
            "manager_username": request.user.username
        }

        increment_ticket_count(request.user)

        # Delete the served ticket from the QueueTicket model
        ticket.delete()

        # Log the action for calling a ticket
        log = ManagerActionLog(manager=request.user, action=f"Called next ticket in {queue_type} queue.",
                               ticket_number=ticket.number)
        log.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "queues",
            {
                "type": "send_queue_update",
                "text": {
                    "type": "ticket_called",
                    "message": f"Ticket {ticket.number} is being called in the {queue_type} queue."
                }
            }
        )

        queue.manager = request.user
        queue.save()

        return Response(response_data, status=status.HTTP_200_OK)

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