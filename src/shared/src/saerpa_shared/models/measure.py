from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class Measure(Base):
    __tablename__ = "measure"

    id = Column(Integer, primary_key=True)
    station_id = Column(Integer, ForeignKey("station.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(64), nullable=False)            # temperatura, umidade, etc.
    sensor_name = Column(String(64), nullable=False)
    measurement_unit = Column(String(32), nullable=False)  # graus, %, etc.
    data_type = Column(String(32), nullable=False)

    station = relationship("Station", back_populates="measures")
    recommendations = relationship("Recommendation", secondary="recommendation_observation", back_populates="observation")
