# SAERPA — front end (NASA Space Apps 2026)

An app for small farmers to decide **what to plant next** in the same place while taking care of the soil.
Designed to be simple: 3 numbered steps, large buttons with text, no login, no technical terms.
The interface text is in Brazilian Portuguese.

1. **Onde fica sua plantação?** (Where is your farm?): state and city (all of Brazil).
2. **O que você plantou por último?** (What did you plant last?): tap the plant, or "Nada / não sei" (Nothing / don't know).
3. **O que plantar agora** (What to plant now): suggestions with the reasons and *how to plant* (spacing, planting method, days to harvest, yield per m²).

Optional: draw the area on the map to keep the history of each plot.

**One property per browser.** The app always reopens on the last property the user chose. Switching to another
city asks for confirmation and really deletes the old property (areas and history included) through
`DELETE /api/properties/{id}`.

**Help** (button at the top of the screen):
- *Me mostre como usar* (Show me how to use it): a guided tour with balloons highlighting each part of the screen (`components/Tour.tsx`).
  To add a new part to the tour, put `data-tour="name"` on the element and add an item to `PASSOS_TOUR`.
- *Como cada parte funciona* (How each part works): an explanation of every part, to read calmly (`components/Ajuda.tsx`).

React 19 + TypeScript + Vite, with a Leaflet map (react-leaflet).

## Running

The front end runs together with the API and the database through Aspire. From the repository root:

    npm install
    npm --prefix src/web install
    npm run aspire:start    # opens the Aspire dashboard; the `web` link is in the URLs column

To only type-check and build the front end (inside `src/web`):

    npm run build

## Offline map

Without clicking anything, the app saves in the background (Cache API, at most 100 MB) the satellite and street
images around the property (radius of 2 to 20 km, zoom 8 to 16, chosen to fit the budget). A service worker
(`public/sw.js`, production only) serves those images and the app itself without a connection, and a
"Sem internet" banner appears when the connection drops. The map zoom stops at level 16 because Esri has no
satellite imagery above it in rural areas. The saved map lives only in the user's browser, never in the backend.

## How the suggestion is calculated (`src/services/rotacao.ts`)

| Criterion | Source | Effect |
|---|---|---|
| Planting season in the region, in the chosen month | Embrapa table | +35 if it is the season; +15 if it starts next month |
| Same botanical family as the last plant | classification in the database (`crop`) | **Avoid** (shared pests and diseases) |
| Order leaf → fruit → root → legume → leaf | `classificacao.ts` | +45 if it is the ideal next group |
| Legume after leaf/fruit | `classificacao.ts` | +35 (returns nitrogen to the soil) |
| Same family in the 2 previous seasons | classification in the database (`crop`) | −15 |
| "Quero colher rápido" (I want a quick harvest) | Embrapa table (days to harvest) | up to +20 |

Score ≥ 70 = "Ótima escolha" (great choice), ≥ 50 = "Boa escolha" (good choice).

## Structure

    src/
      main.tsx                  providers: TanStack Query + TanStack Router
      router.tsx                routes (city, state and area live in the URL)
      routes/PaginaInicial.tsx  the screen and the flow of the 3 steps
      components/
        LocationPicker.tsx      state + city
        TrocaDePropriedade.tsx  current property card and the swap warning
        MapView.tsx             map, NASA data region, drawn areas
        PlantouCard.tsx         step 2
        SugestoesCard.tsx       step 3
        ui.tsx                  reusable pieces
      hooks/
        consultas.ts            TanStack Query: catalog, areas, history, moisture
        mapaOffline.ts          connection status and automatic offline map saving
      lib/
        propriedadeAtual.ts     the single property kept in the browser
        mapaOffline.ts          offline map download (100 MB cap)
        camadasDoMapa.ts        map layers and zoom limit
      data/
        hortalicas.ts           functions over the catalog (it comes from the API)
        classificacao.ts        rotation groups and order (leaf → fruit → root → legume)
        estados.json, municipios.json, locations.ts
      services/
        clienteApi.ts           fetch with error messages in Portuguese
        catalogo.ts             GET /api/crops
        areas.ts                properties, areas and history (API + PostGIS)
        rotacao.ts              recommendation engine
        clima.ts                real NASA POWER climate per place (GET /api/climate)

The vegetable catalog **is no longer in the front end**: it comes from the database through the API. The
Embrapa spreadsheet, the import script and the classification by family live in `src/shared`
(`data/`, `scripts/import_embrapa.py`, `src/saerpa_shared/seed/crops.json`).
To update the table, inside `src/shared`: edit `data/*` and run
`uv run --with openpyxl python scripts/import_embrapa.py`; the API writes it to the database on startup.
Drawn areas and the per-area history live in the database; the "whole city" history is kept in the
browser (`localStorage`).

## Data sources

### Planting seasons, spacing, planting type, harvest and yield
- **Sisteminha Embrapa, "Informações gerais sobre o plantio de hortaliças"**
  (https://www.sisteminhaembrapa.org/tabela-de-plantio). Tabs "Brasil" (5 regions, 48 crops) and "Região sul" (+9 crops for the South only).
- Source cited in the spreadsheet: adapted from Amaro et al. (2007) and Embrapa Hortaliças and Sebrae (2010).
- The Sisteminha website states that it is a personal, non-profit and unofficial initiative. Official information: embrapa.br.
- Fixes made during the import (typos in the spreadsheet):
  - "Batata-doc e" → "Batata-doce"
  - Watercress (Agrião), Southeast: "Fev/ju" → read as "Fev/jul"
  - Summer cauliflower: spacing 9 × 5 cm → 90 × 50 cm (same as the South tab and winter cauliflower)

### Botanical family and group (leaf/fruit/root/legume)
- Classification made by the team (`src/shared/data/crop_classification.json`); it is not part of the Embrapa table.

### States and municipalities
- [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros): Kelvin S. do Prado, MIT license (© 2016).
  Codes follow IBGE; the coordinates come from that repository (they are not an official IBGE publication).

### Soil moisture
- **NASA POWER** (https://power.larc.nasa.gov, MERRA-2 model): surface soil moisture (`GWETTOP`), soil temperature (`TSOIL1`), air temperature and humidity (`T2M`, `RH2M`) and rainfall (`PRECTOTCORR`), hourly, in cells of 0.5° x 0.625° (about 55 x 66 km). The `nasa_event_worker` fetches the cell of the chosen place and writes it to `event`; the API only reads it and answers at `GET /api/climate` (while the worker is fetching, the app shows "Buscando os dados da NASA…"). This is real model data: it is valid for the region, not for the exact plot.
