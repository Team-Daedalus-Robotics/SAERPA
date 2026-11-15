"""Environment-based configuration for the suggestion worker's Laya client."""

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

API_KEY = os.getenv("API_KEY", os.getenv("TYPESAFE_API_KEY", "local"))
BASE_URL = os.getenv(
    "LAYA_BASE_URL",
    os.getenv("BASE_URL", os.getenv("TYPESAFE_BASE_URL", "http://localhost:11435")),
).rstrip("/")
MODEL = os.getenv("MODEL", os.getenv("TYPESAFE_DEFAULT_MODEL", "laya:multilingual"))
DECIDE_URL = os.getenv(
    "LAYA_DECIDE_URL",
    os.getenv("DECIDE_URL", f"{BASE_URL}/api/decide"),
)
QUERY_LIMIT = int(os.getenv("QUERY_LIMIT", "100"))
