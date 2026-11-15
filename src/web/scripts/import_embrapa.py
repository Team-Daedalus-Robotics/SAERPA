"""
Converte a tabela "Informações gerais sobre o plantio de hortaliças"
(Sisteminha Embrapa — https://www.sisteminhaembrapa.org/tabela-de-plantio)
em src/data/hortalicas.json, usado pelo app.

Fonte citada na própria planilha:
  Adaptado de Amaro et al. (2007) e Embrapa Hortaliças e Sebrae (2010).

Uso:
  python3 scripts/import_embrapa.py data-raw/embrapa-informacoes-gerais-plantio-hortalicas.xlsx

Abas usadas:
  - "Brasil":     época de plantio por região (Sul, Sudeste, Nordeste, Centro-Oeste, Norte)
  - "Região sul": culturas extras que só aparecem nessa aba (valem só para o Sul)

Correções aplicadas (erros de digitação da planilha original) ficam em FIXES
e são impressas no fim da execução.
"""
import json
import re
import sys
import unicodedata

import openpyxl

REGIOES = ["Sul", "Sudeste", "Nordeste", "Centro-Oeste", "Norte"]
MESES = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
         "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}

# (cultura, campo) -> (valor corrigido, motivo)
FIXES = {
    ("Batata-doc e", "nome"): ("Batata-doce", "quebra de texto no nome"),
    ("Agrião", "Sudeste"): ("Fev/jul", "'Fev/ju' incompleto; lido como julho"),
    ("Couve-flor de verão", "espacamento"): ((90, 50), "planilha diz 9 x 5 cm; aba Sul e couve-flor de inverno usam 90 x 50 cm"),
}
applied = []


def clean(s):
    if s is None:
        return None
    return re.sub(r"\s+", " ", str(s)).strip()


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def month(tok):
    t = tok.strip().lower()[:3]
    if t not in MESES:
        raise ValueError(f"mês desconhecido: {tok!r}")
    return MESES[t]


def parse_janela(txt):
    """'Out/fev' -> [10,11,12,1,2]; 'Ano todo' -> 1..12; 'Inadequado' -> []"""
    t = clean(txt)
    low = t.lower()
    if low.startswith("ano todo"):
        return list(range(1, 13))
    if low.startswith("inadequad"):
        return []
    parts = t.split("/")
    if len(parts) == 1:
        return [month(parts[0])]
    a, b = month(parts[0]), month(parts[1])
    out, m = [], a
    while True:
        out.append(m)
        if m == b:
            break
        m = m % 12 + 1
    return out


def parse_faixa(txt):
    nums = [int(n) for n in re.findall(r"\d+", clean(txt))]
    return [nums[0], nums[-1]]


def fix(nome, campo, valor):
    key = (nome, campo)
    if key in FIXES:
        novo, motivo = FIXES[key]
        applied.append(f"{nome} / {campo}: {valor!r} -> {novo!r} ({motivo})")
        return novo
    return valor


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    culturas = {}

    # ---- aba Brasil ----
    for row in wb["Brasil"].iter_rows(min_row=3, values_only=True):
        nome = clean(row[0])
        if not nome or nome.lower().startswith("fonte"):
            continue
        nome = fix(nome, "nome", nome)
        epocas = {}
        for i, reg in enumerate(REGIOES):
            epocas[reg] = parse_janela(fix(nome, reg, clean(row[1 + i])))
        linhas, plantas = fix(nome, "espacamento", (int(row[6]), int(row[7])))
        culturas[slug(nome)] = {
            "id": slug(nome),
            "nome": nome,
            "epocas": epocas,
            "espacamentoCm": {"linhas": linhas, "plantas": plantas},
            "tipoPlantio": clean(row[8]).replace("- ", "").replace("/ ", "/").replace(" /", "/"),
            "colheitaDias": parse_faixa(row[9]),
            "producaoM2": clean(row[10]),
            "fonte": "Brasil",
        }

    # ---- aba Região sul: só as culturas que não estão na aba Brasil ----
    for row in wb["Região sul"].iter_rows(min_row=2, values_only=True):
        nome = clean(row[0])
        if not nome or slug(nome) in culturas:
            continue
        esp = [int(n) for n in re.findall(r"\d+", clean(row[2]))]
        culturas[slug(nome)] = {
            "id": slug(nome),
            "nome": nome,
            "epocas": {"Sul": parse_janela(row[1])},  # outras regiões: sem dado
            "espacamentoCm": {"linhas": esp[0], "plantas": esp[1]},
            "tipoPlantio": clean(row[3]),
            "colheitaDias": parse_faixa(row[4]),
            "producaoM2": None,
            "fonte": "Região sul",
        }

    out = sorted(culturas.values(), key=lambda c: c["nome"])
    with open("src/data/hortalicas.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(f"{len(out)} culturas gravadas em src/data/hortalicas.json "
          f"({sum(c['fonte'] == 'Brasil' for c in out)} da aba Brasil, "
          f"{sum(c['fonte'] != 'Brasil' for c in out)} só do Sul)")
    print("Correções aplicadas:")
    for a in applied:
        print("  -", a)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data-raw/embrapa-informacoes-gerais-plantio-hortalicas.xlsx")
