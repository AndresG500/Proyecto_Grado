"""
Endpoints HTTP del módulo de alertas.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, status

from services.service_alerta import listar_alertas, obtener_alerta, actualizar_estado
from models.model_alertas import RespuestaAlerta, AtenderAlerta

router = APIRouter(prefix="/alertas", tags=["alertas"])


@router.get("/", response_model=list[RespuestaAlerta])
async def alertas_listadas(paciente_id: Optional[str] = None):
    """
    Lista todas las alertas, ordenadas por timestamp descendente.
    Si se pasa `paciente_id` como query param, filtra por ese paciente.
    """
    alertas = await listar_alertas(paciente_id)
    # Convertir ObjectId a str para la serialización
    for a in alertas:
        a["_id"] = str(a["_id"])
        a["paciente_id"] = str(a["paciente_id"])
        if a.get("zonasegura_id"):
            a["zonasegura_id"] = str(a["zonasegura_id"])
        a["cuidadores_notificados"] = [str(c) for c in a.get("cuidadores_notificados", [])]
    return alertas


@router.get("/{alerta_id}", response_model=RespuestaAlerta)
async def alertas_obtenidas(alerta_id: str):
    alerta = await obtener_alerta(alerta_id)
    if not alerta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerta no encontrada",
        )
    alerta["_id"] = str(alerta["_id"])
    alerta["paciente_id"] = str(alerta["paciente_id"])
    if alerta.get("zonasegura_id"):
        alerta["zonasegura_id"] = str(alerta["zonasegura_id"])
    alerta["cuidadores_notificados"] = [
        str(c) for c in alerta.get("cuidadores_notificados", [])
    ]
    return alerta


@router.patch("/{alerta_id}/resolver", response_model=RespuestaAlerta)
async def resolver_alerta(alerta_id: str):
    """Marca una alerta como resuelta por el cuidador."""
    alerta = await actualizar_estado(alerta_id, "resuelta")
    if not alerta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerta no encontrada",
        )
    alerta["_id"] = str(alerta["_id"])
    alerta["paciente_id"] = str(alerta["paciente_id"])
    if alerta.get("zonasegura_id"):
        alerta["zonasegura_id"] = str(alerta["zonasegura_id"])
    alerta["cuidadores_notificados"] = [
        str(c) for c in alerta.get("cuidadores_notificados", [])
    ]
    return alerta