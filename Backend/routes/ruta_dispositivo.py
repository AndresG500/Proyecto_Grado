# routes/device_routes.py
from fastapi import APIRouter, HTTPException
from models.model_dispositivo import CrearDispositivo, ActualizarDispositivo
from services.service_dispositivo import registrar_dispositivo, obtener_dispositivo, obtener_dispositivo_por_paciente, actualizar_dispositivo, eliminar_dispositivo

router = APIRouter(prefix="/dispositivos", tags=["Dispositivos"])


@router.post("/registrar_dispositivo")
async def register_device(data: CrearDispositivo):
    result = await registrar_dispositivo(data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result  # ← simplemente retorna lo que viene del servicio


@router.get("/mac_id/{device_id}")
async def get_by_mac(device_id: str):
    device = await obtener_dispositivo(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    return device


@router.get("/paciente/{patient_id}")
async def get_by_patient(patient_id: str):
    device = await obtener_dispositivo_por_paciente(patient_id)
    if not device:
        raise HTTPException(status_code=404, detail="No hay dispositivo asignado a este paciente")
    return device


@router.patch("/actualizar/{device_id}")
async def update_device(device_id: str, data: ActualizarDispositivo):
    updated = await actualizar_dispositivo(device_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado o sin cambios")
    return {"message": "Dispositivo actualizado exitosamente"}


@router.delete("/eliminar/{device_id}")
async def delete_device(device_id: str):
    deleted = await eliminar_dispositivo(device_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
    return {"message": "Dispositivo eliminado exitosamente"}