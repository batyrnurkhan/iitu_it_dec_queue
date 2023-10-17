from rest_framework import status
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from .models import CustomUser, ManagerWorkplace


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
    return Response({
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "manager_type": user.manager_type
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def call_next_ticket(request):
    manager = request.user
    if not manager.role == CustomUser.MANAGER:
        return Response({"error": "You are not a manager."}, status=status.HTTP_400_BAD_REQUEST)

    workplace = ManagerWorkplace.objects.get(manager=manager)
    if workplace.current_serving < workplace.last_ticket:
        workplace.current_serving += 1
        workplace.save()
        return Response({"current_serving": workplace.current_serving}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "No more tickets to serve."}, status=status.HTTP_400_BAD_REQUEST)