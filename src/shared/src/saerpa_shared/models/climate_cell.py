from sqlalchemy import Boolean, Column, DateTime, Double, Integer, Text, UniqueConstraint, func

from saerpa_shared.base import Base


class ClimateCell(Base):
    """Célula da grade da NASA cujo clima alguém pediu; o nasa_event_worker a mantém atualizada em `event`."""

    __tablename__ = "climate_cell"
    __table_args__ = (UniqueConstraint("latitude", "longitude", name="uq_climate_cell_position"),)

    id = Column(Integer, primary_key=True)
    latitude = Column(Double, nullable=False)
    longitude = Column(Double, nullable=False)
    last_requested_at = Column(DateTime(timezone=True), nullable=False)
    last_attempt_at = Column(DateTime(timezone=True))
    last_refreshed_at = Column(DateTime(timezone=True))
    last_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted = Column(Boolean, default=False)
