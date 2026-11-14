-- Measure: each station has many measures
CREATE TABLE IF NOT EXISTS measure (
    id               INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    station_id       INT          NOT NULL REFERENCES station (id) ON DELETE CASCADE,
    type             VARCHAR(64)  NOT NULL,
    sensor_name      VARCHAR(64)  NOT NULL,
    measurement_unit VARCHAR(32)  NOT NULL,
    data_type        VARCHAR(32)  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_measure_station ON measure (station_id);
