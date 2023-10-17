from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Queue
import qrcode
from django.http import HttpResponse
from io import BytesIO

@api_view(['POST'])
@permission_classes([AllowAny])
def join_queue(request):
    queue_type = request.data.get('type')
    try:
        queue = Queue.objects.get(type=queue_type)
        queue.current_number += 1
        queue.save()
        return Response({"ticket": queue.current_number}, status=status.HTTP_200_OK)
    except Queue.DoesNotExist:
        return Response({"error": "Queue type not found"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_queues(request):
    queues = Queue.objects.all().values('type', 'current_number')
    return Response(list(queues))

@api_view(['GET'])
@permission_classes([AllowAny])
def generate_qr(request):
    img = qrcode.make('http://localhost:3000/join-queue/')
    response = HttpResponse(content_type="image/png")
    img.save(response, "PNG")
    return response
