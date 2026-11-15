from fastapi import FastAPI

from app.controllers import station_data

app = FastAPI(title="SAERPA Station Data Gateway")
app.include_router(station_data.router)
