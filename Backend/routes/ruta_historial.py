# routes/route_historial_ubicacion.py
from fastapi import APIRouter, HTTPException
from models.model_historial import HistorialUbicacionBase
from services.service_historial import registrar_ubicacion, obtener_ultima_ubicacion, obtener_historial_ubicaciones, eliminar_historial_paciente

router = APIRouter(prefix="/historial-ubicaciones", tags=["Historial de Ubicaciones"])


@router.post("/registrar")
async def registrar(datos: HistorialUbicacionBase):
    resultado = await registrar_ubicacion(datos)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.get("/ultima/{paciente_id}")
async def obtener_ubicacion(paciente_id: str):
    resultado = await obtener_ultima_ubicacion(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.get("/ruta/{paciente_id}")
async def obtener_historial(paciente_id: str):
    resultado = await obtener_historial_ubicaciones(paciente_id)
    if isinstance(resultado, dict) and "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if isinstance(resultado, dict) and "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.delete("/eliminar/{paciente_id}")
async def eliminar_historial(paciente_id: str):
    resultado = await eliminar_historial_paciente(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado