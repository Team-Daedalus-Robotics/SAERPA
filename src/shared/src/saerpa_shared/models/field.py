from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class Field(Base):
    __tablename__ = "field"

    id = Column(Integer, primary_key=True)
    property_id = Column(Integer, ForeignKey("property.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128))
    geometry = Column(Geography(geometry_type="POLYGON", srid=4326), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)

    property = relationship("Property")
