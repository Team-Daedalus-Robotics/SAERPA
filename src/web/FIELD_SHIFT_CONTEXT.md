> ⚠️ **Documento histórico (14/11/2026), escrito antes da migração para o SAERPA.**
> Estado atual: o catálogo da Embrapa e a classificação por família estão no **banco** (tabelas `crop` e
> `crop_planting_window`, servidas por `GET /api/crops`); áreas e histórico são salvos pela API
> (`/api/properties`, `/api/fields`); o roteamento usa TanStack Router e os dados do servidor, TanStack Query.
> Os caminhos `data-raw/`, `scripts/` e `src/data/hortalicas.json` abaixo foram movidos para `src/shared`
> (ver `README.md` desta pasta). A umidade do solo agora vem da NASA POWER (`GET /api/climate`, `src/services/clima.ts`); o SMAP/Earth Engine e o mock foram abandonados.

# Field Shift — contexto do projeto (NASA Space Apps Challenge 2026)

Resumo de tudo que já foi feito, para quem continuar o projeto (pessoa ou Claude Code).
Última atualização: 14/11/2026.

---

## 1. O que o projeto faz

App web para **ajudar o pequeno produtor a decidir o que plantar depois, no mesmo lugar**,
para a terra continuar saudável (rotação de culturas). O foco é **hortaliças** (horta familiar).

Fluxo em 3 passos numerados:

1. **Onde fica sua plantação?** — o usuário escolhe estado e cidade (todo o Brasil). O mapa vai até a cidade.
2. **O que você plantou por último?** — toca na figura da planta (ou em "Nada / não sei"). Opcional: o que plantou antes disso.
3. **O que plantar agora** — lista de sugestões. Cada uma mostra o *porquê* e *como plantar*
   (espaçamento, jeito de plantar, dias até a colheita, produção por m²). Também mostra o que plantar
   nos próximos meses, o que **evitar** (mesma família) e uma sequência sugerida para o ano.

Extras:
- **Marcar minha área (opcional):** o usuário desenha o terreno no mapa tocando nos cantos. Cada área guarda o próprio histórico.
- **Umidade da terra:** camada no mapa e um conselho em linguagem simples ("a terra está seca, regue bem…").
- **Ajuda:** passo a passo guiado com balões que destacam cada parte da tela + explicação de cada parte.
- **Sem login, sem perfil.**

**Princípio de design:** tem que ser usável por quem **não entende de tecnologia**: letra grande (17px),
botões de no mínimo 48px sempre com texto, nada de jargão (sem "cm³/cm³", sem notas 0–100 na tela), passos numerados.

## 2. Desafio do Space Apps

Desafio sobre rotação de culturas: *"help farmers explore rotation strategies that could strengthen
soil health and adapt their farms to changing conditions"*. No app o desafio aparece como
**"Field Shift: Adapting Farms with NASA Data"**.
⚠️ Confirmar o nome oficial do desafio no site do Space Apps antes da entrega.

Divisão do time: **Lucca faz o front end**. O back end (Google Earth Engine) é de outro membro.

## 3. Como rodar

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # gera dist/ (base './', abre em qualquer servidor estático)

Stack: **React 19 + TypeScript (strict) + Vite**, mapa com **Leaflet 1.9 / react-leaflet 5**. Sem biblioteca de UI; CSS próprio em `src/index.css`.

## 4. Estrutura

    CLAUDE.md                  este arquivo
    README.md                  documentação pública (fontes de dados, como rodar)
    data-raw/embrapa-informacoes-gerais-plantio-hortalicas.xlsx   planilha original da Embrapa
    scripts/import_embrapa.py  converte a planilha → src/data/hortalicas.json (precisa de openpyxl)
    src/
      App.tsx                  estado da tela e fluxo dos 3 passos
      types.ts                 tipos compartilhados (Hortalica, Historico, Area, Estado, Municipio…)
      components/
        LocationPicker.tsx     estado (select) + cidade (busca sem acento, prioriza "começa com")
        MapView.tsx            mapa: satélite/ruas, grade de umidade, áreas, desenho, flyTo
        PlantouCard.tsx        passo 2 (grade de figuras + busca + "antes disso")
        SugestoesCard.tsx      passo 3 (mês, "colher rápido", dica de umidade, listas, plano do ano)
        Tour.tsx               passo a passo guiado (balões); passos em PASSOS_TOUR
        Ajuda.tsx              janela da Ajuda + explicação de cada parte
        ui.tsx                 Icon, Segmented, Sparkline, Sheet, EmptyState, StepTitle
      data/
        hortalicas.json        GERADO pelo script — não editar à mão
        hortalicas.ts          junta tabela Embrapa + classificação; daRegiao(), POR_ID, NOMES_MES
        classificacao.ts       família botânica + grupo (folha/fruto/raiz/leguminosa) + emoji de cada hortaliça
        estados.json, municipios.json, locations.ts   27 UFs + 5.570 municípios com lat/lng
      services/
        rotacao.ts             motor de recomendação (recomendar(), planoDoAno())
        smap.ts                umidade do solo NASA SMAP — hoje SIMULADA (USE_MOCK = true)
      lib/geo.ts               área em hectares, centróide, limites do Brasil, formatação pt-BR

