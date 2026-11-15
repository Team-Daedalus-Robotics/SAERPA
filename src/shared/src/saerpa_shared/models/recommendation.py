from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from saerpa_shared.base import Base


class Recommendation(Base):
    __tablename__ = "recommendation"

    id = Column(Integer, primary_key=True)
    type = Column(String(64), nullable=False)
    response = Column(Text, nullable=False)
    observation = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)
