"""
Servicio de WebSocket — Gestión de conexiones en tiempo real.
Permite notificar al frontend del cajero cuando un pago QR es confirmado.
"""
from typing import Dict, List
from fastapi import WebSocket
import json


class ConnectionManager:
    """Gestiona conexiones WebSocket activas, agrupadas por pedido_id."""

    def __init__(self):
        # Dict[pedido_id, List[WebSocket]]
        self._active_connections: Dict[int, List[WebSocket]] = {}
        # Conexiones globales (pantalla del cajero, sin pedido específico)
        self._broadcast_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, pedido_id: int = None):
        await websocket.accept()
        if pedido_id is not None:
            if pedido_id not in self._active_connections:
                self._active_connections[pedido_id] = []
            self._active_connections[pedido_id].append(websocket)
        else:
            self._broadcast_connections.append(websocket)

    def disconnect(self, websocket: WebSocket, pedido_id: int = None):
        if pedido_id is not None and pedido_id in self._active_connections:
            self._active_connections[pedido_id].remove(websocket)
            if not self._active_connections[pedido_id]:
                del self._active_connections[pedido_id]
        elif websocket in self._broadcast_connections:
            self._broadcast_connections.remove(websocket)

    async def notify_pedido(self, pedido_id: int, data: dict):
        """Envía notificación a todos los clientes escuchando un pedido específico."""
        message = json.dumps(data)
        connections = self._active_connections.get(pedido_id, [])
        dead = []
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, pedido_id)

    async def broadcast(self, data: dict):
        """Envía notificación a todas las conexiones globales (ej. pantalla del cajero)."""
        message = json.dumps(data)
        dead = []
        for ws in self._broadcast_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


# Instancia singleton compartida por toda la app
manager = ConnectionManager()
