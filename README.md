# SAERPA

Aplicativo para o pequeno produtor decidir **o que plantar depois** no mesmo lugar, cuidando da terra.
Projeto do time **Team Daedalus Robotics** (NASA Space Apps 2026).

A pessoa escolhe a cidade, marca no mapa as áreas da propriedade e informa o que plantou por último.
O app sugere a próxima cultura (rotação de culturas, época de plantio da Embrapa) e mostra o clima e a
umidade do solo vindos da NASA, além de análises feitas por IA e dados de sensores.

## Como funciona

| Parte | O que faz |
|---|---|
| `src/web` | App React 19 + Vite (mapa com Leaflet, TanStack Query/Router). Funciona sem login e guarda uma propriedade por navegador. |
| `src/api` | API FastAPI (propriedades, áreas, histórico, catálogo de culturas, clima, recomendações). |
| `src/shared` | Pacote `saerpa_shared`: modelos, migrations (Alembic), schemas e clientes compartilhados. |
| `src/nasa_event_worker` | Busca na NASA POWER o clima das regiões pedidas e as observações de satélite. |
| `src/station_data_gateway` | Recebe os dados dos sensores e grava em `event`. |
| `src/suggestion_worker` | Gera as recomendações de IA (Laya) a partir dos eventos. |
| `apphost.mts` | Aspire (AppHost TypeScript): sobe PostgreSQL/PostGIS, API, workers e o app. |

Só o `station_data_gateway` e os workers gravam na tabela `event`. A API apenas lê.

## Como rodar

Requisitos: Docker rodando, Node 22 (ou 20.19+), [uv](https://docs.astral.sh/uv/) e o Aspire CLI.

```bash
cp .env.example .env        # ajuste as senhas
npm install
npm --prefix src/web install
npm run aspire:start        # abre o painel do Aspire; o link do `web` fica na coluna URLs
```

A API aplica as migrations e o catálogo de culturas sozinha na subida. Detalhes de arquitetura, convenções
de código, banco de dados e problemas conhecidos estão no [AGENTS.md](AGENTS.md).

## Testes

```bash
cd src/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saerpa_test uv run --group dev pytest
```

Precisa de um PostgreSQL com PostGIS vazio. O GitHub Actions (`.github/workflows/ci.yml`) roda os testes da
API, a checagem de migrations (uma só cabeça), os tipos e o build do app e o lint do AppHost a cada envio.

## Documentos

- [`docs/SAERPA_funcionamento.pdf`](docs/SAERPA_funcionamento.pdf) — explicação do funcionamento.
- [`docs/historico/`](docs/historico/) — documentos antigos, mantidos só como registro.
- [`src/web/README.md`](src/web/README.md) — detalhes do front.
