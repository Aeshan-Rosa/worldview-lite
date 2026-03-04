# WorldView-Lite

WorldView-Lite is a geospatial situational-awareness app with:
- React + Vite + TypeScript + CesiumJS frontend
- FastAPI backend exposing REST + WebSocket
- PostgreSQL + PostGIS storage with SQL migrations
- Connector + scheduled ingestion (USGS earthquake feed)
- Normalization into `entities`, `observations`, and `events`
- Live delta broadcasting over WebSocket
- Historical track query per entity

## Architecture

- `frontend/`: map UI, layer manager, object inspector, live mode, historical query controls
- `backend/`: FastAPI API, WebSocket live hub, ingestion scheduler, migration runner
- `backend/migrations/`: SQL schema/index migrations for PostGIS
- `docker-compose.yml`: PostGIS DB + backend services

## Features Implemented

- Layer engine
  - `points` layer (earthquake observation markers)
  - `events` layer (earthquake event markers)
  - `tracks` layer (historical polyline for selected entity)
- Sidebar layer manager
  - layer visibility toggles
  - entity list selection
  - historical track query trigger
  - live mode toggle
- Object inspector
  - selected entity details
  - selected map object properties
- Live mode via WebSocket
  - backend broadcasts ingestion deltas to `/ws/live`
- Historical track query
  - `GET /entities/{entity_id}/track?start=&end=`
- Connector and ingestion
  - USGS feed: `all_hour.geojson`
  - scheduled via APScheduler (`INGEST_INTERVAL_SECONDS`)
  - upsert normalized data into DB

## Data Model (PostGIS)

- `entities`
  - stable object identity (`source`, `external_id` unique)
- `observations`
  - timestamped position/telemetry rows per entity
  - PostGIS `geom(Point,4326)`
  - unique `(entity_id, observed_at)`
- `events`
  - domain events (earthquakes)
  - optional `entity_id` link
  - PostGIS `geom(Point,4326)`

## Run with Docker Compose (Backend + DB)

From repo root:

```bash
docker compose up --build
```

This starts:
- DB: `localhost:5432` (`worldview/worldview`)
- API: `http://localhost:8000`

Migrations are applied automatically in backend container startup (`python -m scripts.migrate`).

## Run Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Optional Environment Variables

### Backend
Copy `backend/.env.example` to `backend/.env` for local non-docker runs.

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `CORS_ORIGINS`
- `USGS_FEED_URL`
- `INGEST_INTERVAL_SECONDS`

### Frontend
Use `frontend/.env` if needed:

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_CESIUM_ION_TOKEN=<your_cesium_ion_token_optional>
```

Cesium can run without an Ion token for basic rendering; token improves terrain/asset access.

## API Endpoints

- `GET /health`
- `GET /layers`
- `GET /entities`
- `GET /entities/{entity_id}`
- `GET /events`
- `GET /entities/{entity_id}/track`
- `WS /ws/live`

## Local Backend Run (without Docker)

Requirements: Python 3.12+, reachable Postgres/PostGIS.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m scripts.migrate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Notes

- Connector currently ingests USGS earthquakes every 60s by default.
- Delta broadcasting currently emits one message per ingested event/observation row.
- Tracks are derived from `observations` for the selected entity and time range.
