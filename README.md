# SAERPA

An app for small farmers to decide **what to plant next** in the same place while taking care of the soil.
Built by **Team Daedalus Robotics** (NASA Space Apps 2026). The user interface is in Brazilian Portuguese.

The user picks a city, draws the areas of the property on the map and tells what was planted last.
The app suggests the next crop (crop rotation plus the Embrapa planting calendar), shows the climate and
soil moisture from NASA, and displays AI analyses and sensor data.

## How it works

| Part | What it does |
|---|---|
| `src/web` | React 19 + Vite app (Leaflet map, TanStack Query/Router). No login: each browser keeps a single property. |
| `src/api` | FastAPI API (properties, areas, planting history, crop catalog, climate, recommendations). |
| `src/shared` | The `saerpa_shared` package: models, migrations (Alembic), schemas and shared clients. |
| `src/nasa_event_worker` | Fetches NASA POWER climate for the requested regions and the satellite observations. |
| `src/station_data_gateway` | Receives sensor data and writes it to `event`. |
| `src/suggestion_worker` | Generates the AI recommendations (Laya) from the events. |
| `apphost.mts` | Aspire (TypeScript AppHost): starts PostgreSQL/PostGIS, the API, the workers and the app. |

Only the `station_data_gateway` and the workers write to the `event` table. The API only reads it.

## Running

Requirements: Docker running, Node 22 (or 20.19+), [uv](https://docs.astral.sh/uv/) and the Aspire CLI.

```bash
cp .env.example .env        # adjust the passwords
npm install
npm --prefix src/web install
npm run aspire:start        # opens the Aspire dashboard; the `web` link is in the URLs column
```

The API applies the migrations and seeds the crop catalog on startup. Architecture, code conventions,
database details and known issues are documented in [AGENTS.md](AGENTS.md) (in Portuguese).

## Tests

```bash
cd src/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saerpa_test uv run --group dev pytest
```

It needs an empty PostgreSQL database with PostGIS. GitHub Actions (`.github/workflows/ci.yml`) runs the API
tests, the Alembic single-head check, the web type check and build, and the AppHost lint on every push.

## Documents

- [`docs/SAERPA_funcionamento.pdf`](docs/SAERPA_funcionamento.pdf): how the system works (in Portuguese).
- [`docs/historico/`](docs/historico/): old documents, kept only as a record.
- [`src/web/README.md`](src/web/README.md): front-end details.
