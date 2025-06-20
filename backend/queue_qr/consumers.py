from channels.generic.websocket import AsyncWebsocketConsumer
import json
import logging

logger = logging.getLogger(__name__)


class QueueConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Добавляем в общую группу для получения всех обновлений очередей
        await self.channel_layer.group_add(
            "queues",
            self.channel_name
        )

        # Если указан конкретный тип очереди, добавляем и в эту группу
        self.queue_type = self.scope['url_route']['kwargs'].get('queue_type')
        if self.queue_type:
            await self.channel_layer.group_add(
                f"queue_{self.queue_type}",
                self.channel_name
            )

        await self.accept()
        logger.info(f"WebSocket connected for queue_type: {self.queue_type}")

    async def disconnect(self, close_code):
        # Удаляем из общей группы
        await self.channel_layer.group_discard(
            "queues",
            self.channel_name
        )

        # Удаляем из группы конкретной очереди если была подключена
        if hasattr(self, 'queue_type') and self.queue_type:
            await self.channel_layer.group_discard(
                f"queue_{self.queue_type}",
                self.channel_name
            )

        logger.info(f"WebSocket disconnected for queue_type: {getattr(self, 'queue_type', 'all')}")

    async def receive(self, text_data):
        """Обработка входящих сообщений от клиента"""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
            elif action == 'subscribe_queue':
                # Подписка на конкретную очередь
                queue_type = data.get('queue_type')
                if queue_type:
                    await self.channel_layer.group_add(
                        f"queue_{queue_type}",
                        self.channel_name
                    )
                    await self.send(text_data=json.dumps({
                        'type': 'subscribed',
                        'queue_type': queue_type
                    }))
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data}")
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")

    async def send_queue_update(self, event):
        """Отправка общих обновлений очереди"""
        await self.send(text_data=json.dumps({
            'type': 'queue_update',
            'data': event["text"]
        }))

    async def queue_ticket_called(self, event):
        """Обработка вызова талона с ФИО"""
        message_data = event['message']

        # Формируем данные для отправки клиенту
        response_data = {
            'type': 'ticket_called',
            'data': {
                'queue_type': message_data.get('queue_type'),
                'ticket_id': message_data.get('ticket_id'),
                'ticket_number': message_data.get('ticket_number'),
                'full_name': message_data.get('full_name'),  # Добавляем ФИО
                'manager_username': message_data.get('manager_username'),
                'audio_url': message_data.get('audio_url'),
                'timestamp': message_data.get('timestamp')
            }
        }

        await self.send(text_data=json.dumps(response_data))
        logger.info(
            f"Sent ticket_called for {message_data.get('full_name')} (ticket #{message_data.get('ticket_number')})")

    async def queue_ticket_count_update(self, event):
        """Обновление счетчиков талонов в очередях"""
        await self.send(text_data=json.dumps({
            'type': 'ticket_count_update',
            'data': event['message']
        }))

    async def queue_status_update(self, event):
        """Обновление статуса очереди (открыта/закрыта/пауза)"""
        await self.send(text_data=json.dumps({
            'type': 'queue_status_update',
            'data': event['message']
        }))

    async def new_ticket_created(self, event):
        """Уведомление о создании нового талона"""
        message_data = event['message']

        response_data = {
            'type': 'new_ticket',
            'data': {
                'queue_type': message_data.get('queue_type'),
                'ticket_number': message_data.get('ticket_number'),
                'full_name': message_data.get('full_name'),  # Добавляем ФИО
                'timestamp': message_data.get('timestamp')
            }
        }

        await self.send(text_data=json.dumps(response_data))


