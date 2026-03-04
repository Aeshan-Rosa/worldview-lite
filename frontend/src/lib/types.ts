export type LayerKind = "points" | "tracks" | "events";

export interface Layer {
  id: string;
  title: string;
  kind: LayerKind;
  description: string;
  enabled: boolean;
}

export interface EntityRow {
  id: string;
  external_id: string;
  source: string;
  kind: string;
  name: string | null;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Observation {
  id: number;
  entity_id: string;
  observed_at: string;
  lon: number;
  lat: number;
  alt?: number | null;
  speed?: number | null;
  heading?: number | null;
  attrs: Record<string, unknown>;
}

export interface EventRow {
  id: number;
  external_event_id?: string | null;
  entity_id?: string | null;
  source: string;
  type: string;
  severity?: string | null;
  title?: string | null;
  description?: string | null;
  occurred_at: string;
  lon?: number | null;
  lat?: number | null;
  payload: Record<string, unknown>;
}

export interface TrackResponse {
  entity_id: string;
  from_ts: string;
  to_ts: string;
  points: Observation[];
}

export interface LiveDelta {
  kind: string;
  entity_id: string;
  observation_id: number;
  event_id: number;
  external_id: string;
  observed_at: string;
  lon: number;
  lat: number;
  magnitude?: number | null;
  title?: string | null;
}
