from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, Path
from models.model_grupo import CrearGrupo, ActualizarGrupo, AgregarCuidador, AgregarPaciente, UbicacionCuidador
from services.service_grupo import (
    crear_grupo, eliminar_grupo, obtener_grupo, actualizar_grupo,
    agregar_cuidador, eliminar_cuidador,
    agregar_paciente,
    guardar_ubicacion_cuidador, obtener_ubicaciones_grupo, obtener_cuidador_mas_cercano
)
from security.dependencies import get_cuidador_actual

MongoId = Annotated[str, Path(pattern=r'^[a-f\d]{24}$')]
router = APIRouter(prefix="/grupos", tags=["Grupos"])


# --- Endpoints protegidos (requieren JWT) ---

@router.post("/crear")
async def crear(
    datos: CrearGrupo,
    cuidador_actual = Depends(get_cuidador_actual)
):
    datos.cuidador_principal_id = str(cuidador_actual["_id"])
    resultado = await crear_grupo(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado


@router.delete("/{grupo_id}")
async def eliminar(
    grupo_id: MongoId,
    cuidador_actual = Depends(get_cuidador_actual)
):
    cuidador_id = str(cuidador_actual["_id"])
    resultado = await eliminar_grupo(grupo_id, cuidador_id)
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.put("/{grupo_id}")
async def actualizar(
    grupo_id: MongoId,
    datos: ActualizarGrupo,
    cuidador_actual = Depends(get_cuidador_actual)
):
    cuidador_id = str(cuidador_actual["_id"])
    resultado = await actualizar_grupo(grupo_id, cuidador_id, datos)
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.get("/{grupo_id}")
async def obtener(
    grupo_id: MongoId,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await obtener_grupo(grupo_id)
    if "error" in resultado:
        raise HTTPException(status_code=404, detail=resultado["error"])
    return resultado


@router.post("/{grupo_id}/cuidadores")
async def add_cuidador(
    grupo_id: MongoId,
    datos: AgregarCuidador,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await agregar_cuidador(grupo_id, datos.cuidador_id, str(cuidador_actual["_id"]))
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    if "mensaje" in resultado and "ya pertenece" in resultado["mensaje"].lower():
        raise HTTPException(status_code=400, detail=resultado["mensaje"])
    return resultado


@router.delete("/{grupo_id}/cuidadores/{cuidador_id}")
async def remove_cuidador(
    grupo_id: MongoId,
    cuidador_id: MongoId,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await eliminar_cuidador(grupo_id, cuidador_id)
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.post("/{grupo_id}/pacientes")
async def add_paciente(
    grupo_id: MongoId,
    datos: AgregarPaciente,
    cuidador_actual = Depends(get_cuidador_actual)
):
    resultado = await agregar_paciente(grupo_id, datos.paciente_id, str(cuidador_actual["_id"]))
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    if "mensaje" in resultado and "ya pertenece" in resultado["mensaje"].lower():
        raise HTTPException(status_code=400, detail=resultado["mensaje"])
    return resultado


@router.post("/{grupo_id}/ubicacion")
async def guardar_ubicacion(
    grupo_id: MongoId,
    datos: UbicacionCuidador,
    cuidador_actual = Depends(get_cuidador_actual)
):
    datos.cuidador_id = str(cuidador_actual["_id"])
    resultado = await guardar_ubicacion_cuidador(datos)
    if "error" in resultado:
        raise HTTPException(status_code=500, detail=resultado["error"])
    return resultado


@router.get("/{grupo_id}/ubicaciones")
async def obtener_ubicaciones(grupo_id: str, cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await obtener_ubicaciones_grupo(grupo_id, str(cuidador_actual["_id"]))
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    return resultado


@router.get("/{grupo_id}/cuidador-cercano")
async def get_cuidador_cercano(grupo_id: str, latitud: float, longitud: float, cuidador_actual = Depends(get_cuidador_actual)):
    resultado = await obtener_cuidador_mas_cercano(grupo_id, latitud, longitud, str(cuidador_actual["_id"]))
    if "error" in resultado:
        raise HTTPException(status_code=403, detail=resultado["error"])
    if "mensaje" in resultado:
        raise HTTPException(status_code=404, detail=resultado["mensaje"])
    return resultado