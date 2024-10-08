from channels.generic.websocket import AsyncWebsocketConsumer
import json

class QueueConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(
            "queues",
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            "queues",
            self.channel_name
        )

    async def receive(self, text_data):
        pass

    async def send_queue_update(self, event):
        await self.send(text_data=json.dumps(event["text"]))

    async def queue_ticket_called(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ticket_called',
            'data': event['message']
        }))

    async def queue_ticket_count_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ticket_count_update',
            'data': event['message']
        }))

class CallNextConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get('action') == 'call_next':
            # Здесь ваша логика для вызова следующего тикета
            response = {
                'type': 'ticket_called',
                'message': 'Ticket 12 is being called in the BACHELOR queue.'
            }
            await self.send(text_data=json.dumps(response))

