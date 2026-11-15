# SAERPA — Guia do Projeto

Projeto Aspire (AppHost TypeScript) com orquestração local: API FastAPI, três workers
Python e frontend React/Vite, sobre PostgreSQL com volume persistente.

## Stack

| Camada | Tecnologia |
|---|---|
| Orquestração | Aspire CLI 13.6.x, AppHost **TypeScript** (`apphost.mts`) |
| API | FastAPI + Uvicorn (`addUvicornApp`) |
| Workers | Python puro (`addPythonApp`), todos com **uv** explícito (`.withUv()`) |
| Dados | PostgreSQL 18 (container, lifetime persistente + volume nomeado `saerpa-postgres-data`) |
| Frontend | React 19 + Vite 7 (`addViteApp`) |
| Gerenciador Python | **uv** (0.11.x) — nunca pip |
| Gerenciador Node (AppHost/web) | npm |

## Estrutura

```
apphost.mts              # grafo de recursos (postgres, api, 3 workers, web)
aspire.config.json       # config do AppHost (language: typescript/nodejs)
src/
├── api/                 # FastAPI (uvicorn main:app)
│   ├── pyproject.toml   # fastapi, uvicorn, sqlalchemy via saerpa-shared
│   ├── main.py          # re-exporta app.main.app (entrypoint do uvicorn)
│   └── app/
│       ├── main.py      # FastAPI() + include_routers (lifespan aplica migrations)
│       ├── deps.py      # get_session/SessionDep (SessionLocal do shared)
│       ├── exceptions.py# ConflictError, NotFoundError (domínio)
│       ├── repositories/# acesso a dados (station_repository, measure_repository)
│       ├── services/    # regras de aplicação (station_service)
│       └── controllers/ # rotas finas (status, stations, crops, properties, fields, climate) — mapeiam exceções→HTTP
├── shared/              # pacote saerpa-shared (instalável, layout src/)
│   ├── pyproject.toml   # sqlalchemy, psycopg[binary], geoalchemy2, alembic
│   ├── alembic.ini
│   ├── data/            # planilha Embrapa + crop_classification.json (fontes do catálogo)
│   ├── scripts/         # import_embrapa.py → gera seed/crops.json
│   ├── migrations/      # Alembic (env.py lê DATABASE_URL; 0001_initial ... 0006_climate_cell)
│   └── src/saerpa_shared/
│       ├── base.py      # Base(DeclarativeBase)
│       ├── engine.py    # engine = create_engine(DATABASE_URL); SessionLocal
│       ├── migrator.py  # run_migrations() (alembic upgrade head)
│       ├── seeder.py    # seed_crops(): grava o catálogo da Embrapa (idempotente, por slug)
│       ├── nasa_power.py# cliente da NASA POWER (horário) + célula da grade MERRA-2 (0,5° x 0,625°)
│       ├── climate.py   # (usado só pelo worker) process_pending_cells(): grava dados da NASA em `event`, 1 estação virtual por célula
│       ├── seed/        # crops.json (GERADO por scripts/import_embrapa.py)
│       ├── models/      # Station, Measure, Event, Property, Crop, CropPlantingWindow, Field, Planting, RotationRule
│       └── schemas/     # Pydantic Request/Response (station, measure) — fonte única
├── nasa_event_worker/   # worker: busca a NASA POWER das células pedidas (`climate_cell`) e grava em `event`
├── station_data_gateway/# worker: gateway de estações (placeholder)
├── suggestion_worker/   # worker: sugestões (placeholder)
└── web/                 # React/Vite + TanStack Query/Router (Field Shift); proxy /api → services__api__http__0
```

## Grafo de dependências (AppHost)

`postgres` → (`database` saerpa) → **workers** → **api** (wait for workers) → **web** (wait for api)

- API e workers recebem `DATABASE_URL` via `database.uriExpression()`.
- API aguarda os 3 workers (`waitFor`); web aguarda a API e publica como
  `publishAsStaticWebsite` (proxy `/api` em produção).
- Portas **sempre gerenciadas** pelo Aspire (env `PORT`) — nunca fixas.
- Deployment Docker Compose foi **removido** por decisão — somente run local por ora.

## Banco de dados

- **Migrations com Alembic** (migração da antiga decisão "sem migrations"): estrutura em
  `src/shared/` (`alembic.ini` + `migrations/`), env lê `DATABASE_URL` do ambiente.
- A **API aplica `alembic upgrade head` e depois `seed_crops()` no startup** (lifespan) — Aspire
  garante o Postgres pronto antes. Para aplicar manualmente: `uv run alembic upgrade head`
  dentro de `src/shared` (com `DATABASE_URL` exportada).
- Nova revisão: `uv run alembic revision --autogenerate -m "..."` dentro de `src/shared`
  (compara as models do `saerpa_shared` com o banco).
- Tabelas: `station` (id, unique_identifier UNIQUE, created_at),
  `measure` (id, station_id FK→station CASCADE, type, sensor_name, measurement_unit, data_type)
  e `event` (id, timestamp, station_id FK→station CASCADE, measure_id FK→measure CASCADE,
  measure_type, value) e `property` (id, name, lat, lng, created_at, deleted).
- Geo: PostGIS (`field.geometry` = GEOGRAPHY(Polygon, 4326)) — o Postgres do AppHost
  precisa trocar a imagem para `postgis/postgis:18-*` (extensão criada em `0001_initial`).
- `crop` guarda o **catálogo da Embrapa** (slug UNIQUE, botanical_family, crop_group, emoji,
  row_spacing_centimeters, plant_spacing_centimeters, planting_type, harvest_days_min/max,
  production_per_square_meter, source); `crop_planting_window` (crop_id, region, month — PK composta)
  guarda as épocas de plantio por região. Culturas sem `slug` (cadastradas à mão) não aparecem na API.
- Endpoints do Field Shift: `GET /api/crops`; `POST /api/properties`, `GET /api/properties/{id}`;
  `GET|POST /api/properties/{id}/fields`; `PATCH /api/fields/{id}` (renomear; o nome é opcional na interface e
  "Área N" é o padrão); `DELETE /api/fields/{id}`; `PUT /api/fields/{id}/history`
  (substitui o histórico: últimas culturas plantadas, gravadas em `planting`). Sem login: o navegador
  guarda o id da propriedade por cidade. `property.lat/lng` começa na sede do município e, a partir da
  primeira área, passa a ser o **centro das áreas** (PostGIS `ST_Centroid`, ponderado pelo tamanho),
  recalculado ao criar/apagar área; sem áreas restantes, mantém o último ponto.
- **Quem grava em `event`**: SOMENTE o `station_data_gateway` e os workers. **A API nunca grava em `event`**
  (nem cria estações/medidas); ela só lê e, no máximo, registra pedidos em outras tabelas.
- **Clima real (NASA POWER)**: `GET /api/climate?lat=&lng=` calcula a célula da NASA do ponto (grade MERRA-2,
  0,5° x 0,625°), registra o pedido em `climate_cell` e **só lê** o que já está em `event`. Respostas: `200` com
  umidade do solo, temperaturas, umidade do ar e chuva; `202 {"status":"pending"}` quando o worker ainda não
  buscou a célula (o app tenta de novo a cada 3 s); `502` se a NASA falhou há menos de 60 s e não há dados.
  Quem busca e grava é o **`nasa_event_worker`** (`saerpa_shared.climate`): a cada `CLIMATE_POLL_SECONDS` (padrão 3 s; o ciclo de observações de satélite usa `NASA_EVENT_POLL_SECONDS`)
  atende até 3 células pedidas, traz 30 dias por hora na primeira vez, atualiza a cada 6 h as
  células pedidas nos últimos 30 dias e, se a NASA falhar, tenta de novo após 60 s (erro em `climate_cell`).
  Cada célula é uma estação virtual `nasa-power-lat<±lat>_lng<±lng>` (medidas `soil_moisture` %,
  `soil_temperature`, `air_temperature`, `air_humidity`, `rainfall` mm/h; `sensor_name` `NASA POWER <variável>`).
- Sensores simulados (demonstração): `src/shared/scripts/simulate_sensor_events.py` simula o que DHT11, DS18B20 e
  Capacitive Soil Moisture v2.0 enviariam (a partir de dados reais da NASA, baixados por `fetch_nasa_power.py`,
  cópia em `src/shared/data/nasa_power/`; a chuva entra da NASA) e **envia os pacotes ao `station_data_gateway`**
  (`POST /api/stations/data`, formato `{unique_identifier, timestamp, measures[]}`) com `--gateway-url` (a porta
  aparece no painel do Aspire; `--insecure` para https de desenvolvimento). É o gateway que cria a estação
  `sim-navegantes-001`, as medidas e grava `event`. O gateway não deduplica: enviar duas vezes duplica (o script
  recusa se a estação já tiver eventos, salvo `--force`). `--direct-database` grava direto e serve só para testes.
- Demais tabelas: `crop` (catálogo), `planting` (field_id, crop_id, planting_date,
  harvest_date NULL = ainda plantado) e `rotation_rule` (PK composta
  previous_crop_id+suggested_crop_id, priority 1 = melhor opção, reason).
- Entidades no `saerpa_shared/models/` **devem espelhar** o DDL — qualquer mudança de
  tabela exige atualizar o `.sql` e a model juntos.

## Convenções de código

- **SQLAlchemy no estilo clássico** (`id = Column(Integer, primary_key=True)`), não
  `Mapped[...]`/`mapped_column`.
- **Toda entidade deve ter `created_at` e `deleted`** (soft delete; `deleted = Column(Boolean, default=False)`).
- **Frontend (React/Vite): usar TanStack Query** (server state — fetch, cache, mutations)
  e **TanStack Router** (roteamento) — nunca fetch manual em `useEffect` nem react-router.
- Base e conexão: `from saerpa_shared.base import Base`, `from saerpa_shared.engine import engine, SessionLocal`.
- **Pydantic: sufixos `Request`/`Response`** (nunca `In`/`Out`). Schemas vivem em
  `saerpa_shared/schemas/` (fonte única p/ API e workers). Responses de entidade usam
  `model_config = ConfigDict(from_attributes=True)`.
- Nomes em **inglês** (código, tabelas, colunas). Textos de UI em pt-BR.
- **Nunca usar abreviações** — nem em tabelas/colunas, nem no código (ex.: usar
  `property`, `measurement_unit`, `repository`, não `prop`, `unit`, `repo`).
- FastAPI: rotas em camada fina; regra de sessão via `Depends` (`SessionDep`), rollback em erro.
- **Camadas da api**: `controllers/` (rotas, mapeiam `ConflictError`/`NotFoundError`→HTTP)
  → `services/` (regras, commit/rollback) → `repositories/` (queries) → `saerpa_shared.models`.
- Sem comentários decorativos; código autoexplicativo.

## Comandos

```powershell
# Validar AppHost (lint + typecheck)
npm run build

# Subir/parar tudo (dashboard incluso)
npm run aspire:start
aspire stop --non-interactive --apphost C:\projetos\SAERPA\apphost.mts

# Esperar recurso / status
aspire wait <recurso> --non-interactive
aspire describe --format Json --non-interactive

# Python (sempre dentro do diretório do serviço)
uv sync
uv add --editable ../shared        # usar saerpa-shared num serviço
python -m py_compile <arquivos>

# Aplicar DDL manual (com DATABASE_URL do painel exportado)
uv run alembic upgrade head          # dentro de src/shared
```

## Requisitos

- Node ^20.19 / ^22.13 / >=24 (npm global: `@microsoft/aspire-cli`)
- uv 0.11+ no PATH (os venvs são criados em `src/*/.venv`, ignorados pelo git)
- Docker Desktop/Engine rodando (Postgres é container com lifetime persistente)

## Gotchas conhecidos

- Instaladores dos recursos Python podem falhar se o `.venv` pré-existente não
  satisfizer `requires-python` — recriar com `uv sync` no diretório resolve.
- `engine.py` importa falhando sem `DATABASE_URL` (o Aspire injeta nos recursos).
- Volume persistente + senha regenerada = erro de autenticação do Postgres: remover
  container e volume (`docker volume rm saerpa-postgres-data`) e reiniciar.
- Skills Aspire do projeto ficam em `.agents/skills/` — seguem-se as versões locais.
