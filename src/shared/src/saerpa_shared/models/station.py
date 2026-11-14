from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class Station(Base):
    __tablename__ = "station"

    id = Column(Integer, primary_key=True)
    unique_identifier = Column(String(64), unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    measures = relationship("Measure", back_populates="station")
