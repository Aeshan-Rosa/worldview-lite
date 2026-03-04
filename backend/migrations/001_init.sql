CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entities_source_external_uniq UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS observations (
  id BIGSERIAL PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  alt DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  geom geometry(Point, 4326) NOT NULL,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observations_entity_time_uniq UNIQUE (entity_id, observed_at)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  external_event_id TEXT,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT,
  title TEXT,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  lon DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  geom geometry(Point, 4326),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_source_external_uniq UNIQUE (source, external_event_id)
);
