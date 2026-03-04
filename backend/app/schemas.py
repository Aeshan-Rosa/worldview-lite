from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class Layer(BaseModel):
    id: str
    title: str
    kind: str
    description: str


class EntityOut(BaseModel):
    id: UUID
    external_id: str
    source: str
    kind: str
    name: str | None
    properties: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ObservationOut(BaseModel):
    id: int
    entity_id: UUID
    observed_at: datetime
    lon: float
    lat: float
    alt: float | None
    speed: float | None
    heading: float | None
    attrs: dict[str, Any]


class EventOut(BaseModel):
    id: int
    external_event_id: str | None
    entity_id: UUID | None
    source: str
    type: str
    severity: str | None
    title: str | None
    description: str | None
    occurred_at: datetime
    lon: float | None
    lat: float | None
    payload: dict[str, Any]


class TrackResponse(BaseModel):
    entity_id: UUID
    from_ts: datetime
    to_ts: datetime
    points: list[ObservationOut]
