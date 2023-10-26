# accounts/consumers.py

from channels.generic.websocket import AsyncWebsocketConsumer
import json


class AccountsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "accounts"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        pass

    # Handle messages from group
    async def send_account_update(self, event):
        await self.send(text_data=json.dumps(event["text"]))
