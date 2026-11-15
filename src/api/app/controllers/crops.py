from fastapi import APIRouter

from app.deps import SessionDep
from app.services import crop_service
from saerpa_shared.schemas import CropResponse

router = APIRouter(prefix="/api/crops", tags=["crops"])


@router.get("")
def list_crops(session: SessionDep) -> list[CropResponse]:
    return crop_service.list_catalog(session)