## 5. Como a recomendação funciona (`src/services/rotacao.ts`)

Para cada hortaliça que a tabela Embrapa indica para a região do usuário:

| Critério | Origem | Pontos |
|---|---|---|
| É época de plantio na região, no mês escolhido | Tabela Embrapa | +35 (+15 se começa no mês seguinte) |
| Mesma família botânica da última planta | `classificacao.ts` | vai para **"Evitar"** |
| Próximo grupo ideal: folha → fruto → raiz → leguminosa → folha | `classificacao.ts` | +45 |
| Leguminosa depois de folha/fruto (devolve nitrogênio) | `classificacao.ts` | +35 |
| Outro grupo / mesmo grupo | `classificacao.ts` | +25 / +10 |
| "Nada / não sei" (sem histórico) | — | +25 neutro |
| Mesma família nas 2 safras anteriores | `classificacao.ts` | −15 |
| "Quero colher rápido" | Tabela Embrapa (dias até colheita) | até +20 |

Nota ≥ 70 = "Ótima escolha", ≥ 50 = "Boa escolha"; empate → ciclo mais curto primeiro.
A região vem do estado (`estado.regiao`: Sul, Sudeste, Nordeste, Centro-Oeste, Norte).
A umidade do solo **ainda não entra na nota**, só vira um conselho de rega no passo 3.

## 6. De onde vêm os dados

