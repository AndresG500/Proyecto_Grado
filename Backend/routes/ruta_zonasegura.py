# routes/route_zona_segura.py
from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Path
from models.model_zonasegura import CrearZonaSegura, ActualizarZonaSegura
from services.service_zonasegura import crear_zona_segura, obtener_zonas_por_paciente, obtener_zona_por_id, actualizar_zona_segura, eliminar_zona_segura, verificar_paciente_en_zonas
from security.dependencies import get_cuidador_actual

MongoId = Annotated[str, Path(pattern=r'^[a-f\d]{24}$')]
router = APIRouter(prefix="/zonas-seguras", tags=["Zonas Seguras"])


# --- Endpoints protegidos (requieren JWT) ---

@router.post("/crear")
async def crear_zona(
    datos: CrearZonaSegura,
    cuidador_actual = Depends(get_cuidador_actual)
):
    datos.cuidador_id = str(cuidador_actual["_id"])
    resultado = await crear_zona_segura(datos)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    if "mensaje" in resultado and "ya existe" in resultado["mensaje"].lower():
        raise HTTPException(status_code=409, detail=resultado["mensaje"])
    return resultado


@router.get("/paciente/{paciente_id}")
async def obtener_zonas(
    paciente_id: MongoId,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await obtener_zonas_por_paciente(paciente_id, cuidador_actual["email"])
    if isinstance(resultado, dict) and "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.get("/obtener/{zona_id}")
async def obtener_zonaId(
    zona_id: MongoId,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await obtener_zona_por_id(zona_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.patch("/actualizar/{zona_id}")
async def actualizar_zona(
    zona_id: MongoId,
    datos: ActualizarZonaSegura,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await actualizar_zona_segura(zona_id, datos, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.delete("/eliminar/{zona_id}")
async def eliminar_zona(
    zona_id: MongoId,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await eliminar_zona_segura(zona_id, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.get("/verificar/{paciente_id}")
async def paciente_en_zonas(
    paciente_id: MongoId,
    latitud: float,
    longitud: float,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await verificar_paciente_en_zonas(paciente_id, latitud, longitud)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado