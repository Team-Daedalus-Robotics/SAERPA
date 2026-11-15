import os
from dataclasses import dataclass, field

from sqlalchemy import select

from saerpa_shared.engine import SessionLocal
from saerpa_shared.models import Crop


@dataclass(frozen=True)
class Question:
    question_id: str
    instructions: str
    answers: list[str] = field(default_factory=list)
    required_satellite_measures: list[str] = field(default_factory=list)
    required_sensor_types: list[str] = field(default_factory=list)
    question_type: str = "score"


IRIGATION_NEED = Question(
    question_id="irrigation_need",
    instructions="Qual a necessidade de irrigação do solo para a cultura informada, "
    "considerando as leituras recentes dos sensores e as observações de satélite?",
    answers=[
        "1: irrigação não é necessária, solo encharcado",
        "2: irrigação não é necessária, solo úmido",
        "3: irrigação desnecessária por ora, solo adequado",
        "4: irrigar em breve, solo secando",
        "5: irrigar com urgência, solo seco",
    ],
    required_satellite_measures=["soil_moisture", "rainfall", "air_temperature"],
    required_sensor_types=["umidade"],
)

SOIL_MOISTURE_CONDITION = Question(
    question_id="soil_moisture_condition",
    instructions="Qual é a condição da umidade do solo?",
    answers=[
        "1: muito seca",
        "2: seca",
        "3: adequada",
        "4: úmida",
        "5: muito úmida",
    ],
    required_satellite_measures=["soil_moisture", "air_humidity"],
    required_sensor_types=["umidade"],
)

ROTATION_NEXT_CROP = Question(
    question_id="rotation_next_crop",
    instructions="Qual a melhor cultura para plantar em seguida na rotação, entre as candidatas "
    "apresentadas? Considere a família e o grupo das últimas culturas plantadas no local "
    "(folha → fruto → raiz → leguminosa → folha; mesma família deve ser evitada), a época de "
    "plantio da região segundo a tabela da Embrapa, a condição recente do solo vista pelos "
    "sensores e pelos dados de satélite, e o tempo até a colheita.",
    required_satellite_measures=["soil_moisture", "soil_temperature", "rainfall"],
    required_sensor_types=["umidade"],
    question_type="choice",
)

QUESTIONS = {
    question.question_id: question
    for question in (IRIGATION_NEED, SOIL_MOISTURE_CONDITION, ROTATION_NEXT_CROP)
}


def enabled_question_ids() -> list[str]:
    configured = os.getenv("SUGGESTION_QUESTIONS", "irrigation_need,rotation_next_crop")
    return [question_id.strip() for question_id in configured.split(",") if question_id.strip()]


def enabled_questions() -> list[Question]:
    return [QUESTIONS[question_id] for question_id in enabled_question_ids() if question_id in QUESTIONS]


def target_crop() -> dict | None:
    """Cultura alvo da pergunta de irrigação, pelo nome (env SUGGESTION_CROP) ou a primeira do catálogo."""
    crop_name = os.getenv("SUGGESTION_CROP")
    statement = select(Crop).where(Crop.deleted.is_(False), Crop.slug.isnot(None))
    if crop_name:
        statement = statement.where(Crop.name.ilike(crop_name))
    statement = statement.order_by(Crop.id).limit(1)
    with SessionLocal() as session:
        crop = session.scalar(statement)
    if crop is None:
        return None
    return {
        "crop_id": crop.id,
        "name": crop.name,
        "planting_type": crop.planting_type,
        "harvest_days_min": crop.harvest_days_min,
        "harvest_days_max": crop.harvest_days_max,
    }
