from fastapi import APIRouter, HTTPException
from models.model_cuidador import RespuestaCuidador, CrearCuidador, ActualizarCuidador
from services.service_cuidador import registrar_cuidador, borrar_cuidador, actualizar_cuidador, verificar_cuidador

router = APIRouter(prefix="/cuidadores", tags=["Cuidadores"])

@router.post("/registrar")
async def registrar(datos: CrearCuidador):
    resultado = await registrar_cuidador(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.delete("/eliminar")
async def eliminar(email: str):
    resultado = await borrar_cuidador(email)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.put("/actualizar")
async def actualizar(email: str, datos: ActualizarCuidador):
    resultado = await actualizar_cuidador(email, datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.post("/verificar")
async def verificar(email: str, password: str):
    resultado = await verificar_cuidador(email, password)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