| Dado | Fonte | Situação |
|---|---|---|
| Época de plantio por região, espaçamento, tipo de plantio, dias até colheita, produção/m² | **Sisteminha Embrapa** — "Informações gerais sobre o plantio de hortaliças" (https://www.sisteminhaembrapa.org/tabela-de-plantio). Planilha cita: Amaro et al. (2007) e Embrapa Hortaliças e Sebrae (2010). Abas "Brasil" (48 culturas, 5 regiões) e "Região sul" (+9 só para o Sul) → **57 culturas** | ✅ Real, no projeto (arquivo local, sem API) |
| Família botânica e grupo de cada planta (regras de rotação) | Feito pelo time (`classificacao.ts`) — **não vem da Embrapa** | ✅ Pronto, ⚠️ precisa revisão de agronomia |
| Estados e municípios com coordenadas | [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) (MIT, © 2016 Kelvin S. do Prado). Códigos seguem o IBGE; coordenadas **não** são publicação oficial do IBGE | ✅ Real, arquivo local |
| Umidade do solo | **NASA SMAP L3 Enhanced** — `NASA/SMAP/SPL3SMP_E/006` no Google Earth Engine (bandas `soil_moisture_am/pm`, cm³/cm³, grade ~9 km) | ⚠️ **Simulada** no front (`USE_MOCK = true`) |
| Fundo do mapa | Esri World Imagery (satélite) e OpenStreetMap | ✅ Tiles públicos |
| Sensores em campo | — | ❌ Nenhum |

Correções feitas pelo script na planilha da Embrapa (erros de digitação):
"Batata-doc e" → "Batata-doce"; Agrião/Sudeste "Fev/ju" → "Fev/jul"; Couve-flor de verão 9×5 cm → 90×50 cm.
Observação: o site do Sisteminha diz ser iniciativa pessoal e **não oficial** da Embrapa.

## 7. O que está pronto

### Front end ✅
- Fluxo completo dos 3 passos, testado no celular (390px) e no computador (layout em 2 colunas a partir de 980px).
- Seleção de estado/cidade para o Brasil inteiro, mapa com zoom automático.
- Desenho de áreas no mapa (com Desfazer), área em hectares, histórico por área.
- Motor de rotação com dados reais da Embrapa + classificação botânica.
- Ajuda: tour guiado com 10 passos (`data-tour="…"` nos elementos) + explicação de cada parte.
- Build sem erros de TypeScript.

### Back end ❌ (nada implementado ainda)
O front já está preparado: basta implementar os endpoints abaixo e trocar `USE_MOCK` para `false` em `src/services/smap.ts`.
Em desenvolvimento, configurar `server.proxy` no `vite.config.ts` apontando `/api` para o back end.

| Endpoint | Corpo | Resposta | No servidor (Earth Engine) |
|---|---|---|---|
| `GET /api/smap/tiles?start=&end=` | — | `{ urlFormat }` | `smap.mean().getMapId({min:0,max:0.5,palette})` → vira um `<TileLayer>` |
| `POST /api/smap/point` | `{ lat, lng, days: 30 }` | `{ mean, series: [{date, value}] }` | `reduceRegion(mean, ponto, scale 9000)` por dia |
| `POST /api/smap/field` | `{ geometry: GeoJSON Polygon, days: 30 }` | `{ mean, series: [{date, value}] }` | idem, com o polígono da área |

Quando o back end existir, também falta trocar a grade simulada do mapa (`SmapGrid` em `MapView.tsx`) por um `<TileLayer url={urlFormat}>`.

## 8. Pendências e próximos passos

1. **Back end SMAP** (endpoints acima) e desligar o mock.
2. **Guardar dados entre visitas:** hoje áreas e histórico ficam só na memória e somem ao recarregar a página.
   Sem login, a opção mais simples é `localStorage` (com try/catch).
3. **Revisão agronômica** de `classificacao.ts` e das regras de pontuação.
4. **Usar a umidade na nota** (hoje é só conselho); a tabela Embrapa não tem demanda hídrica por cultura, precisaria de outra fonte.
5. Confirmar o nome oficial do desafio no Space Apps.
6. Testar com usuários reais (pessoas sem familiaridade com tecnologia) e simplificar o que confundir.
7. Opcional: PWA/offline para uso no campo com internet ruim.

## 9. Convenções do código

- **Não abreviar nomes** (preferência do time e regra do `AGENTS.md`): usar nomes completos e descritivos, em português
  (ex.: `hortalica`, `sugestao`, `entrada`, `areaEmHectares`, `formatarNumero`). Já aplicado em todo o código TypeScript.
  Exceções deliberadas: `id`, `uf`, `lat`/`lng` e siglas (SMAP, IBGE). Classes de CSS e atributos `data-tour` não foram renomeados.
- Textos da interface em **português simples**, frases curtas, sem termos técnicos.
- Todo botão tem texto (não só ícone) e altura mínima de 44–48px.
- `src/data/hortalicas.json` é gerado: para corrigir dados, edite `scripts/import_embrapa.py` (lista `FIXES`) e rode de novo.
- Hortaliça nova na tabela → precisa de entrada em `classificacao.ts` (o app lança erro se faltar).
- Parte nova da tela no tour → `data-tour="nome"` no elemento + item em `PASSOS_TOUR` (`Tour.tsx`).
- Mapa: a `.map-area` usa `isolation: isolate` para os controles do Leaflet (z-index 1000) não passarem por cima do cabeçalho fixo (z-index 1500). Não remover.

## 10. Histórico de decisões

1. **Protótipo inicial em HTML/JS puro**, com lavoura de grãos (soja, milho…) e talhões de exemplo inventados. Substituído.
2. **Reescrito em React + TypeScript**: talhões inventados removidos, mapa do Brasil inteiro com seleção de estado/cidade, perfil/login removidos.
3. **Dados da rotação trocados pela tabela do Sisteminha Embrapa** → o foco passou de grãos para **hortaliças**.
   Como a tabela não tem regras de rotação, o time criou a classificação por família + parte colhida.
4. **Interface simplificada** para quem não é de tecnologia (3 passos, linguagem simples, botões grandes).
5. **Ajuda guiada** (tour com balões + explicação de cada parte).
6. Correção: botões de zoom do mapa passavam por cima do botão Ajuda.

Prévia publicada (sem fundo de mapa, porque a prévia bloqueia imagens externas): https://claude.ai/artifact/CQGVnFEJkbJaxN7oL1ZGXa
