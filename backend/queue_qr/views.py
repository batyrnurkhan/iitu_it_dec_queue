from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Queue, QueueTicket
import qrcode
from django.http import HttpResponse
from io import BytesIO
from rest_framework.authtoken.models import Token
from django.db.models import Count
from accounts.models import ManagerActionLog
from gtts import gTTS
from django.conf import settings
import os
@api_view(['POST'])
@permission_classes([AllowAny])  # Allow anyone to join the queue
def join_queue(request):
    queue_type = request.data.get('type')
    try:
        queue = Queue.objects.get(type=queue_type)

        # Get the last ticket number across all queues without updating the current number of the queue
        last_ticket_number = QueueTicket.objects.order_by('-number').first().number if QueueTicket.objects.exists() else 0
        new_ticket_number = last_ticket_number + 1

        # Create a ticket with the new ticket number
        ticket = QueueTicket.objects.create(queue=queue, number=new_ticket_number)
        return Response({"ticket": ticket.number, "token": ticket.token}, status=status.HTTP_200_OK)
    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])  # So anyone can view the queue
def get_queues(request):
    queues = Queue.objects.all().annotate(ticket_count=Count('queueticket'))
    result = []

    for queue in queues:
        ticket_numbers = list(queue.queueticket_set.values_list('number', flat=True))

        if not ticket_numbers:
            result.append({
                'Очередь': queue.type,
                'Сейчас обслуживается талон': 0,
                'Зарегестрированные талоны': []
            })
        else:
            result.append({
                'Очередь': queue.type,
                'Сейчас обслуживается талон': queue.current_number,  # This is the ticket number called most recently
                'Зарегестрированные талоны': ticket_numbers
            })

    return Response(result)

@api_view(['GET'])
@permission_classes([AllowAny])#ну тут просто генерация qr
def generate_qr(request):
    img = qrcode.make('http://localhost:3000/join-queue/')
    response = HttpResponse(content_type="image/png")
    img.save(response, "PNG")
    return response

@api_view(['GET'])
def current_serving(request):
    queues = Queue.objects.all()
    data = {}
    for queue in queues:
        data[queue.type] = queue.currently_serving
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])  # тут просто рестарт очереди
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
        # Fetch the queue based on the type
        queue = Queue.objects.get(type=queue_type)

        # Get the oldest (first-in) ticket from the QueueTicket model for the specific queue
        ticket = QueueTicket.objects.filter(queue=queue).order_by('id').first()

        if not ticket:
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
            "audio_url": audio_url
        }

        # Delete the served ticket from the QueueTicket model
        ticket.delete()

        # Log the action for calling a ticket
        log = ManagerActionLog(manager=request.user, action=f"Called next ticket in {queue_type} queue.")
        log.save()

        return Response(response_data, status=status.HTTP_200_OK)

    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)

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