from channels.generic.websocket import AsyncWebsocketConsumer
import json

class LiveUpdatesConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        # ... logic here
        pass


class YourQueueConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("Trying to connect ...")
        await self.accept()
        print("Connected!")

    async def disconnect(self, close_code):
        print(f"Disconnected with code: {close_code}")

    async def receive(self, text_data):
        print(f"Received data: {text_data}")
        #... rest of your code
