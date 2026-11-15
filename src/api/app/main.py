from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.controllers import status, stations
from saerpa_shared.migrator import run_migrations


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    yield


app = FastAPI(title="SAERPA API", lifespan=lifespan)
app.include_router(status.router)
app.include_router(stations.router)
