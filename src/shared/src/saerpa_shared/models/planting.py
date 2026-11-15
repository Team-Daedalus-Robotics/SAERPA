from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class Planting(Base):
    __tablename__ = "planting"

    id = Column(Integer, primary_key=True)
    field_id = Column(Integer, ForeignKey("field.id", ondelete="CASCADE"), nullable=False)
    crop_id = Column(Integer, ForeignKey("crop.id"), nullable=False)
    planting_date = Column(Date, nullable=False)
    harvest_date = Column(Date)  # NULL = ainda está plantado

    field = relationship("Field")
    crop = relationship("Crop")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)
