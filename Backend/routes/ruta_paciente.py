from fastapi import APIRouter, HTTPException, Depends
from models.model_paciente import CrearPaciente, ActualizarPaciente
from services.service_paciente import registrar_paciente, obtener_paciente, borrar_paciente, actualizar_paciente, listar_pacientes
from security.dependencies import get_cuidador_actual

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


@router.get("/")
async def listar(cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await listar_pacientes(cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado