"""
Converte a tabela "Informações gerais sobre o plantio de hortaliças"
(Sisteminha Embrapa — https://www.sisteminhaembrapa.org/tabela-de-plantio)
no arquivo de seed do catálogo de culturas (src/saerpa_shared/seed/crops.json),
que a API grava na tabela `crop` e `crop_planting_window` ao iniciar.

Fonte citada na própria planilha:
  Adaptado de Amaro et al. (2007) e Embrapa Hortaliças e Sebrae (2010).

Família botânica, grupo e emoji NÃO vêm da Embrapa: foram definidos pelo time e
ficam em data/crop_classification.json (revisar com agronomia).

Uso (dentro de src/shared):
  uv run --with openpyxl python scripts/import_embrapa.py

Abas usadas:
  - "Brasil":     época de plantio por região (Sul, Sudeste, Nordeste, Centro-Oeste, Norte)
  - "Região sul": culturas extras que só aparecem nessa aba (valem só para o Sul)

Correções aplicadas (erros de digitação da planilha original) ficam em CORRECTIONS
e são impressas no fim da execução.
"""
import json
import re
import unicodedata
from pathlib import Path

import openpyxl

SHARED_ROOT = Path(__file__).resolve().parent.parent
SPREADSHEET_PATH = SHARED_ROOT / "data" / "embrapa-informacoes-gerais-plantio-hortalicas.xlsx"
CLASSIFICATION_PATH = SHARED_ROOT / "data" / "crop_classification.json"
SEED_PATH = SHARED_ROOT / "src" / "saerpa_shared" / "seed" / "crops.json"

REGIONS = ["Sul", "Sudeste", "Nordeste", "Centro-Oeste", "Norte"]
MONTHS = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
          "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}

# (cultura, campo) -> (valor corrigido, motivo)
CORRECTIONS = {
    ("Batata-doc e", "name"): ("Batata-doce", "quebra de texto no nome"),
    ("Agrião", "Sudeste"): ("Fev/jul", "'Fev/ju' incompleto; lido como julho"),
    ("Couve-flor de verão", "spacing"): ((90, 50), "planilha diz 9 x 5 cm; aba Sul e couve-flor de inverno usam 90 x 50 cm"),
}
applied_corrections = []


def clean(value):
    if value is None:
        return None
    return re.sub(r"\s+", " ", str(value)).strip()


def slugify(text):
    text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_month(token):
    key = token.strip().lower()[:3]
    if key not in MONTHS:
        raise ValueError(f"mês desconhecido: {token!r}")
    return MONTHS[key]


def parse_planting_window(text):
    """'Out/fev' -> [10,11,12,1,2]; 'Ano todo' -> 1..12; 'Inadequado' -> []"""
    cleaned = clean(text)
    lowered = cleaned.lower()
    if lowered.startswith("ano todo"):
        return list(range(1, 13))
    if lowered.startswith("inadequad"):
        return []
    parts = cleaned.split("/")
    if len(parts) == 1:
        return [parse_month(parts[0])]
    first, last = parse_month(parts[0]), parse_month(parts[1])
    months, current = [], first
    while True:
        months.append(current)
        if current == last:
            break
        current = current % 12 + 1
    return months


def parse_day_range(text):
    numbers = [int(number) for number in re.findall(r"\d+", clean(text))]
    return numbers[0], numbers[-1]


def correct(crop_name, field, value):
    key = (crop_name, field)
    if key in CORRECTIONS:
        corrected, reason = CORRECTIONS[key]
        applied_corrections.append(f"{crop_name} / {field}: {value!r} -> {corrected!r} ({reason})")
        return corrected
    return value


def build_crop(name, planting_windows, spacing, planting_type, harvest_days, production, source):
    harvest_days_min, harvest_days_max = harvest_days
    return {
        "slug": slugify(name),
        "name": name,
        "row_spacing_centimeters": spacing[0],
        "plant_spacing_centimeters": spacing[1],
        "planting_type": planting_type,
        "harvest_days_min": harvest_days_min,
        "harvest_days_max": harvest_days_max,
        "production_per_square_meter": production,
        "source": source,
        "planting_windows": planting_windows,
    }


def main():
    workbook = openpyxl.load_workbook(SPREADSHEET_PATH, data_only=True)
    classification = json.loads(CLASSIFICATION_PATH.read_text(encoding="utf-8"))
    crops = {}

    for row in workbook["Brasil"].iter_rows(min_row=3, values_only=True):
        name = clean(row[0])
        if not name or name.lower().startswith("fonte"):
            continue
        name = correct(name, "name", name)
        planting_windows = {
            region: parse_planting_window(correct(name, region, clean(row[1 + index])))
            for index, region in enumerate(REGIONS)
        }
        spacing = correct(name, "spacing", (int(row[6]), int(row[7])))
        planting_type = clean(row[8]).replace("- ", "").replace("/ ", "/").replace(" /", "/")
        crops[slugify(name)] = build_crop(
            name, planting_windows, spacing, planting_type, parse_day_range(row[9]), clean(row[10]), "Brasil",
        )

    for row in workbook["Região sul"].iter_rows(min_row=2, values_only=True):
        name = clean(row[0])
        if not name or slugify(name) in crops:
            continue
        numbers = [int(number) for number in re.findall(r"\d+", clean(row[2]))]
        crops[slugify(name)] = build_crop(
            name, {"Sul": parse_planting_window(row[1])}, (numbers[0], numbers[1]),
            clean(row[3]), parse_day_range(row[4]), None, "Região sul",
        )

    missing = sorted(set(crops) - set(classification))
    if missing:
        raise SystemExit(f"Culturas sem classificação em crop_classification.json: {missing}")

    seed = []
    for slug in sorted(crops, key=lambda key: crops[key]["name"]):
        seed.append({**crops[slug], **classification[slug]})

    SEED_PATH.write_text(json.dumps(seed, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(seed)} culturas gravadas em {SEED_PATH.relative_to(SHARED_ROOT)}")
    for line in applied_corrections:
        print("correção:", line)


if __name__ == "__main__":
    main()
