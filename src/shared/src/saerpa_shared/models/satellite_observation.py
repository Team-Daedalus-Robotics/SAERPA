from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Double,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    false,
    func,
)

from saerpa_shared.base import Base


class SatelliteObservation(Base):
    __tablename__ = "satellite_observation"
    __table_args__ = (
        UniqueConstraint(
            "source",
            "product",
            "variable",
            "observed_at",
            "cell_latitude",
            "cell_longitude",
            name="satellite_observation_cell_key",
        ),
    )

    id = Column(Integer, primary_key=True)
    source = Column(String(32), nullable=False)
    product = Column(String(64), nullable=False)
    variable = Column(String(64), nullable=False)
    depth = Column(String(32))
    measurement_unit = Column(String(32), nullable=False)
    observed_at = Column(Date, nullable=False)
    requested_latitude = Column(Double)
    requested_longitude = Column(Double)
    cell_latitude = Column(Double)
    cell_longitude = Column(Double)
    value = Column(Double)
    quality_flag = Column(SmallInteger)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted = Column(Boolean, nullable=False, server_default=false())
