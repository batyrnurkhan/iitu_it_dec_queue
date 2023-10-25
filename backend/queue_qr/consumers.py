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

    # Handle messages from room group
    async def send_queue_update(self, event):
        await self.send(text_data=json.dumps(event["text"]))
