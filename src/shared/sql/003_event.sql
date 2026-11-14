-- Event: reading captured for a station/measure pair
CREATE TABLE IF NOT EXISTS event (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    station_id   INT          NOT NULL REFERENCES station (id) ON DELETE CASCADE,
    measure_id   INT          NOT NULL REFERENCES measure (id) ON DELETE CASCADE,
    measure_type VARCHAR(64)  NOT NULL,
    value        VARCHAR(64)  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_station ON event (station_id);
CREATE INDEX IF NOT EXISTS idx_event_measure ON event (measure_id);
CREATE INDEX IF NOT EXISTS idx_event_timestamp ON event (timestamp);
