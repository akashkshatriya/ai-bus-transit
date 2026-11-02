import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.trip import Trip, LivePosition
from app.schemas.trip import TripStart, TripOut, ActiveTripOut, LocationPing
from app.core.security import get_current_driver, decode_access_token
from app.core.ws_manager import manager

router = APIRouter(prefix="/trips", tags=["trips"])

MAX_IDLE_MINUTES = 5


def cleanup_and_get_active_trips(
    db: Session,
    route: Optional[str] = None,
    max_idle_minutes: int = MAX_IDLE_MINUTES
) -> list[tuple[Trip, Optional[LivePosition]]]:
    """
    Find active trips, automatically marks any trip idle for > max_idle_minutes as 'ended',
    and returns only genuinely live active trips with their latest LivePosition.
    """
    now = datetime.utcnow()
    threshold = now - timedelta(minutes=max_idle_minutes)

    query = db.query(Trip).filter(Trip.status == "active")
    if route:
        query = query.filter(Trip.route == route)
    trips = query.all()

    live_results = []
    for t in trips:
        live = db.query(LivePosition).filter(LivePosition.trip_id == t.id).first()
        last_time = live.updated_at if (live and live.updated_at) else t.started_at
        
        # If no GPS ping or start within last 5 mins, driver left/closed browser -> mark ended
        if last_time and last_time < threshold:
            t.status = "ended"
            t.ended_at = now
        else:
            live_results.append((t, live))

    db.commit()
    return live_results


# ─────────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────────

@router.post("/start", response_model=TripOut, status_code=status.HTTP_201_CREATED)
async def start_trip(
    body: TripStart,
    db: Session = Depends(get_db),
    current_driver: User = Depends(get_current_driver),
):
    """Create a new active trip for the authenticated driver."""
    # End any previously active trip for this driver first (safety guard)
    old_trips = (
        db.query(Trip)
        .filter(Trip.driver_id == current_driver.id, Trip.status == "active")
        .all()
    )
    for old in old_trips:
        old.status = "ended"
        old.ended_at = datetime.utcnow()
        await manager.broadcast_to_route(old.route, {
            "type": "trip_ended",
            "trip_id": old.id,
            "route": old.route,
            "bus_name": old.bus_name
        })
    db.flush()

    trip = Trip(
        driver_id=current_driver.id,
        bus_name=body.bus_name.strip(),
        route=body.route,
        status="active",
        started_at=datetime.utcnow(),
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/end", response_model=TripOut)
async def end_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_driver: User = Depends(get_current_driver),
):
    """Mark a trip as ended. Only the owning driver can end their trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.driver_id != current_driver.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    if trip.status == "ended":
        raise HTTPException(status_code=400, detail="Trip already ended")

    trip.status = "ended"
    trip.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(trip)

    # Broadcast trip termination to all subscribed passenger sockets
    await manager.broadcast_to_route(trip.route, {
        "type": "trip_ended",
        "trip_id": trip.id,
        "route": trip.route,
        "bus_name": trip.bus_name,
    })

    return trip


@router.get("/active", response_model=list[ActiveTripOut])
def list_active_trips(
    route: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """
    Return all currently active trips (optionally filtered by route).
    Automatically cleans up any stale trip without GPS pings in the last 5 minutes.
    """
    live_trips = cleanup_and_get_active_trips(db, route=route)

    results = []
    for t, live in live_trips:
        results.append(ActiveTripOut(
            id=t.id,
            bus_name=t.bus_name,
            route=t.route,
            status=t.status,
            started_at=t.started_at,
            driver_id=t.driver_id,
            lat=live.latitude if live else None,
            lng=live.longitude if live else None,
            updated_at=live.updated_at.isoformat() + "Z" if (live and live.updated_at) else None
        ))
    return results


# ─────────────────────────────────────────────
# WebSocket endpoint — driver GPS streaming
# ─────────────────────────────────────────────

@router.websocket("/ws/driver/{trip_id}")
async def driver_ws(
    websocket: WebSocket,
    trip_id: int,
    token: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    WebSocket for a driver to stream their GPS position.
    """
    if not token:
        await websocket.close(code=4001, reason="Missing auth token")
        return

    try:
        payload = decode_access_token(token)
        driver_id = int(payload.sub)
    except Exception:
        await websocket.close(code=4001, reason="Invalid auth token")
        return

    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        await websocket.close(code=4004, reason="Trip not found")
        return
    if trip.driver_id != driver_id:
        await websocket.close(code=4003, reason="Not your trip")
        return
    if trip.status != "active":
        await websocket.close(code=4004, reason="Trip is not active")
        return

    await websocket.accept()
    await manager.register_driver(trip_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
                ping = LocationPing(**data)
            except Exception:
                await websocket.send_text(
                    json.dumps({"error": "Invalid message format. Expected {lat, lng, timestamp}"})
                )
                continue

            now = datetime.utcnow()

            # Upsert LivePosition
            live = db.query(LivePosition).filter(LivePosition.trip_id == trip_id).first()
            if live:
                live.latitude = ping.lat
                live.longitude = ping.lng
                live.updated_at = now
            else:
                live = LivePosition(
                    trip_id=trip_id,
                    latitude=ping.lat,
                    longitude=ping.lng,
                    updated_at=now,
                )
                db.add(live)
            db.commit()

            db.refresh(trip)

            # Broadcast to all passengers on this route
            broadcast_payload = {
                "type": "location_update",
                "trip_id": trip_id,
                "bus_name": trip.bus_name,
                "route": trip.route,
                "lat": ping.lat,
                "lng": ping.lng,
                "updated_at": now.isoformat() + "Z",
            }
            await manager.broadcast_to_route(trip.route, broadcast_payload)

            # Echo ack back to the driver
            await websocket.send_text(json.dumps({"ack": True, **broadcast_payload}))

    except WebSocketDisconnect:
        pass
    finally:
        await manager.unregister_driver(trip_id)
        db.close()


# ─────────────────────────────────────────────
# WebSocket endpoint — passenger live map stream
# ─────────────────────────────────────────────

@router.websocket("/ws/passenger/live")
async def passenger_ws(
    websocket: WebSocket,
    route: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    WebSocket for passengers to receive live bus coordinate broadcasts for a selected route.
    On connection, sends an initial snapshot of all active buses on this route.
    """
    await websocket.accept()
    await manager.register_passenger(route, websocket)

    try:
        # Query initial snapshot of genuine live active trips on this route
        live_trips = cleanup_and_get_active_trips(db, route=route)
        snapshot = []
        for t, live in live_trips:
            if live:
                snapshot.append({
                    "type": "location_update",
                    "trip_id": t.id,
                    "bus_name": t.bus_name,
                    "route": t.route,
                    "lat": live.latitude,
                    "lng": live.longitude,
                    "updated_at": live.updated_at.isoformat() + "Z" if live.updated_at else None,
                })

        # Send initial snapshot to the passenger
        await websocket.send_text(json.dumps({
            "type": "snapshot",
            "data": snapshot
        }))

        # Keep connection open and listen for any client pings / disconnects
        while True:
            # We can receive ping messages or route change messages from client if sent
            data = await websocket.receive_text()
            # If client sends ping, respond with pong
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        await manager.unregister_passenger(route, websocket)
        db.close()
