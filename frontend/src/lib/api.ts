import axios from "axios";
import type { EntityRow, EventRow, Layer, TrackResponse } from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
});

export async function fetchLayers(): Promise<Layer[]> {
  const { data } = await api.get<Layer[]>("/layers");
  return data.map((l) => ({ ...l, enabled: true }));
}

export async function fetchEvents(hours = 12): Promise<EventRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  const { data } = await api.get<EventRow[]>("/events", {
    params: {
      start: start.toISOString(),
      end: end.toISOString(),
      limit: 500
    }
  });
  return data;
}

export async function fetchEntities(): Promise<EntityRow[]> {
  const { data } = await api.get<EntityRow[]>("/entities", {
    params: { source: "usgs", kind: "earthquake", limit: 500 }
  });
  return data;
}

export async function fetchTrack(entityId: string, hours = 24): Promise<TrackResponse> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  const { data } = await api.get<TrackResponse>(`/entities/${entityId}/track`, {
    params: {
      start: start.toISOString(),
      end: end.toISOString(),
      limit: 5000
    }
  });
  return data;
}

export const apiBaseUrl = api.defaults.baseURL || "http://localhost:8000";
