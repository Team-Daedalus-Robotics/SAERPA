-- Station: 001
CREATE TABLE IF NOT EXISTS station (
    id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unique_identifier VARCHAR(64)  NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
