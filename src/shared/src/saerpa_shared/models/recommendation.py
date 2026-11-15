from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


recommendation_observation = Table(
    "recommendation_observation",
    Base.metadata,
    Column("recommendation_id", Integer, ForeignKey("recommendation.id", ondelete="CASCADE"), primary_key=True),
    Column("measure_id", Integer, ForeignKey("measure.id", ondelete="CASCADE"), primary_key=True),
)


class Recommendation(Base):
    __tablename__ = "recommendation"

    id = Column(Integer, primary_key=True)
    type = Column(String(64), nullable=False)
    response = Column(Text, nullable=False)
    observation_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)

    observation = relationship("Measure", secondary=recommendation_observation, back_populates="recommendations")
