from fastapi import APIRouter, HTTPException, status

from app.deps import SessionDep
from app.exceptions import NotFoundError
from app.services import field_service
from saerpa_shared.schemas import FieldHistoryRequest, FieldRenameRequest, FieldResponse

router = APIRouter(prefix="/api/fields", tags=["fields"])


@router.patch("/{field_id}")
def rename_field(field_id: int, payload: FieldRenameRequest, session: SessionDep) -> FieldResponse:
    try:
        return field_service.rename_field(session, field_id, payload)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.put("/{field_id}/history")
def replace_history(field_id: int, payload: FieldHistoryRequest, session: SessionDep) -> FieldResponse:
    try:
        return field_service.replace_history(session, field_id, payload)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field(field_id: int, session: SessionDep) -> None:
    try:
        field_service.delete_field(session, field_id)
    except NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
