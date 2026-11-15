from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class Crop(Base):
    __tablename__ = "crop"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    slug = Column(String(64), unique=True)
    botanical_family = Column(String(64))
    crop_group = Column(String(32))
    emoji = Column(String(16))
    row_spacing_centimeters = Column(Integer)
    plant_spacing_centimeters = Column(Integer)
    planting_type = Column(String(128))
    harvest_days_min = Column(Integer)
    harvest_days_max = Column(Integer)
    production_per_square_meter = Column(String(64))
    source = Column(String(32))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)

    planting_windows = relationship("CropPlantingWindow", back_populates="crop")
