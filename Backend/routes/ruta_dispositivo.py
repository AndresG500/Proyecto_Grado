# routes/route_dispositivo.py
from fastapi import APIRouter, HTTPException
from models.model_dispositivo import CrearDispositivo, ActualizarDispositivo
from services import service_dispositivo

router = APIRouter(prefix="/dispositivos", tags=["Dispositivos"])


@router.post("/registrar")
async def registrar_dispositivo(datos: CrearDispositivo):
    resultado = await service_dispositivo.registrar_dispositivo(datos)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.get("/obtener/{id_dispositivo}")
async def obtener_dispositivo(id_dispositivo: str):
    resultado = await service_dispositivo.obtener_dispositivo(id_dispositivo)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.get("/paciente/{paciente_id}")
async def obtener_dispositivo_por_paciente(paciente_id: str):
    resultado = await service_dispositivo.obtener_dispositivo_por_paciente(paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.patch("/actualizar/{id_dispositivo}")
async def actualizar_dispositivo(id_dispositivo: str, datos: ActualizarDispositivo):
    resultado = await service_dispositivo.actualizar_dispositivo(id_dispositivo, datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


@router.patch("/desvincular/{id_dispositivo}")
async def desvincular_dispositivo(id_dispositivo: str):
    resultado = await service_dispositivo.desvincular_dispositivo(id_dispositivo)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if "mensaje" in resultado and "no se encontró" in resultado["mensaje"].lower():
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado


# --- Flujo de vinculación automática ---

@router.get("/disponibles")
async def obtener_dispositivos_disponibles():
    resultado = await service_dispositivo.obtener_dispositivos_disponibles()
    if isinstance(resultado, dict) and "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    if not resultado:
        raise HTTPException(status_code=404, detail="No hay dispositivos disponibles")
    return resultado


@router.post("/vincular")
async def vincular_dispositivo(id_dispositivo: str, paciente_id: str):
    resultado = await service_dispositivo.vincular_dispositivo(id_dispositivo, paciente_id)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado