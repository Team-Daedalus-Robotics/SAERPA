from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from saerpa_shared.base import Base


class Crop(Base):
    __tablename__ = "crop"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)
