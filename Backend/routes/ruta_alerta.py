from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from services.service_alerta import listar_alertas, listar_alertas_familiar, obtener_alerta, actualizar_estado
from models.model_alertas import RespuestaAlerta
from security.dependencies import get_cuidador_actual, get_familiar_actual

router = APIRouter(prefix="/alertas", tags=["alertas"])


def _serializar(alerta: dict) -> dict:
    """Convierte ObjectIds a str para que Pydantic pueda serializar."""
    alerta["_id"]       = str(alerta["_id"])
    alerta["paciente_id"] = str(alerta["paciente_id"])
    if alerta.get("zonasegura_id"):
        alerta["zonasegura_id"] = str(alerta["zonasegura_id"])
    alerta["cuidadores_notificados"] = [
        str(c) for c in alerta.get("cuidadores_notificados", [])
    ]
    return alerta


# BUG CORREGIDO: todos los endpoints ahora requieren JWT
@router.get("/familiar/")
async def alertas_familiar(familiar_actual = Depends(get_familiar_actual)):
    return await listar_alertas_familiar(str(familiar_actual["_id"]))


@router.get("/", response_model=list[RespuestaAlerta])
async def alertas_listadas(
    paciente_id: Optional[str] = None,
    _: dict = Depends(get_cuidador_actual),
):
    alertas = await listar_alertas(paciente_id)
    return [_serializar(a) for a in alertas]


@router.get("/{alerta_id}", response_model=RespuestaAlerta)
async def alertas_obtenidas(
    alerta_id: str,
    _: dict = Depends(get_cuidador_actual),
):
    alerta = await obtener_alerta(alerta_id)
    if not alerta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta no encontrada")
    return _serializar(alerta)


@router.patch("/{alerta_id}/resolver", response_model=RespuestaAlerta)
async def resolver_alerta(
    alerta_id: str,
    _: dict = Depends(get_cuidador_actual),
):
    alerta = await actualizar_estado(alerta_id, "resuelta")
    if not alerta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta no encontrada")
    return _serializar(alerta)