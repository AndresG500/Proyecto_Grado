from fastapi import APIRouter, HTTPException
from models.model_paciente import CrearPaciente, ActualizarPaciente, ActaulizarUbicacion, RespuestaPaciente
from services.service_paciente import registrar_paciente, borrar_paciente, actualizar_paciente, guardar_ubicacion

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])

@router.post("/registrar")
async def registrar(datos: CrearPaciente):
    resultado = await registrar_paciente(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.delete("/{patient_id}")
async def eliminar(patient_id: str):
    resultado = await borrar_paciente(patient_id)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.put("/{patient_id}")
async def actualizar(patient_id: str, datos: ActualizarPaciente):
    resultado = await actualizar_paciente(patient_id, datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.post("/ubicacion")
async def guardar(datos: ActaulizarUbicacion):
    resultado = await guardar_ubicacion(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado