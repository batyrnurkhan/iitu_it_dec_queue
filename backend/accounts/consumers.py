# accounts/consumers.py

from channels.generic.websocket import AsyncWebsocketConsumer
import json
import logging

logger = logging.getLogger(__name__)


class AccountsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Проверяем аутентификацию пользователя
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return

        self.user = user
        self.group_name = "accounts"

        # Добавляем в общую группу accounts
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        # Если пользователь - менеджер, добавляем его в группу менеджеров
        if user.role == 'MANAGER':
            await self.channel_layer.group_add(
                "managers",
                self.channel_name
            )

            # Добавляем в группу конкретного типа менеджера
            if user.manager_type:
                await self.channel_layer.group_add(
                    f"manager_{user.manager_type}",
                    self.channel_name
                )

        await self.accept()
        logger.info(f"AccountsConsumer: User {user.username} connected")

    async def disconnect(self, close_code):
        # Удаляем из всех групп
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

        if hasattr(self, 'user') and self.user.role == 'MANAGER':
            await self.channel_layer.group_discard(
                "managers",
                self.channel_name
            )

            if self.user.manager_type:
                await self.channel_layer.group_discard(
                    f"manager_{self.user.manager_type}",
                    self.channel_name
                )

        logger.info(f"AccountsConsumer: User {getattr(self, 'user', {}).get('username', 'unknown')} disconnected")

    async def receive(self, text_data):
        """Обработка сообщений от клиента"""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))

            elif action == 'get_manager_status':
                # Отправляем текущий статус менеджера
                await self.send_manager_status()

            elif action == 'update_manager_status':
                # Обновляем статус менеджера
                status = data.get('status', 'available')
                await self.update_manager_status(status)

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data}")
        except Exception as e:
            logger.error(f"Error processing accounts message: {str(e)}")

    async def send_manager_status(self):
        """Отправка текущего статуса менеджера"""
        if hasattr(self, 'user') and self.user.role == 'MANAGER':
            from queue_qr.models import QueueTicket

            # Получаем информацию о текущей очереди
            try:
                waiting_tickets = await QueueTicket.objects.filter(
                    queue__type=self.user.manager_type,
                    served=False
                ).acount()

                last_ticket = await QueueTicket.objects.filter(
                    serving_manager=self.user
                ).order_by('-id').afirst()

                response_data = {
                    'type': 'manager_status',
                    'data': {
                        'manager_type': self.user.manager_type,
                        'waiting_tickets': waiting_tickets,
                        'last_called_ticket': {
                            'number': last_ticket.number,
                            'full_name': last_ticket.full_name
                        } if last_ticket else None
                    }
                }

                await self.send(text_data=json.dumps(response_data))

            except Exception as e:
                logger.error(f"Error getting manager status: {str(e)}")

    async def update_manager_status(self, status):
        """Обновление статуса менеджера и уведомление других"""
        if hasattr(self, 'user') and self.user.role == 'MANAGER':
            # Отправляем обновление другим менеджерам
            await self.channel_layer.group_send(
                "managers",
                {
                    "type": "manager_status_update",
                    "message": {
                        "manager_username": self.user.username,
                        "manager_type": self.user.manager_type,
                        "status": status,
                        "timestamp": "now"  # В реальном приложении используйте datetime
                    }
                }
            )

    # Handle messages from group
    async def send_account_update(self, event):
        """Общие обновления аккаунтов"""
        await self.send(text_data=json.dumps({
            'type': 'account_update',
            'data': event["text"]
        }))

    async def manager_status_update(self, event):
        """Обновление статуса других менеджеров"""
        # Не отправляем себе собственные обновления
        if hasattr(self, 'user') and event['message']['manager_username'] != self.user.username:
            await self.send(text_data=json.dumps({
                'type': 'manager_status_update',
                'data': event['message']
            }))

    async def ticket_called_notification(self, event):
        """Уведомление о вызванном талоне (для менеджеров)"""
        if hasattr(self, 'user') and self.user.role == 'MANAGER':
            await self.send(text_data=json.dumps({
                'type': 'ticket_called_by_colleague',
                'data': event['message']
            }))

    async def queue_stats_update(self, event):
        """Обновление статистики очереди"""
        await self.send(text_data=json.dumps({
            'type': 'queue_stats_update',
            'data': event['message']
        }))

    async def system_notification(self, event):
        """Системные уведомления для пользователей"""
        await self.send(text_data=json.dumps({
            'type': 'system_notification',
            'data': event['message']
        }))