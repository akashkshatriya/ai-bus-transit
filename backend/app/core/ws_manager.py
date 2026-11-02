"""
WebSocket connection manager.

Maintains two registries:
  - passenger_sockets: route -> set of WebSocket connections (Phase 3+)
  - driver_sockets:   trip_id -> WebSocket connection    (Phase 2)

Used by both the driver GPS endpoint (Phase 2) and the passenger live-map
endpoint (Phase 3) so they share one broadcast surface.
"""
import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # route -> set of passenger WebSocket connections
        self.passenger_sockets: Dict[str, Set[WebSocket]] = {}
        # trip_id -> driver WebSocket (one driver per trip)
        self.driver_sockets: Dict[int, WebSocket] = {}

    # ------------------------------------------------------------------ #
    # Passenger helpers                                                    #
    # ------------------------------------------------------------------ #
    async def register_passenger(self, route: str, ws: WebSocket) -> None:
        self.passenger_sockets.setdefault(route, set()).add(ws)

    async def unregister_passenger(self, route: str, ws: WebSocket) -> None:
        sockets = self.passenger_sockets.get(route, set())
        sockets.discard(ws)

    async def broadcast_to_route(self, route: str, payload: dict) -> None:
        """Send a JSON message to all passengers subscribed to a route.
        Connections that error are silently removed."""
        sockets = self.passenger_sockets.get(route, set())
        dead: Set[WebSocket] = set()
        message = json.dumps(payload)
        for ws in list(sockets):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        sockets -= dead

    # ------------------------------------------------------------------ #
    # Driver helpers                                                       #
    # ------------------------------------------------------------------ #
    async def register_driver(self, trip_id: int, ws: WebSocket) -> None:
        self.driver_sockets[trip_id] = ws

    async def unregister_driver(self, trip_id: int) -> None:
        self.driver_sockets.pop(trip_id, None)


# Singleton instance shared across the entire app lifetime
manager = ConnectionManager()
