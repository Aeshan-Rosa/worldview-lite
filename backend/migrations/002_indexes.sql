CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities(kind);
CREATE INDEX IF NOT EXISTS idx_entities_source ON entities(source);

CREATE INDEX IF NOT EXISTS idx_observations_entity_time ON observations(entity_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_observations_geom ON observations USING GIST(geom);

CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_geom ON events USING GIST(geom);
