import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian3,
  EllipsoidTerrainProvider,
  createWorldTerrainAsync,
  Color,
  defined,
  Ion,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type TerrainProvider,
  Viewer
} from "cesium";

import Sidebar from "./components/Sidebar";
import ObjectInspector from "./components/ObjectInspector";
import { apiBaseUrl, fetchEntities, fetchEvents, fetchLayers, fetchTrack } from "./lib/api";
import { LayerEngine } from "./lib/layerEngine";
import type { EntityRow, Layer, LiveDelta } from "./lib/types";

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || "";

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const layerEngineRef = useRef<LayerEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>();
  const [selectedMapObject, setSelectedMapObject] = useState<Record<string, unknown> | undefined>();
  const [liveMode, setLiveMode] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId),
    [entities, selectedEntityId]
  );

  useEffect(() => {
    let destroyed = false;

    async function boot() {
      if (!containerRef.current || destroyed) return;

      let terrainProvider: TerrainProvider = new EllipsoidTerrainProvider();
      const hasIonToken = Boolean(import.meta.env.VITE_CESIUM_ION_TOKEN);
      if (hasIonToken) {
        try {
          terrainProvider = await createWorldTerrainAsync();
        } catch (err) {
          console.error("Falling back to ellipsoid terrain", err);
        }
      }
      if (destroyed) return;

      const viewer = new Viewer(containerRef.current, {
        terrainProvider,
        baseLayerPicker: false,
        animation: false,
        timeline: false,
        infoBox: false,
        geocoder: false,
        shouldAnimate: false
      });
      const cameraController = viewer.scene.screenSpaceCameraController;
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/"
        })
      );
      cameraController.inertiaZoom = 0;
      cameraController.inertiaTranslate = 0;
      cameraController.inertiaSpin = 0;
      cameraController.minimumZoomDistance = 8000;
      cameraController.maximumZoomDistance = 25000000;
      cameraController.maximumMovementRatio = 0.15;
      cameraController.enableZoom = false;
      cameraController.enableLook = false;
      cameraController.enableTilt = false;
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.WHEEL);
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.PINCH_MOVE);
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.PINCH_START);
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.PINCH_END);

      viewer.scene.backgroundColor = Color.BLACK;
      viewer.scene.globe.enableLighting = false;
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(0, 15, 22000000)
      });

      viewerRef.current = viewer;
      layerEngineRef.current = new LayerEngine(viewer);

      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: unknown }) => {
        const picked = viewer.scene.pick(movement.position as any) as any;
        if (defined(picked) && picked?.id?.properties) {
          const out: Record<string, unknown> = {};
          const names = picked.id.properties.propertyNames ?? [];
          for (const key of names) {
            out[key] = picked.id.properties[key]?.getValue?.();
          }
          setSelectedMapObject(out);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

      try {
        const [layerRes, eventRes, entityRes] = await Promise.all([
          fetchLayers(),
          fetchEvents(),
          fetchEntities()
        ]);
        setLayers(layerRes);
        setEntities(entityRes);
        layerEngineRef.current.replaceEvents(eventRes);
        setInitError(null);
      } catch (err) {
        console.error("Failed to load initial data", err);
        setInitError("Failed to load API data. Check backend on :8000.");
      }
    }

    void boot().catch((err) => {
      console.error("Viewer init failed", err);
      setInitError("Cesium failed to initialize.");
    });

    return () => {
      destroyed = true;
      wsRef.current?.close();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
    };
  }, []);

  const toggleLayer = (id: string) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== id) return layer;
        const next = { ...layer, enabled: !layer.enabled };
        layerEngineRef.current?.setLayerEnabled(id, next.enabled);
        return next;
      })
    );
  };

  const connectLiveSocket = () => {
    if (wsRef.current) return;
    const wsBase = apiBaseUrl.replace("http", "ws");
    const ws = new WebSocket(`${wsBase}/ws/live`);

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data) as { type: string; payload?: LiveDelta };
      if (msg.type === "delta" && msg.payload) {
        layerEngineRef.current?.applyLiveDelta(msg.payload);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setLiveMode(false);
    };

    wsRef.current = ws;
    setLiveMode(true);
  };

  const toggleLive = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setLiveMode(false);
      return;
    }
    connectLiveSocket();
  };

  const runTrackQuery = async () => {
    if (!selectedEntityId) return;
    const track = await fetchTrack(selectedEntityId, 24);
    layerEngineRef.current?.drawTrack(track);
  };

  return (
    <div className="layout">
      <Sidebar
        layers={layers}
        entities={entities}
        selectedEntityId={selectedEntityId}
        liveMode={liveMode}
        onToggleLayer={toggleLayer}
        onSelectEntity={setSelectedEntityId}
        onFetchTrack={runTrackQuery}
        onToggleLive={toggleLive}
      />
      <main className="map" ref={containerRef} />
      <ObjectInspector selectedEntity={selectedEntity} selectedMapObject={selectedMapObject} />
      {initError && <div className="status-banner">{initError}</div>}
    </div>
  );
}
