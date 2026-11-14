from fastapi import FastAPI

from app.controllers import status, stations

app = FastAPI(title="SAERPA API")
app.include_router(status.router)
app.include_router(stations.router)
