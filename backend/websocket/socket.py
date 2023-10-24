import asyncio
from multiprocessing import managers

import websockets
import json

class Client:
    def __init__(self, websocket):
        self.websocket = websocket
        self.manager = None
        self.coupon = None

    def set_manager(self, manager):
        self.manager = manager

    def set_coupon(self, coupon):
        self.coupon = coupon

    async def on_call(self):

        await self.websocket.send(json.dumps({
            "type": "advice",
            "coupon": self.coupon
        }))

class Manager:
    def __init__(self, websocket):
        self.websocket = websocket
        self.clients = {}

    def add_client(self, client):
        self.clients[client.coupon] = client

    def remove_client(self, client):
        del self.clients[client.coupon]

    def call_client(self, coupon):
        client = self.clients.get(coupon)
        if client:
            client.on_call()
        else:
            print("Client not found for coupon:", coupon)

async def main(websocket_handler=None, clients=None):
    server = await websockets.serve(websocket_handler, "localhost", 8000)

    while True:
        websocket, _ = await server.accept()

        user_type = await websocket.recv()

        if user_type == "manager":
            manager = Manager(websocket)
        else:
            client = Client(websocket)

        if user_type == "manager":
            managers.append(manager)
        else:
            clients.append(client)

        if user_type == "manager":
            asyncio.create_task(manager_handler(websocket, manager))
        else:
            asyncio.create_task(client_handler(websocket, client))

async def manager_handler(websocket, manager):
    while True:
        message = await websocket.recv()

        data = json.loads(message)

        message_type = data["type"]

        if message_type == "call_client":
            coupon = data["coupon"]
            manager.call_client(coupon)

async def client_handler(websocket, client):
    while True:
        message = await websocket.recv()

        data = json.loads(message)

        message_type = data["type"]

        if message_type == "coupon":
            coupon = data["coupon"]
            client.set_coupon(coupon)
            manager = managers[0]
            manager.add_client(client)

if __name__ == "__main__":
    asyncio.run(main())
