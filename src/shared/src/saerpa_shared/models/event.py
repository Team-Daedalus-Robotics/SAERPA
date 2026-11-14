from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class Event(Base):
    __tablename__ = "event"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    station_id = Column(Integer, ForeignKey("station.id", ondelete="CASCADE"), nullable=False)
    measure_id = Column(Integer, ForeignKey("measure.id", ondelete="CASCADE"), nullable=False)
    measure_type = Column(String(64), nullable=False)  # temperatura, umidade, etc.
    value = Column(String(64), nullable=False)         # leitura em si ("23.5", etc.)

    station = relationship("Station")
    measure = relationship("Measure")
