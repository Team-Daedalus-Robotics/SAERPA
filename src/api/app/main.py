from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.controllers import climate, crops, fields, properties, recommendations, stations, status
from saerpa_shared.migrator import run_migrations
from saerpa_shared.seeder import seed_crops


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    run_migrations()
    seed_crops()
    yield


app = FastAPI(title="SAERPA API", lifespan=lifespan)
app.include_router(status.router)
app.include_router(stations.router)
app.include_router(crops.router)
app.include_router(climate.router)
app.include_router(properties.router)
app.include_router(fields.router)
app.include_router(recommendations.router)
