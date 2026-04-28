# routes/route_zona_segura.py
from fastapi import APIRouter, HTTPException
from models.model_zonasegura import CrearZonaSegura, ActualizarZonaSegura
from services.service_zonaseguraa import crear_zona_segura, obtener_zonas_por_paciente, obtener_zona_por_id, actualizar_zona_segura, eliminar_zona_segura, verificar_paciente_en_zonas

router = APIRouter(prefix="/zonas-seguras", tags=["Zonas Seguras"])


@router.post("/crear")
async def crear_zona_segura(datos: CrearZonaSegura):
    resultado = await crear_zona_segura(datos)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    if "mensaje" in resultado and "ya existe" in resultado["mensaje"].lower():
        raise HTTPException(status_code=409, detail=resultado["mensaje"])
    return resultado


@router.get("/paciente/{paciente_id}")
async def obtener_zonas_por_paciente(paciente_id: str):
    resultado = await obtener_zonas_por_paciente(paciente_id)
    if isinstance(resultado, dict) and "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if isinstance(resultado, dict) and "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.get("/obtener/{zona_id}")
async def obtener_zona_por_id(zona_id: str):
    resultado = await obtener_zona_por_id(zona_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.patch("/actualizar/{zona_id}")
async def actualizar_zona_segura(zona_id: str, datos: ActualizarZonaSegura):
    resultado = await actualizar_zona_segura(zona_id, datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.delete("/eliminar/{zona_id}")
async def eliminar_zona_segura(zona_id: str):
    resultado = await eliminar_zona_segura(zona_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.get("/verificar/{paciente_id}")
async def verificar_paciente_en_zonas(paciente_id: str, latitud: float, longitud: float):
    resultado = await verificar_paciente_en_zonas(paciente_id, latitud, longitud)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado