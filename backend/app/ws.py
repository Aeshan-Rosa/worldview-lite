from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class LiveHub:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        payload = json.dumps(message)
        stale: list[WebSocket] = []
        async with self._lock:
            clients = list(self._clients)
        for client in clients:
            try:
                await client.send_text(payload)
            except Exception:
                stale.append(client)
        if stale:
            async with self._lock:
                for ws in stale:
                    self._clients.discard(ws)


live_hub = LiveHub()