class CallNextConsumer(AsyncWebsocketConsumer):
    """Consumer для менеджеров, которые вызывают следующих клиентов"""

    async def connect(self):
        # Проверяем аутентификацию пользователя
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return

        self.user = user

        # Добавляем в группу менеджеров
        await self.channel_layer.group_add(
            "managers",
            self.channel_name
        )

        await self.accept()
        logger.info(f"Manager {user.username} connected to CallNextConsumer")

    async def disconnect(self, close_code):
        if hasattr(self, 'user'):
            await self.channel_layer.group_discard(
                "managers",
                self.channel_name
            )
            logger.info(f"Manager {self.user.username} disconnected from CallNextConsumer")

    async def receive(self, text_data):
        """Обработка команд от менеджеров"""
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'get_next_ticket':
                queue_type = data.get('queue_type')
                if queue_type:
                    # Здесь можно добавить логику получения следующего талона
                    # без его вызова (preview)
                    await self.send_next_ticket_info(queue_type)

            elif action == 'manager_status':
                # Обновление статуса менеджера (доступен/занят/пауза)
                status = data.get('status')
                await self.channel_layer.group_send(
                    "managers",
                    {
                        "type": "manager_status_update",
                        "message": {
                            "manager_username": self.user.username,
                            "status": status
                        }
                    }
                )

        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received from manager: {text_data}")
        except Exception as e:
            logger.error(f"Error processing manager message: {str(e)}")

    async def send_next_ticket_info(self, queue_type):
        """Отправка информации о следующем талоне без его вызова"""
        from .models import Queue, QueueTicket

        try:
            queue = await Queue.objects.aget(type=queue_type)
            next_ticket = await QueueTicket.objects.filter(
                queue=queue, served=False
            ).order_by('created_at').afirst()

            if next_ticket:
                await self.send(text_data=json.dumps({
                    'type': 'next_ticket_info',
                    'data': {
                        'queue_type': queue_type,
                        'ticket_id': next_ticket.id,
                        'ticket_number': next_ticket.number,
                        'full_name': next_ticket.full_name,
                        'created_at': next_ticket.created_at.isoformat()
                    }
                }))
            else:
                await self.send(text_data=json.dumps({
                    'type': 'queue_empty',
                    'data': {'queue_type': queue_type}
                }))

        except Exception as e:
            logger.error(f"Error getting next ticket info: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'data': {'message': 'Error getting next ticket info'}
            }))

    async def ticket_called_notification(self, event):
        """Уведомление менеджерам о вызванном талоне"""
        await self.send(text_data=json.dumps({
            'type': 'ticket_called_by_manager',
            'data': event['message']
        }))

    async def manager_status_update(self, event):
        """Обновление статуса других менеджеров"""
        if event['message']['manager_username'] != self.user.username:
            await self.send(text_data=json.dumps({
                'type': 'manager_status_update',
                'data': event['message']
            }))


class DisplayConsumer(AsyncWebsocketConsumer):
    """Consumer для дисплеев в зонах ожидания"""

    async def connect(self):
        await self.channel_layer.group_add(
            "displays",
            self.channel_name
        )
        await self.accept()
        logger.info("Display connected")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            "displays",
            self.channel_name
        )
        logger.info("Display disconnected")

    async def receive(self, text_data):
        """Дисплеи обычно только получают данные"""
        pass

    async def queue_ticket_called(self, event):
        """Отображение вызванного талона на дисплее"""
        message_data = event['message']

        display_data = {
            'type': 'display_ticket_called',
            'data': {
                'queue_type': message_data.get('queue_type'),
                'ticket_number': message_data.get('ticket_number'),
                'full_name': message_data.get('full_name'),
                'manager_location': self.get_manager_location(message_data.get('manager_username')),
                'audio_url': message_data.get('audio_url'),
                'timestamp': message_data.get('timestamp')
            }
        }

        await self.send(text_data=json.dumps(display_data))

    def get_manager_location(self, username):
        """Определение местоположения менеджера по username"""
        if not username:
            return "Стол"

        username_lower = username.lower()

        if username_lower in ['auditoria111', 'aauditoria111']:
            return "Аудитория 111"
        elif username_lower in ['auditoria303', 'auditoria305', 'auditoria306']:
            return f"Аудитория {username_lower[-3:]}"
        else:
            stol_number = username_lower[-1] if username_lower else "1"
            return f"Стол {stol_number}"

    async def queue_status_update(self, event):
        """Обновление статуса очереди на дисплее"""
        await self.send(text_data=json.dumps({
            'type': 'display_queue_status',
            'data': event['message']
        }))