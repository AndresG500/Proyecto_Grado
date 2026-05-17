from fastapi import APIRouter, HTTPException, Depends
from models.model_paciente import ActivarModoViaje
from services.service_modo_viaje import (
    activar_modo_viaje,
    desactivar_modo_viaje,
    obtener_estado_modo_viaje,
)
from security.dependencies import get_cuidador_actual, get_familiar_actual

router = APIRouter(prefix="/modo-viaje", tags=["Modo Viaje"])


# ── Familiar (primero: segmentos literales antes que parámetros) ───────────────

@router.post("/familiar/activar")
async def activar_familiar(body: ActivarModoViaje, familiar=Depends(get_familiar_actual)):
    resultado = await activar_modo_viaje(
        paciente_id=body.paciente_id,
        tipo=body.tipo,
        duracion_horas=body.duracion_horas,
        activado_por=str(familiar["_id"]),
    )
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.post("/familiar/desactivar/{paciente_id}")
async def desactivar_familiar(paciente_id: str, familiar=Depends(get_familiar_actual)):
    resultado = await desactivar_modo_viaje(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.get("/familiar/{paciente_id}")
async def estado_familiar(paciente_id: str, familiar=Depends(get_familiar_actual)):
    resultado = await obtener_estado_modo_viaje(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=404, detail=resultado["error"])
    return resultado


# ── Cuidador (después: rutas paramétricas) ────────────────────────────────────

@router.post("/activar")
async def activar(body: ActivarModoViaje, cuidador=Depends(get_cuidador_actual)):
    resultado = await activar_modo_viaje(
        paciente_id=body.paciente_id,
        tipo=body.tipo,
        duracion_horas=body.duracion_horas,
        activado_por=str(cuidador["_id"]),
    )
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.post("/desactivar/{paciente_id}")
async def desactivar(paciente_id: str, cuidador=Depends(get_cuidador_actual)):
    resultado = await desactivar_modo_viaje(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.get("/{paciente_id}")
async def estado(paciente_id: str, cuidador=Depends(get_cuidador_actual)):
    resultado = await obtener_estado_modo_viaje(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=404, detail=resultado["error"])
    return resultado
