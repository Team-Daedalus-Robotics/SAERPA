# SAERPA

**Crop rotation guidance for small farmers, powered by NASA Earth observation data.**

SAERPA helps a small producer answer one practical question: *what should I plant next in this plot?*
It combines the planting calendar published by Embrapa, the botanical family and group of every crop, the
history of each plot, and NASA climate and soil moisture data for the farm's location, and turns them into
plain-language recommendations in Portuguese. There is no login, no jargon and no training required.

Built by **Team Daedalus Robotics** for the **NASA Space Apps Challenge 2026**.

---

## Why it matters

Planting the same crop, or a crop from the same botanical family, in the same plot year after year builds up
pests and diseases and drains the soil. Rotating crops fixes this, but small farmers rarely have an agronomist
at hand, and the decision also depends on the season and on how wet or dry the soil is. SAERPA brings these
factors together on a phone or a laptop.

## Features

- **Plot-level history.** The farmer draws each plot on a satellite map, names it, and records what was planted
  there. The last crop is shown on the map with its emoji.
- **Rotation recommendations.** For every crop in the Embrapa table that suits the region, the app scores how well
  it follows the previous crop (botanical family, rotation order, legumes returning nitrogen), whether it is
  the right planting season, and how fast it can be harvested. Each suggestion comes with its reasons.
- **Real NASA data per place.** Soil moisture, soil temperature, air temperature and humidity, and rainfall
  for the cell that contains the farm, updated by a background worker.
- **AI analyses.** A decision model (Laya) reads the latest sensor readings and satellite observations and
  answers questions such as *Does it need irrigation?* and *What should be planted next?*, showing which
  measurements it used and where they came from (field sensor, NASA hourly data or satellite daily data).
- **Field sensors.** A gateway receives readings from low-cost sensors (DHT11, DS18B20 and a capacitive soil
  moisture sensor). The sensor data in the demo is **simulated** from real NASA data for Navegantes, Brazil.
- **Works with poor connectivity.** The map around the property is saved automatically in the browser (up to
  100 MB), and the app shows a clear banner when the connection is lost.
- **One property per browser, no account.** The app always reopens on the last property. Switching to another
  city asks for confirmation and deletes the previous property.

## NASA data used

| Dataset | Variables | How SAERPA uses it |
|---|---|---|
| [NASA POWER](https://power.larc.nasa.gov) (MERRA-2), hourly | Surface soil moisture (`GWETTOP`), soil temperature (`TSOIL1`), air temperature (`T2M`), relative humidity (`RH2M`), rainfall (`PRECTOTCORR`); wind speed (`WS2M`) is also stored | Climate and soil moisture shown in the app and used by the AI analyses. One virtual station per 0.5° x 0.625° grid cell (about 55 x 66 km). |
| [SMAP](https://smap.jpl.nasa.gov) L3 enhanced soil moisture (`SPL3SMP_E.006`) through [AppEEARS](https://appeears.earthdatacloud.nasa.gov) | Soil moisture, 0 to 5 cm, daily (mean of the morning and evening passes) | Satellite observations stored per location and used by the AI analyses. Needs NASA Earthdata credentials. |

NASA data describes a region, not the exact plot. The help text and the map legend of the app say so.

## Architecture

```mermaid
flowchart LR
    Sensors["Field sensors<br/>(simulated in the demo)"] --> Gateway[station_data_gateway]
    POWER["NASA POWER<br/>hourly climate"] --> NasaWorker[nasa_event_worker]
    SMAP["NASA SMAP via AppEEARS<br/>daily soil moisture"] --> NasaWorker
    Gateway --> DB[("PostgreSQL + PostGIS")]
    NasaWorker --> DB
    DB --> SuggestionWorker["suggestion_worker<br/>(Laya decision model)"]
    SuggestionWorker --> DB
    DB --> API[FastAPI]
    API --> Web["React app<br/>(Leaflet map)"]
```

| Part | What it does |
|---|---|
| `src/web` | React 19 + Vite app with a Leaflet map, TanStack Query and TanStack Router. |
| `src/api` | FastAPI service: properties, plots, planting history, crop catalog, climate and recommendations. Read-only for sensor and satellite data. |
| `src/shared` | The `saerpa_shared` package: SQLAlchemy models, Alembic migrations, Pydantic schemas and clients shared by the API and the workers. |
| `src/nasa_event_worker` | Fetches NASA POWER climate for the places users ask about and the SMAP satellite observations. |
| `src/station_data_gateway` | Receives sensor readings and stores them. |
| `src/suggestion_worker` | Generates the AI analyses from the latest readings. |
| `apphost.mts` | [Aspire](https://aspire.dev) AppHost written in TypeScript: starts PostgreSQL/PostGIS, the API, the workers and the web app with one command. |

Design decisions:

- **Single writer for measurements.** Only the gateway and the workers write to the `event` table. The API never
  does, which keeps ingestion independent from the user-facing service.
- **Soft deletes everywhere.** Every entity has `created_at` and `deleted`.
- **Geometry in the database.** Plots are stored as PostGIS geography polygons. Polygon validity, area in
  hectares and the property centroid are computed by the database.
- **Migrations are code.** Alembic migrations run on API startup, and CI fails if two migrations share a head.

## How the rotation score works

The rotation engine runs in the browser (`src/web/src/services/rotacao.ts`) over the catalog served by the API.
Scores go from 0 to 100.

| Criterion | Source | Effect |
|---|---|---|
| Planting season in the region, in the chosen month | Embrapa table | +35 if it is the season, +15 if it starts next month |
| Same botanical family as the last crop | Team classification (database) | **Avoid** (shared pests and diseases) |
| Rotation order leaf, fruit, root, legume, leaf | Team classification | +45 for the ideal next group |
| Legume after leaf or fruit | Team classification | +35 (returns nitrogen to the soil) |
| Same family in the two previous seasons | Team classification | -15 |
| "Harvest quickly" option | Embrapa table (days to harvest) | up to +20 |

A score of 70 or more is shown as a great choice, and 50 or more as a good choice.

## How the AI analyses work

The app has two separate recommendation systems, shown separately on purpose:

| | Rotation score | AI analyses |
|---|---|---|
| Where it runs | In the browser | In the `suggestion_worker`, stored in the database |
| Method | Fixed, transparent rules (table above) | A decision model (Laya) that answers typed questions |
| Inputs | Previous crops, Embrapa season, harvest time | Sensor readings, NASA hourly data, SMAP daily observations, crop and planting history |
| Output | A 0 to 100 score with the reasons | A choice or a 1 to 5 score, with confidence and probabilities |

1. **Collect.** The worker gathers the latest sensor readings, NASA hourly data and SMAP observations.
2. **Ask.** It sends the Laya decision endpoint those readings, plus the candidate crops for the rotation question,
   and a typed question with its answer options (for example *Does the soil need irrigation?* or *Which crop
   should be planted next?*).
3. **Store.** The answer is saved in the `recommendation` table with the measurements that were used.
4. **Show.** The app displays each analysis with those measurements and where each came from: field sensor, NASA
   hourly data or satellite daily data.

## Getting started

Requirements: Docker running, Node 22 (or 20.19+), [uv](https://docs.astral.sh/uv/) and the Aspire CLI.

```bash
cp .env.example .env        # set the database password and, optionally, the Earthdata and Laya settings
npm install
npm --prefix src/web install
npm run aspire:start        # opens the Aspire dashboard; the `web` link is in the URLs column
```

The API applies the migrations and seeds the crop catalog on startup. The satellite (SMAP) job needs
`EARTHDATA_USER` and `EARTHDATA_PASS`; without them the worker skips it and everything else keeps working.
The AI analyses need the Ollaya CLI. See `.env.example` for all settings.

## Tests and continuous integration

```bash
cd src/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saerpa_test uv run --group dev pytest
```

The API tests need an empty PostgreSQL database with PostGIS. GitHub Actions
(`.github/workflows/ci.yml`) runs on every push and pull request: the API test suite, a check that Alembic has a
single migration head, the web type check and build, and the AppHost lint.

## Repository layout

```
apphost.mts               Aspire AppHost
src/api                   FastAPI service and its tests
src/shared                models, migrations, schemas, crop catalog data and scripts
src/nasa_event_worker     NASA POWER and SMAP worker
src/station_data_gateway  sensor gateway
src/suggestion_worker     AI analyses
src/web                   React front end
docs                      system description (PDF) and historical documents
```

Architecture notes, code conventions and known issues for contributors are in [AGENTS.md](AGENTS.md)
(in Portuguese). Front-end details are in [src/web/README.md](src/web/README.md).

## Current limitations and next steps

- The rotation rules (botanical families, crop groups, rotation order and score weights) were defined by the
  team and still need review by an agronomist.
- NASA grid cells are about 55 x 66 km, so moisture values describe the region, not the exact plot. Field
  sensors would close this gap, and the gateway is ready for them.
- The sensor readings in the demo are simulated. No sensors are deployed in the field yet.
- Each browser keeps a single property. Accounts, several properties per person and synchronization across
  devices are not implemented.
- Offline support covers the map and the app shell. Drawing plots without a connection would need a local queue
  that syncs later.
- The interface is in Brazilian Portuguese only.

## Data sources and acknowledgements

- **NASA POWER** and **NASA SMAP** (through AppEEARS and NASA Earthdata) for climate and soil moisture.
- **Embrapa**: planting calendar from the Sisteminha Embrapa table, "Informações gerais sobre o plantio de
  hortaliças", adapted from Amaro et al. (2007) and Embrapa Hortaliças and Sebrae (2010). It is an unofficial
  compilation; see [embrapa.br](https://www.embrapa.br) for official information.
- **IBGE** municipality codes, through [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros)
  (MIT license).
- **Map imagery:** Esri World Imagery and OpenStreetMap contributors, rendered with [Leaflet](https://leafletjs.com).
- Crop family and group classification: Team Daedalus Robotics.

## Documentation

- [`docs/SAERPA_funcionamento.pdf`](docs/SAERPA_funcionamento.pdf): how the system works (in Portuguese).
- [`src/web/README.md`](src/web/README.md): front-end structure, data sources and import steps.
- [`docs/historico/`](docs/historico/): historical documents kept as a record.
