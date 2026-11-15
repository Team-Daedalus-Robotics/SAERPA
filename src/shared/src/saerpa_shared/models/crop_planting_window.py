from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class CropPlantingWindow(Base):
    __tablename__ = "crop_planting_window"
    __table_args__ = (CheckConstraint("month BETWEEN 1 AND 12"),)

    crop_id = Column(Integer, ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True)
    region = Column(String(16), primary_key=True)
    month = Column(SmallInteger, primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)

    crop = relationship("Crop", back_populates="planting_windows")
