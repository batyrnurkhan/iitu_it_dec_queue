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
        "manager_type_display": user.get_manager_type_display_new(),
        "workplace": user.workplace.name if user.workplace else None,
        "allowed_queue_types": user.get_allowed_queue_types(),
    }

    if user.role == "MANAGER":
        from queue_qr.models import QueueTicket, QueueType

        # Статистика по всем разрешенным типам очередей
        allowed_types = user.get_allowed_queue_types()
        ticket_counts = {}

        for queue_type_name in allowed_types:
            try:
                queue_type = QueueType.objects.get(name=queue_type_name)
                count = QueueTicket.objects.filter(
                    queue_type=queue_type,
                    served=False
                ).count()
                ticket_counts[queue_type_name] = count
            except QueueType.DoesNotExist:
                ticket_counts[queue_type_name] = 0

        response_data["ticket_counts"] = ticket_counts

        # Последний вызванный талон этим менеджером
        last_called_ticket = QueueTicket.objects.filter(
            serving_manager=user
        ).order_by('-id').first()

        if last_called_ticket:
            response_data["last_called_ticket"] = {
                "number": last_called_ticket.number,
                "full_name": last_called_ticket.full_name,
                "queue_type": last_called_ticket.queue_type.name,
                "queue_type_display": last_called_ticket.queue_type.get_name_display()
            }

        # Следующие талоны во всех разрешенных очередях
        next_tickets = []
        for queue_type_name in allowed_types:
            try:
                queue_type = QueueType.objects.get(name=queue_type_name)
                next_ticket = QueueTicket.objects.filter(
                    queue_type=queue_type,
                    served=False
                ).order_by('created_at').first()

                if next_ticket:
                    next_tickets.append({
                        "number": next_ticket.number,
                        "full_name": next_ticket.full_name,
                        "queue_type": queue_type_name,
                        "queue_type_display": queue_type.get_name_display(),
                        "created_at": next_ticket.created_at.isoformat()
                    })
            except QueueType.DoesNotExist:
                continue

        response_data["next_tickets"] = next_tickets

    return Response(response_data, status=status.HTTP_200_OK)


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
            "ticket_number": action.ticket_number,
            "queue_type": action.queue_type
        })

    # Текущие очереди по всем разрешенным типам
    allowed_types = user.get_allowed_queue_types()
    current_queues = {}

    for queue_type_name in allowed_types:
        try:
            from queue_qr.models import QueueType
            queue_type = QueueType.objects.get(name=queue_type_name)

            tickets = QueueTicket.objects.filter(
                queue_type=queue_type,
                served=False
            ).order_by('created_at')[:5]  # Первые 5 талонов

            queue_data = []
            for ticket in tickets:
                queue_data.append({
                    "number": ticket.number,
                    "full_name": ticket.full_name,
                    "created_at": ticket.created_at.isoformat()
                })

            current_queues[queue_type_name] = {
                "display_name": queue_type.get_name_display(),
                "tickets": queue_data,
                "total_count": QueueTicket.objects.filter(queue_type=queue_type, served=False).count()
            }

        except QueueType.DoesNotExist:
            current_queues[queue_type_name] = {
                "display_name": queue_type_name,
                "tickets": [],
                "total_count": 0
            }

    # Статистика по типам очередей за сегодня
    today_stats_by_type = {}
    if today_report and today_report.queue_type_stats:
        today_stats_by_type = today_report.queue_type_stats

    response_data = {
        "today_tickets": today_tickets,
        "week_tickets": week_tickets,
        "recent_actions": actions_data,
        "current_queues": current_queues,
        "allowed_queue_types": allowed_types,
        "workplace": user.workplace.name if user.workplace else None,
        "today_stats_by_type": today_stats_by_type
    }

    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_workplaces(request):
    """Получить список всех рабочих мест"""
    from .models import WorkplaceType

    workplaces = WorkplaceType.objects.filter(is_active=True).order_by('workplace_type', 'number')

    workplaces_data = []
    for workplace in workplaces:
        workplaces_data.append({
            "id": workplace.id,
            "name": workplace.name,
            "workplace_type": workplace.workplace_type,
            "number": workplace.number,
            "location": workplace.location,
            "allowed_queue_types": workplace.allowed_queue_types
        })

    return Response(workplaces_data, status=status.HTTP_200_OK)