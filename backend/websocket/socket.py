import asyncio
import json
import logging
from multiprocessing import managers
import websockets

# Configure logging
logging.basicConfig(level=logging.DEBUG, filename='websocket_server.log', filemode='w',
                    format='%(asctime)s - %(levelname)s - %(message)s')

class Client:
    def __init__(self, websocket):
        self.websocket = websocket
        self.manager = None
        self.coupon = None
        logging.debug("New client initialized")

    def set_manager(self, manager):
        self.manager = manager
        logging.debug(f"Manager set: {manager}")

    def set_coupon(self, coupon):
        self.coupon = coupon
        logging.debug(f"Coupon set: {coupon}")

    async def on_call(self):
        message = json.dumps({
            "type": "advice",
            "coupon": self.coupon
        })
        await self.websocket.send(message)
        logging.debug(f"Message sent to client: {message}")

class Manager:
    def __init__(self, websocket):
        self.websocket = websocket
        self.clients = {}
        logging.debug("Manager: New client initialized")


    def add_client(self, client):
        self.clients[client.coupon] = client
        logging.debug("Manager: New client added")

    def remove_client(self, client):
        del self.clients[client.coupon]
        logging.debug("Manager: client removed")

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
