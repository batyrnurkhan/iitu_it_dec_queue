from django.db.models import Count
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


from django.contrib.auth import logout


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    # Logout the user
    logout(request)
    return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    response_data = {
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "manager_type": user.manager_type,
    }

    if user.role == "MANAGER":
        # ИСПРАВЛЕНО: используем QueueType вместо Queue
        from queue_qr.models import QueueTicket, QueueType

        try:
            queue_type = QueueType.objects.get(name=user.manager_type)

            # Подсчет талонов в очереди
            ticket_count = QueueTicket.objects.filter(
                queue_type=queue_type,
                served=False
            ).count()

            response_data["ticket_counts"] = {user.manager_type: ticket_count}

            # Последний вызванный талон
            last_called_ticket = QueueTicket.objects.filter(
                serving_manager=user
            ).order_by('-id').first()

            if last_called_ticket:
                response_data["last_called_ticket"] = {
                    "number": last_called_ticket.number,
                    "full_name": last_called_ticket.full_name,
                    "queue_type": last_called_ticket.queue_type.name
                }

            # Следующий талон в очереди
            next_ticket = QueueTicket.objects.filter(
                queue_type=queue_type,
                served=False
            ).order_by('created_at').first()

            if next_ticket:
                response_data["next_ticket"] = {
                    "number": next_ticket.number,
                    "full_name": next_ticket.full_name,
                    "created_at": next_ticket.created_at.isoformat()
                }

        except QueueType.DoesNotExist:
            response_data["ticket_counts"] = {user.manager_type: 0}

    return Response(response_data, status=status.HTTP_200_OK)


# Новый endpoint для получения статистики менеджера
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def manager_stats(request):
    """Получение подробной статистики для менеджера"""
    user = request.user

    if user.role != "MANAGER":
        return Response({"error": "Only managers can access this endpoint"}, status=status.HTTP_403_FORBIDDEN)

    from datetime import date, timedelta
    from .models import DailyTicketReport, ManagerActionLog

    today = date.today()
    week_ago = today - timedelta(days=7)

    # Статистика за сегодня
    today_report = DailyTicketReport.objects.filter(
        manager=user,
        date=today
    ).first()

    today_tickets = today_report.ticket_count if today_report else 0

    # Статистика за неделю
    week_reports = DailyTicketReport.objects.filter(
        manager=user,
        date__gte=week_ago
    )

    week_tickets = sum(report.ticket_count for report in week_reports)

    # Последние действия
    recent_actions = ManagerActionLog.objects.filter(
        manager=user
    ).order_by('-timestamp')[:10]

    actions_data = []
    for action in recent_actions:
        actions_data.append({
            "action": action.action,
            "timestamp": action.timestamp.isoformat(),
            "ticket_number": action.ticket_number
        })

    # Текущая очередь
    current_queue_tickets = QueueTicket.objects.filter(
        queue__type=user.manager_type,
        served=False
    ).order_by('created_at')

    queue_data = []
    for ticket in current_queue_tickets[:5]:  # Показываем первые 5
        queue_data.append({
            "number": ticket.number,
            "full_name": ticket.full_name,
            "created_at": ticket.created_at.isoformat()
        })

    response_data = {
        "today_tickets": today_tickets,
        "week_tickets": week_tickets,
        "recent_actions": actions_data,
        "current_queue": queue_data,
        "queue_length": current_queue_tickets.count()
    }

    return Response(response_data, status=status.HTTP_200_OK)