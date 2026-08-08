import json
from fastapi import WebSocket
from typing import Set, Dict, Any


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, data: Dict[str, Any]):
        """Broadcast state to all connected clients."""
        message = json.dumps(data)
        disconnected = set()

        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Connection closed, mark for removal
                disconnected.add(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

    async def send_personal(self, websocket: WebSocket, data: Dict[str, Any]):
        """Send data to a specific connection."""
        message = json.dumps(data)
        try:
            await websocket.send_text(message)
        except Exception:
            self.disconnect(websocket)
