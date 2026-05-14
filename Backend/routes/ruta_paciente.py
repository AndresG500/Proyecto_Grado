from fastapi import APIRouter, HTTPException, Depends
from models.model_paciente import CrearPaciente, ActualizarPaciente
from services.service_paciente import registrar_paciente, obtener_paciente, borrar_paciente, actualizar_paciente, listar_pacientes
from security.dependencies import get_cuidador_actual
from fastapi.responses import StreamingResponse
from bson import ObjectId
import json, asyncio
from utils.Logger import Logger
from database.database import get_database
from utils.eventos import bus_eventos

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])


# ─── PROTEGIDOS (todos requieren JWT) ────────────────────────────────────────

@router.post("/registrar")
async def registrar(
    datos: CrearPaciente,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await registrar_paciente(datos, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado


@router.get("/{patient_id}")
async def obtener(
    patient_id: str,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await obtener_paciente(patient_id, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.delete("/{patient_id}")
async def eliminar(
    patient_id: str,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await borrar_paciente(patient_id, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.put("/{patient_id}")
async def actualizar(
    patient_id: str,
    datos: ActualizarPaciente,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await actualizar_paciente(patient_id, datos, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado

@router.get("/{id}/ubicacion/stream")
async def stream_ubicacion(id: str, cuidador_actual=Depends(get_cuidador_actual)):
    db = get_database()

    async def generar():
        cola: asyncio.Queue = asyncio.Queue()
        bus_eventos.suscribir(id, cola)
        try:
            # Enviar la última ubicación conocida de inmediato
            paciente = await db.Pacientes.find_one({"_id": ObjectId(id)})
            if paciente and paciente.get("ultima_ubicacion"):
                ul = paciente["ultima_ubicacion"]
                datos = {
                    "latitud": ul.get("latitud"),
                    "longitud": ul.get("longitud"),
                    "timestamp": ul.get("timestamp", "").isoformat() if hasattr(ul.get("timestamp", ""), "isoformat") else str(ul.get("timestamp", "")),
                }
                yield f"data: {json.dumps(datos)}\n\n"

            # Esperar eventos en tiempo real
            while True:
                try:
                    datos = await asyncio.wait_for(cola.get(), timeout=25.0)
                    yield f"data: {json.dumps(datos)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"  # keepalive para evitar timeout del cliente

        except asyncio.CancelledError:
            pass
        finally:
            bus_eventos.desuscribir(id, cola)

    return StreamingResponse(
        generar(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/")
async def listar(cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await listar_pacientes(cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado