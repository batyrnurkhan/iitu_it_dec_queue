from rest_framework import status
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated

from queue_qr.models import QueueTicket


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    response_data = {
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "manager_type": user.manager_type
    }

    # If the user is a manager, add tickets and other related data to the response
    if user.role == "MANAGER":
        tickets = QueueTicket.objects.filter(queue__type=user.manager_type).values_list('number', flat=True)
        response_data["tickets"] = list(tickets)
        # Add any other manager-specific data here

    return Response(response_data, status=status.HTTP_200_OK)


from django.contrib.auth import logout
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    # Logout the user
    logout(request)
    return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)