from fastapi import APIRouter, HTTPException, Depends
from models.model_familiar import CrearFamiliar, VerificarFamiliar
from services.service_familiar import (
    registrar_familiar, verificar_familiar,
    listar_grupos_familiar, listar_pacientes_familiar,
)
from security.dependencies import get_familiar_actual

router = APIRouter(prefix="/familiares", tags=["Familiares"])


@router.post("/registrar")
async def registrar(datos: CrearFamiliar):
    resultado = await registrar_familiar(datos)
    if "error" in resultado:
        raise HTTPException(status_code=400, detail=resultado["error"])
    return resultado


@router.post("/verificar")
async def verificar(datos: VerificarFamiliar):
    resultado = await verificar_familiar(datos.email, datos.password)
    if "mensaje" in resultado:
        raise HTTPException(status_code=401, detail=resultado["mensaje"])
    return resultado


@router.get("/grupos")
async def mis_grupos(familiar_actual=Depends(get_familiar_actual)):
    familiar_id = str(familiar_actual["_id"])
    resultado   = await listar_grupos_familiar(familiar_id)
    if isinstance(resultado, dict) and "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado


@router.get("/pacientes")
async def mis_pacientes(familiar_actual=Depends(get_familiar_actual)):
    familiar_id = str(familiar_actual["_id"])
    resultado   = await listar_pacientes_familiar(familiar_id)
    if isinstance(resultado, dict) and "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado
