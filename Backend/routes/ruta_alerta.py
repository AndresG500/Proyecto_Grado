from fastapi import APIRouter, HTTPException, Depends
from models.model_alertas import CrearAlerta, AtenderAlerta
from services.service_alerta import crear_alerta, atender_alerta, resolver_alerta
from security.dependencies import get_cuidador_actual

router = APIRouter(prefix="/alertas", tags=["Alertas"])


@router.post("/crear")
async def crear(datos: CrearAlerta, cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await crear_alerta(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado


@router.patch("/atender/{alerta_id}")
async def atender(alerta_id: str, datos: AtenderAlerta, cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await atender_alerta(alerta_id, datos.cuidador_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.patch("/resolver/{paciente_id}")
async def resolver(paciente_id: str, cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await resolver_alerta(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado