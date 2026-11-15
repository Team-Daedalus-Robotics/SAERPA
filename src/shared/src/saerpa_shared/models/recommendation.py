from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


recommendation_observation = Table(
    "recommendation_observation",
    Base.metadata,
    Column("recommendation_id", Integer, ForeignKey("recommendation.id", ondelete="CASCADE"), primary_key=True),
    Column("measure_id", Integer, ForeignKey("measure.id", ondelete="CASCADE"), primary_key=True),
)

recommendation_event = Table(
    "recommendation_event",
    Base.metadata,
    Column("recommendation_id", Integer, ForeignKey("recommendation.id", ondelete="CASCADE"), primary_key=True),
    Column("event_id", Integer, ForeignKey("event.id", ondelete="CASCADE"), primary_key=True),
)

recommendation_satellite_observation = Table(
    "recommendation_satellite_observation",
    Base.metadata,
    Column("recommendation_id", Integer, ForeignKey("recommendation.id", ondelete="CASCADE"), primary_key=True),
    Column("satellite_observation_id", Integer, ForeignKey("satellite_observation.id", ondelete="CASCADE"), primary_key=True),
)

recommendation_crop = Table(
    "recommendation_crop",
    Base.metadata,
    Column("recommendation_id", Integer, ForeignKey("recommendation.id", ondelete="CASCADE"), primary_key=True),
    Column("crop_id", Integer, ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True),
)


class Recommendation(Base):
    __tablename__ = "recommendation"

    id = Column(Integer, primary_key=True)
    type = Column(String(64), nullable=False)
    response = Column(Text, nullable=False)
    observation_text = Column(Text, nullable=False)
    question_id = Column(String(255))
    model_name = Column(String(128))
    instructions = Column(Text)
    criteria = Column(JSON)
    input_state = Column(JSON)
    choice = Column(Text)
    score = Column(Float)
    noul = Column(Float)
    confidence = Column(Float)
    probabilities = Column(JSON)
    legend = Column(JSON)
    response_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)

    observation = relationship("Measure", secondary=recommendation_observation, back_populates="recommendations")
    events = relationship("Event", secondary=recommendation_event)
    satellite_observations = relationship("SatelliteObservation", secondary=recommendation_satellite_observation)
    crops = relationship("Crop", secondary=recommendation_crop)
