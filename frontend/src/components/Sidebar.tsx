import type { EntityRow, Layer } from "../lib/types";

interface SidebarProps {
  layers: Layer[];
  entities: EntityRow[];
  selectedEntityId?: string;
  liveMode: boolean;
  onToggleLayer: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onFetchTrack: () => void;
  onToggleLive: () => void;
}

export default function Sidebar(props: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1>WorldView-Lite</h1>
      <section>
        <h2>Layer Manager</h2>
        {props.layers.map((layer) => (
          <label key={layer.id} className="checkbox-row">
            <input
              type="checkbox"
              checked={layer.enabled}
              onChange={() => props.onToggleLayer(layer.id)}
            />
            <span>{layer.title}</span>
          </label>
        ))}
      </section>

      <section>
        <h2>Live Mode</h2>
        <button onClick={props.onToggleLive}>{props.liveMode ? "Stop Live" : "Start Live"}</button>
      </section>

      <section>
        <h2>Entities</h2>
        <div className="entity-list">
          {props.entities.slice(0, 80).map((entity) => (
            <button
              key={entity.id}
              className={props.selectedEntityId === entity.id ? "entity active" : "entity"}
              onClick={() => props.onSelectEntity(entity.id)}
            >
              {entity.name ?? entity.external_id}
            </button>
          ))}
        </div>
        <button disabled={!props.selectedEntityId} onClick={props.onFetchTrack}>
          Query Historical Track (24h)
        </button>
      </section>
    </aside>
  );
}
