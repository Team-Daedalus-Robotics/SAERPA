from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Double, Integer, String, func


from saerpa_shared.base import Base


class Property(Base):
    __tablename__ = "property"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    lat = Column(Double, nullable=False)
    lng = Column(Double, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)
