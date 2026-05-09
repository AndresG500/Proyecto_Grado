from fastapi import APIRouter, HTTPException, Depends
from models.model_cuidador import RespuestaCuidador, CrearCuidador, ActualizarCuidador, VerificarCuidador
from services.service_cuidador import registrar_cuidador, borrar_cuidador, actualizar_cuidador, verificar_cuidador, actualizar_fcm
from services.service_auth import revocar_token
from security.dependencies import get_cuidador_actual, oauth2_scheme
from security.jwt_handler import verificar_token
from pydantic import BaseModel, Field
router = APIRouter(prefix="/cuidadores", tags=["Cuidadores"])

class FCMToken(BaseModel):
    token: str = Field(..., example="fcm_token_example")

@router.post("/registrar")
async def registrar(datos: CrearCuidador):
    resultado = await registrar_cuidador(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado

@router.delete("/eliminar")
async def eliminar(email: str, cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await borrar_cuidador(email, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado

@router.put("/actualizar")
async def actualizar( email: str, datos: ActualizarCuidador,cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await actualizar_cuidador(email, datos, cuidador_actual["email"])
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado

@router.get("/perfil")
async def perfil(cuidador_actual = Depends(get_cuidador_actual)):
    cuidador_actual["_id"] = str(cuidador_actual["_id"])
    return cuidador_actual

@router.post("/verificar")
async def verificar(datos: VerificarCuidador):
    resultado = await verificar_cuidador(datos.email, datos.password)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado


@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    cuidador_actual = Depends(get_cuidador_actual),
):
    datos = verificar_token(token)
    if datos:
        await revocar_token(datos.get("jti"), datos.get("exp"))
    return {"mensaje": "Sesión cerrada exitosamente"}

@router.patch("/fcm-token")
async def actualizar_fcm_token(
    datos: FCMToken,
    cuidador_actual: dict = Depends(get_cuidador_actual),
):
    email = cuidador_actual.get("sub")
    return await actualizar_fcm(email, datos.token)