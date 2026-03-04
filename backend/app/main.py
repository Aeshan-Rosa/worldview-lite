from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .connector_earthquakes import ingest_earthquakes
from .db import close_pool, get_conn, open_pool
from .schemas import EntityOut, EventOut, Layer, ObservationOut, TrackResponse
from .ws import live_hub

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _run_ingestion_job() -> None:
    try:
        loop = asyncio.get_running_loop()
        deltas = await loop.run_in_executor(None, ingest_earthquakes)
        for delta in deltas:
            await live_hub.broadcast({"type": "delta", "payload": delta})
    except Exception:
        logger.exception("Ingestion job failed")


@app.on_event("startup")
async def on_startup() -> None:
    open_pool()

    scheduler.add_job(
        _run_ingestion_job,
        trigger="interval",
        seconds=settings.ingest_interval_seconds,
        id="usgs-ingestion",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()

    # Seed initial dataset quickly after startup.
    asyncio.create_task(_run_ingestion_job())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    scheduler.shutdown(wait=False)
    close_pool()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/layers", response_model=list[Layer])
def list_layers() -> list[Layer]:
    return [
        Layer(
            id="earthquake-events",
            title="Earthquake Events",
            kind="events",
            description="USGS earthquake events as map markers",
        ),
        Layer(
            id="earthquake-points",
            title="Earthquake Points",
            kind="points",
            description="Latest observation point per quake entity",
        ),
        Layer(
            id="entity-tracks",
            title="Entity Tracks",
            kind="tracks",
            description="Historical tracks by selected entity and time range",
        ),
    ]


@app.get("/entities", response_model=list[EntityOut])
def list_entities(
    source: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=2000),
) -> list[EntityOut]:
    sql = """
      SELECT id, external_id, source, kind, name, properties, created_at, updated_at
      FROM entities
      WHERE (%s::text IS NULL OR source = %s)
        AND (%s::text IS NULL OR kind = %s)
      ORDER BY updated_at DESC
      LIMIT %s
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, (source, source, kind, kind, limit))
        rows = cur.fetchall()
    return [EntityOut(**row) for row in rows]


@app.get("/entities/{entity_id}", response_model=EntityOut)
def get_entity(entity_id: UUID) -> EntityOut:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, external_id, source, kind, name, properties, created_at, updated_at
            FROM entities
            WHERE id = %s
            """,
            (entity_id,),
        )
        row = cur.fetchone()
    if row is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Entity not found")
    return EntityOut(**row)


@app.get("/events", response_model=list[EventOut])
def list_events(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=300, ge=1, le=2000),
) -> list[EventOut]:
    start_ts = start or datetime.now(UTC) - timedelta(hours=24)
    end_ts = end or datetime.now(UTC)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, external_event_id, entity_id, source, type, severity, title,
                   description, occurred_at, lon, lat, payload
            FROM events
            WHERE occurred_at BETWEEN %s AND %s
            ORDER BY occurred_at DESC
            LIMIT %s
            """,
            (start_ts, end_ts, limit),
        )
        rows = cur.fetchall()
    return [EventOut(**row) for row in rows]


@app.get("/entities/{entity_id}/track", response_model=TrackResponse)
def get_track(
    entity_id: UUID,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=5000, ge=1, le=20000),
) -> TrackResponse:
    from_ts = start or datetime.now(UTC) - timedelta(hours=24)
    to_ts = end or datetime.now(UTC)

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, entity_id, observed_at, lon, lat, alt, speed, heading, attrs
            FROM observations
            WHERE entity_id = %s
              AND observed_at BETWEEN %s AND %s
            ORDER BY observed_at ASC
            LIMIT %s
            """,
            (entity_id, from_ts, to_ts, limit),
        )
        rows = cur.fetchall()

    points = [ObservationOut(**row) for row in rows]
    return TrackResponse(entity_id=entity_id, from_ts=from_ts, to_ts=to_ts, points=points)


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    await live_hub.connect(websocket)
    await websocket.send_json({"type": "connected", "ts": datetime.now(UTC).isoformat()})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await live_hub.disconnect(websocket)
    except Exception:
        await live_hub.disconnect(websocket)
