from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.controllers import station_data
from saerpa_shared.migrator import run_migrations


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    yield


app = FastAPI(title="SAERPA Station Data Gateway", lifespan=lifespan)
app.include_router(station_data.router)
