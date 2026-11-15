from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from saerpa_shared.base import Base


class RotationRule(Base):
    __tablename__ = "rotation_rule"

    previous_crop_id = Column(
        Integer, ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True
    )
    suggested_crop_id = Column(
        Integer, ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True
    )
    priority = Column(Integer, default=1, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)

    previous_crop = relationship("Crop", foreign_keys=[previous_crop_id])
    suggested_crop = relationship("Crop", foreign_keys=[suggested_crop_id])
