import type { EntityRow } from "../lib/types";

interface ObjectInspectorProps {
  selectedEntity?: EntityRow;
  selectedMapObject?: Record<string, unknown>;
}

export default function ObjectInspector({ selectedEntity, selectedMapObject }: ObjectInspectorProps) {
  return (
    <aside className="inspector">
      <h2>Object Inspector</h2>

      <h3>Selected Entity</h3>
      <pre>{JSON.stringify(selectedEntity ?? {}, null, 2)}</pre>

      <h3>Selected Map Object</h3>
      <pre>{JSON.stringify(selectedMapObject ?? {}, null, 2)}</pre>
    </aside>
  );
}
