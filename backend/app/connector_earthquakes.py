from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import httpx
from psycopg.types.json import Jsonb

from .config import settings
from .db import get_conn

logger = logging.getLogger(__name__)


def _normalize_quake(feature: dict[str, Any]) -> dict[str, Any] | None:
    quake_id = feature.get("id")
    props = feature.get("properties", {})
    geom = feature.get("geometry", {})
    coords = geom.get("coordinates", [])

    if not quake_id or len(coords) < 2:
        return None

    lon, lat = float(coords[0]), float(coords[1])
    depth = float(coords[2]) if len(coords) >= 3 and coords[2] is not None else None

    event_time_ms = props.get("time")
    if event_time_ms is None:
        observed_at = datetime.now(UTC)
    else:
        observed_at = datetime.fromtimestamp(event_time_ms / 1000, tz=UTC)

    updated_raw = props.get("updated")
    updated_at = (
        datetime.fromtimestamp(updated_raw / 1000, tz=UTC)
        if isinstance(updated_raw, (int, float))
        else observed_at
    )

    return {
        "external_id": quake_id,
        "name": props.get("title"),
        "magnitude": props.get("mag"),
        "place": props.get("place"),
        "status": props.get("status"),
        "type": props.get("type") or "earthquake",
        "tsunami": props.get("tsunami"),
        "url": props.get("url"),
        "observed_at": observed_at,
        "updated_at": updated_at,
        "lon": lon,
        "lat": lat,
        "depth": depth,
        "raw": feature,
    }


def ingest_earthquakes() -> list[dict[str, Any]]:
    logger.info("Fetching earthquake feed: %s", settings.usgs_feed_url)
    with httpx.Client(timeout=20) as client:
        response = client.get(settings.usgs_feed_url)
        response.raise_for_status()
        payload = response.json()

    features = payload.get("features", [])
    deltas: list[dict[str, Any]] = []

    with get_conn() as conn:
        with conn.cursor() as cur:
            for feature in features:
                row = _normalize_quake(feature)
                if row is None:
                    continue

                cur.execute(
                    """
                    INSERT INTO entities (external_id, source, kind, name, properties)
                    VALUES (%s, 'usgs', 'earthquake', %s, %s::jsonb)
                    ON CONFLICT (source, external_id) DO UPDATE
                    SET
                      name = EXCLUDED.name,
                      properties = EXCLUDED.properties,
                      updated_at = NOW()
                    RETURNING id, updated_at
                    """,
                    (
                        row["external_id"],
                        row["name"],
                        Jsonb(
                            {
                                "magnitude": row["magnitude"],
                                "place": row["place"],
                                "status": row["status"],
                                "url": row["url"],
                            }
                        ),
                    ),
                )
                ent = cur.fetchone()
                entity_id = ent["id"]

                cur.execute(
                    """
                    INSERT INTO observations (
                      entity_id, observed_at, lon, lat, alt, speed, heading, geom, raw, attrs
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, NULL, NULL,
                      ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                      %s::jsonb,
                      %s::jsonb
                    )
                    ON CONFLICT (entity_id, observed_at)
                    DO UPDATE SET
                      lon = EXCLUDED.lon,
                      lat = EXCLUDED.lat,
                      alt = EXCLUDED.alt,
                      geom = EXCLUDED.geom,
                      raw = EXCLUDED.raw,
                      attrs = EXCLUDED.attrs
                    RETURNING id
                    """,
                    (
                        entity_id,
                        row["observed_at"],
                        row["lon"],
                        row["lat"],
                        row["depth"],
                        row["lon"],
                        row["lat"],
                        Jsonb(row["raw"]),
                        Jsonb({"depth_km": row["depth"], "magnitude": row["magnitude"]}),
                    ),
                )
                observation = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO events (
                      external_event_id, entity_id, source, type, severity, title,
                      description, occurred_at, lon, lat, geom, payload
                    )
                    VALUES (
                      %s, %s, 'usgs', 'earthquake', %s, %s,
                      %s, %s, %s, %s,
                      ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                      %s::jsonb
                    )
                    ON CONFLICT (source, external_event_id) DO UPDATE
                    SET
                      severity = EXCLUDED.severity,
                      title = EXCLUDED.title,
                      description = EXCLUDED.description,
                      occurred_at = EXCLUDED.occurred_at,
                      lon = EXCLUDED.lon,
                      lat = EXCLUDED.lat,
                      geom = EXCLUDED.geom,
                      payload = EXCLUDED.payload,
                      updated_at = NOW()
                    RETURNING id
                    """,
                    (
                        row["external_id"],
                        entity_id,
                        str(row["magnitude"]) if row["magnitude"] is not None else None,
                        row["name"],
                        row["place"],
                        row["observed_at"],
                        row["lon"],
                        row["lat"],
                        row["lon"],
                        row["lat"],
                        Jsonb(
                            {
                                "status": row["status"],
                                "url": row["url"],
                                "updated_at": row["updated_at"].isoformat(),
                            }
                        ),
                    ),
                )
                event = cur.fetchone()

                deltas.append(
                    {
                        "kind": "earthquake",
                        "entity_id": str(entity_id),
                        "observation_id": observation["id"],
                        "event_id": event["id"],
                        "external_id": row["external_id"],
                        "observed_at": row["observed_at"].isoformat(),
                        "lon": row["lon"],
                        "lat": row["lat"],
                        "magnitude": row["magnitude"],
                        "title": row["name"],
                    }
                )

        conn.commit()

    logger.info("Ingested earthquakes: %s", len(deltas))
    return deltas
