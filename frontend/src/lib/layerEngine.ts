import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  Entity,
  PolylineGlowMaterialProperty,
  type Viewer
} from "cesium";
import type { EventRow, LiveDelta, TrackResponse } from "./types";

function eventColor(magnitude: number | null | undefined): Color {
  if (magnitude == null) return Color.YELLOW;
  if (magnitude >= 6) return Color.RED;
  if (magnitude >= 4) return Color.ORANGE;
  return Color.YELLOWGREEN;
}

export class LayerEngine {
  private eventsSource: CustomDataSource;
  private pointsSource: CustomDataSource;
  private tracksSource: CustomDataSource;

  constructor(viewer: Viewer) {
    this.eventsSource = new CustomDataSource("earthquake-events");
    this.pointsSource = new CustomDataSource("earthquake-points");
    this.tracksSource = new CustomDataSource("entity-tracks");

    viewer.dataSources.add(this.eventsSource);
    viewer.dataSources.add(this.pointsSource);
    viewer.dataSources.add(this.tracksSource);
  }

  setLayerEnabled(id: string, enabled: boolean): void {
    if (id === "earthquake-events") this.eventsSource.show = enabled;
    if (id === "earthquake-points") this.pointsSource.show = enabled;
    if (id === "entity-tracks") this.tracksSource.show = enabled;
  }

  replaceEvents(events: EventRow[]): void {
    this.eventsSource.entities.removeAll();
    this.pointsSource.entities.removeAll();

    for (const event of events) {
      if (event.lon == null || event.lat == null) continue;
      const mag = Number(event.severity ?? 0);
      const color = eventColor(Number.isNaN(mag) ? undefined : mag);

      const common = {
        id: `event-${event.id}`,
        position: Cartesian3.fromDegrees(event.lon, event.lat),
        properties: {
          source: event.source,
          type: event.type,
          severity: event.severity,
          title: event.title,
          description: event.description,
          occurred_at: event.occurred_at,
          payload: event.payload,
          entity_id: event.entity_id
        }
      };

      this.eventsSource.entities.add(
        new Entity({
          ...common,
          point: {
            pixelSize: 10,
            color,
            outlineColor: Color.WHITE,
            outlineWidth: 1
          },
          label: {
            text: event.title ?? "quake",
            scale: 0.45,
            fillColor: Color.WHITE,
            showBackground: true,
            backgroundColor: Color.BLACK.withAlpha(0.55),
            pixelOffset: new Cartesian2(0, -24)
          }
        })
      );

      this.pointsSource.entities.add(
        new Entity({
          id: `point-${event.id}`,
          position: Cartesian3.fromDegrees(event.lon, event.lat),
          point: {
            pixelSize: 6,
            color: Color.CYAN.withAlpha(0.85)
          },
          properties: {
            title: event.title,
            entity_id: event.entity_id,
            occurred_at: event.occurred_at
          }
        })
      );
    }
  }

  applyLiveDelta(delta: LiveDelta): void {
    const entityId = `live-${delta.event_id}`;
    const existing = this.eventsSource.entities.getById(entityId);
    const color = eventColor(delta.magnitude);
    const pos = Cartesian3.fromDegrees(delta.lon, delta.lat);

    if (existing) {
      existing.position = new ConstantPositionProperty(pos);
      if (existing.point) {
        existing.point.color = new ConstantProperty(color);
      }
      return;
    }

    this.eventsSource.entities.add(
      new Entity({
        id: entityId,
        position: pos,
        point: { pixelSize: 11, color, outlineColor: Color.WHITE, outlineWidth: 1 },
        label: {
          text: delta.title ?? delta.external_id,
          scale: 0.45,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.6),
          fillColor: Color.WHITE
        },
        properties: {
          entity_id: delta.entity_id,
          external_id: delta.external_id,
          observed_at: delta.observed_at,
          magnitude: delta.magnitude,
          title: delta.title,
          live: true
        }
      })
    );
  }

  drawTrack(track: TrackResponse): void {
    this.tracksSource.entities.removeAll();
    if (!track.points.length) return;

    const positions = track.points.map((p) => Cartesian3.fromDegrees(p.lon, p.lat));

    this.tracksSource.entities.add(
      new Entity({
        id: `track-${track.entity_id}`,
        polyline: {
          positions,
          width: 4,
          material: new PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Color.LIME
          })
        },
        properties: {
          entity_id: track.entity_id,
          from_ts: track.from_ts,
          to_ts: track.to_ts,
          points: track.points.length
        }
      })
    );

    const latest = track.points[track.points.length - 1];
    this.pointsSource.entities.add(
      new Entity({
        id: `track-tail-${track.entity_id}`,
        position: Cartesian3.fromDegrees(latest.lon, latest.lat),
        point: {
          pixelSize: 8,
          color: Color.LIME
        },
        properties: {
          entity_id: track.entity_id,
          observed_at: latest.observed_at
        }
      })
    );
  }
}
