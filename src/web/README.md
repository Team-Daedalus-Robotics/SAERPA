# Field Shift — front end (NASA Space Apps 2026)

App para o pequeno produtor decidir **o que plantar depois** no mesmo lugar, cuidando da terra.
Feito para ser simples: 3 passos numerados, botões grandes com texto, sem login, sem termos técnicos.

1. **Onde fica sua plantação?** — estado e cidade (todo o Brasil).
2. **O que você plantou por último?** — toque na planta (ou "Nada / não sei").
3. **O que plantar agora** — sugestões com o porquê e *como plantar* (espaçamento, jeito de plantar, dias até a colheita, produção por m²).

Opcional: marcar a área no mapa para guardar o histórico de cada canteiro ou roça.

**Ajuda** (botão no alto da tela):
- *Me mostre como usar* — passo a passo guiado com balões que destacam cada parte da tela (`components/Tour.tsx`).
  Para incluir uma parte nova no tour: coloque `data-tour="nome"` no elemento e adicione um item em `PASSOS_TOUR`.
- *Como cada parte funciona* — explicação de cada parte para ler com calma (`components/Ajuda.tsx`).

React 19 + TypeScript + Vite · mapa com Leaflet (react-leaflet).

## Rodar

O frontend roda junto com a API e o banco pelo Aspire. Na raiz do repositório:

    npm install
    npm --prefix src/web install
    npm run aspire:start    # abre o painel do Aspire; o link do `web` fica na coluna URLs

Só para checar tipos e gerar o build do frontend (dentro de `src/web`):

    npm run build

## Como a sugestão é calculada (`src/services/rotacao.ts`)

| Critério | Origem | Efeito |
|---|---|---|
| Época de plantio na região, no mês escolhido | Tabela Embrapa | +35 se é a época; +15 se começa no mês seguinte |
| Mesma família botânica da última planta | classificação no banco (`crop`) | **Evitar** (pragas e doenças em comum) |
| Ordem folha → fruto → raiz → leguminosa → folha | `classificacao.ts` | +45 se é o próximo grupo ideal |
| Leguminosa depois de folha/fruto | `classificacao.ts` | +35 (devolve nitrogênio) |
| Mesma família nas 2 safras anteriores | classificação no banco (`crop`) | −15 |
| "Quero colher rápido" | Tabela Embrapa (dias até a colheita) | até +20 |

Nota ≥ 70 = "Ótima escolha", ≥ 50 = "Boa escolha".

## Estrutura

    src/
      main.tsx                  provedores: TanStack Query + TanStack Router
      router.tsx                rotas (a cidade, o estado e a área ficam na URL)
      routes/PaginaInicial.tsx  tela e fluxo dos 3 passos
      components/
        LocationPicker.tsx      estado + cidade
        MapView.tsx             mapa, região de dados da NASA, áreas marcadas
        PlantouCard.tsx         passo 2
        SugestoesCard.tsx       passo 3
        ui.tsx                  peças reutilizáveis
      hooks/consultas.ts        TanStack Query: catálogo, áreas, histórico, umidade
      data/
        hortalicas.ts           funções sobre o catálogo (vem da API)
        classificacao.ts        grupos e ordem da rotação (folha → fruto → raiz → leguminosa)
        estados.json, municipios.json, locations.ts
      services/
        clienteApi.ts           fetch com erros em português
        catalogo.ts             GET /api/crops
        areas.ts                propriedades, áreas e histórico (API + PostGIS)
        rotacao.ts              motor de recomendação
        clima.ts                clima real da NASA POWER por local (GET /api/climate)

O catálogo de hortaliças **não fica mais no frontend**: vem do banco pela API. A planilha da
Embrapa, o script de importação e a classificação por família ficam em `src/shared`
(`data/`, `scripts/import_embrapa.py`, `src/saerpa_shared/seed/crops.json`).
Para atualizar a tabela, dentro de `src/shared`: edite `data/*` e rode
`uv run --with openpyxl python scripts/import_embrapa.py`; a API grava no banco ao iniciar.
Áreas marcadas e histórico por área ficam no banco; o histórico "cidade toda" fica no
navegador (`localStorage`).

## Fontes de dados

### Épocas de plantio, espaçamento, tipo de plantio, colheita e produção
- **Sisteminha Embrapa — "Informações gerais sobre o plantio de hortaliças"**
  (https://www.sisteminhaembrapa.org/tabela-de-plantio). Abas "Brasil" (5 regiões, 48 culturas) e "Região sul" (+9 culturas só para o Sul).
- Fonte citada na planilha: adaptado de Amaro et al. (2007) e Embrapa Hortaliças e Sebrae (2010).
- O site do Sisteminha informa que é uma iniciativa pessoal, sem fins lucrativos e não oficial. Informações oficiais: embrapa.br.
- Correções feitas na importação (erros de digitação da planilha):
  - "Batata-doc e" → "Batata-doce"
  - Agrião, Sudeste: "Fev/ju" → lido como "Fev/jul"
  - Couve-flor de verão: espaçamento 9 × 5 cm → 90 × 50 cm (igual à aba Sul e à couve-flor de inverno)

### Família botânica e grupo (folha/fruto/raiz/leguminosa)
- Classificação feita pelo time (`src/shared/data/crop_classification.json`), não faz parte da tabela da Embrapa.

### Estados e municípios
- [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) — Kelvin S. do Prado, licença MIT (© 2016).
  Códigos seguem o IBGE; as coordenadas vêm do repositório (não são publicação oficial do IBGE).

### Umidade do solo
- **NASA POWER** (https://power.larc.nasa.gov, modelo MERRA-2): umidade do solo na superfície (`GWETTOP`), temperatura do solo (`TSOIL1`), temperatura e umidade do ar (`T2M`, `RH2M`) e chuva (`PRECTOTCORR`), por hora, em células de 0,5° x 0,625° (cerca de 55 x 66 km). O `nasa_event_worker` busca a célula do local escolhido e grava em `event`; a API só lê e responde em `GET /api/climate` (enquanto o worker busca, o app mostra "Buscando os dados da NASA…"). São dados reais de modelo: valem para a região, não para o terreno exato.
