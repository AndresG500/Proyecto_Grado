from datetime import datetime
from database.database import get_database
from models.model_grupo import CrearGrupo, ActualizarGrupo, UbicacionCuidador
from bson import ObjectId
from utils.Logger import Logger
from utils.geo import calcular_distancia


async def crear_grupo(datos: CrearGrupo):
    try:
        db             = get_database()
        col_grupos     = db["Grupos"]
        col_cuidadores = db["Cuidadores"]
        col_pacientes  = db["Pacientes"]

        # Verificar que el cuidador principal existe
        cuidador = await col_cuidadores.find_one({"_id": ObjectId(datos.cuidador_principal_id)})
        if not cuidador:
            Logger.add_to_log("warn", f"Cuidador principal no encontrado: {datos.cuidador_principal_id}")
            return {"mensaje": "No se encontró el cuidador principal"}

        # Verificar que los pacientes existen y pertenecen al cuidador
        for paciente_id in datos.paciente_ids:
            paciente = await col_pacientes.find_one({"_id": ObjectId(paciente_id)})
            if not paciente:
                Logger.add_to_log("warn", f"Paciente no encontrado: {paciente_id}")
                return {"mensaje": f"No se encontró el paciente {paciente_id}"}
            if str(paciente.get("id_cuidador")) != datos.cuidador_principal_id:
                Logger.add_to_log("warn", f"Paciente {paciente_id} no pertenece al cuidador: {datos.cuidador_principal_id}")
                return {"error": f"El paciente {paciente_id} no pertenece a tu cuenta"}

        resultado = await col_grupos.insert_one({
            "nombre":                datos.nombre,
            "cuidador_principal_id": datos.cuidador_principal_id,
            "cuidador_ids":          [datos.cuidador_principal_id],
            "paciente_ids":          datos.paciente_ids,
            "created_at":            datetime.utcnow()
        })

        grupo_id = str(resultado.inserted_id)

        # Agregar grupo_id al cuidador principal
        await col_cuidadores.update_one(
            {"_id": ObjectId(datos.cuidador_principal_id)},
            {"$push": {"grupo_ids": grupo_id}}
        )

        # Agregar grupo_id a cada paciente
        for paciente_id in datos.paciente_ids:
            await col_pacientes.update_one(
                {"_id": ObjectId(paciente_id)},
                {"$push": {"grupo_ids": grupo_id}}
            )

        Logger.add_to_log("info", f"Grupo creado: {grupo_id}")
        return {"mensaje": "Grupo creado exitosamente", "grupo_id": grupo_id}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al crear grupo: {ex}")
        return {"error": f"No se pudo crear el grupo: {ex}"}


async def eliminar_grupo(grupo_id: str, cuidador_id: str):
    try:
        db             = get_database()
        col_grupos     = db["Grupos"]
        col_cuidadores = db["Cuidadores"]
        col_pacientes  = db["Pacientes"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"mensaje": "No se encontró el grupo"}

        if str(grupo.get("cuidador_principal_id")) != cuidador_id:
            Logger.add_to_log("warn", f"Intento de eliminación no autorizado: {cuidador_id}")
            return {"error": "No tienes permiso para eliminar este grupo"}

        # Desvincular grupo de todos los cuidadores
        for c_id in grupo["cuidador_ids"]:
            await col_cuidadores.update_one(
                {"_id": ObjectId(c_id)},
                {"$pull": {"grupo_ids": grupo_id}}
            )

        # Desvincular grupo de todos los pacientes
        for paciente_id in grupo["paciente_ids"]:
            await col_pacientes.update_one(
                {"_id": ObjectId(paciente_id)},
                {"$pull": {"grupo_ids": grupo_id}}
            )

        await col_grupos.delete_one({"_id": ObjectId(grupo_id)})

        Logger.add_to_log("info", f"Grupo eliminado: {grupo_id}")
        return {"mensaje": "Grupo eliminado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al eliminar grupo: {ex}")
        return {"error": f"No se pudo eliminar el grupo: {ex}"}


async def agregar_cuidador(grupo_id: str, cuidador_id: str, cuidador_solicitante_id: str):
    try:
        db             = get_database()
        col_grupos     = db["Grupos"]
        col_cuidadores = db["Cuidadores"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"mensaje": "No se encontró el grupo"}

        if str(grupo.get("cuidador_principal_id")) != cuidador_solicitante_id:
            Logger.add_to_log("warn", f"Intento de agregar cuidador sin autorización: {cuidador_solicitante_id}")
            return {"error": "No tienes permiso para agregar cuidadores a este grupo"}

        cuidador = await col_cuidadores.find_one({"_id": ObjectId(cuidador_id)})
        if not cuidador:
            Logger.add_to_log("warn", f"Cuidador no encontrado: {cuidador_id}")
            return {"mensaje": "No se encontró el cuidador"}

        if cuidador_id in grupo["cuidador_ids"]:
            Logger.add_to_log("warn", f"Cuidador ya pertenece al grupo: {cuidador_id}")
            return {"mensaje": "El cuidador ya pertenece a este grupo"}

        await col_grupos.update_one(
            {"_id": ObjectId(grupo_id)},
            {"$push": {"cuidador_ids": cuidador_id}}
        )

        await col_cuidadores.update_one(
            {"_id": ObjectId(cuidador_id)},
            {"$push": {"grupo_ids": grupo_id}}
        )

        Logger.add_to_log("info", f"Cuidador {cuidador_id} agregado al grupo {grupo_id}")
        return {"mensaje": "Cuidador agregado al grupo exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al agregar cuidador: {ex}")
        return {"error": f"No se pudo agregar el cuidador: {ex}"}


async def eliminar_cuidador(grupo_id: str, cuidador_id: str):
    try:
        db             = get_database()
        col_grupos     = db["Grupos"]
        col_cuidadores = db["Cuidadores"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"mensaje": "No se encontró el grupo"}

        # El cuidador principal no puede ser eliminado del grupo
        if cuidador_id == grupo["cuidador_principal_id"]:
            Logger.add_to_log("warn", f"Intento de eliminar al cuidador principal: {cuidador_id}")
            return {"mensaje": "El cuidador principal no puede ser eliminado del grupo"}

        if cuidador_id not in grupo["cuidador_ids"]:
            Logger.add_to_log("warn", f"Cuidador no pertenece al grupo: {cuidador_id}")
            return {"mensaje": "El cuidador no pertenece a este grupo"}

        await col_grupos.update_one(
            {"_id": ObjectId(grupo_id)},
            {"$pull": {"cuidador_ids": cuidador_id}}
        )

        await col_cuidadores.update_one(
            {"_id": ObjectId(cuidador_id)},
            {"$pull": {"grupo_ids": grupo_id}}
        )

        Logger.add_to_log("info", f"Cuidador {cuidador_id} eliminado del grupo {grupo_id}")
        return {"mensaje": "Cuidador eliminado del grupo exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al eliminar cuidador del grupo: {ex}")
        return {"error": f"No se pudo eliminar el cuidador del grupo: {ex}"}


async def agregar_paciente(grupo_id: str, paciente_id: str, cuidador_solicitante_id: str):
    try:
        db            = get_database()
        col_grupos    = db["Grupos"]
        col_pacientes = db["Pacientes"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"mensaje": "No se encontró el grupo"}

        if str(grupo.get("cuidador_principal_id")) != cuidador_solicitante_id:
            Logger.add_to_log("warn", f"Intento de agregar paciente sin autorización: {cuidador_solicitante_id}")
            return {"error": "No tienes permiso para agregar pacientes a este grupo"}

        paciente = await col_pacientes.find_one({"_id": ObjectId(paciente_id)})
        if not paciente:
            Logger.add_to_log("warn", f"Paciente no encontrado: {paciente_id}")
            return {"mensaje": "No se encontró el paciente"}

        if paciente_id in grupo["paciente_ids"]:
            Logger.add_to_log("warn", f"Paciente ya pertenece al grupo: {paciente_id}")
            return {"mensaje": "El paciente ya pertenece a este grupo"}

        await col_grupos.update_one(
            {"_id": ObjectId(grupo_id)},
            {"$push": {"paciente_ids": paciente_id}}
        )

        await col_pacientes.update_one(
            {"_id": ObjectId(paciente_id)},
            {"$push": {"grupo_ids": grupo_id}}
        )

        Logger.add_to_log("info", f"Paciente {paciente_id} agregado al grupo {grupo_id}")
        return {"mensaje": "Paciente agregado al grupo exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al agregar paciente: {ex}")
        return {"error": f"No se pudo agregar el paciente: {ex}"}


async def guardar_ubicacion_cuidador(datos: UbicacionCuidador):
    try:
        db            = get_database()
        col_ubicaciones = db["UbicacionesCuidadores"]

        await col_ubicaciones.update_one(
            {"cuidador_id": datos.cuidador_id},
            {"$set": {
                "cuidador_id": datos.cuidador_id,
                "latitud":     datos.latitud,
                "longitud":    datos.longitud,
                "timestamp":   datetime.utcnow()
            }},
            upsert=True
        )

        Logger.add_to_log("info", f"Ubicación de cuidador actualizada: {datos.cuidador_id}")
        return {"mensaje": "Ubicación actualizada exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al guardar ubicación del cuidador: {ex}")
        return {"error": f"No se pudo guardar la ubicación: {ex}"}


async def obtener_ubicaciones_grupo(grupo_id: str, cuidador_solicitante_id: str):
    try:
        db              = get_database()
        col_grupos      = db["Grupos"]
        col_ubicaciones = db["UbicacionesCuidadores"]
        col_pacientes   = db["Pacientes"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"mensaje": "No se encontró el grupo"}

        if cuidador_solicitante_id not in grupo.get("cuidador_ids", []):
            Logger.add_to_log("warn", f"Cuidador {cuidador_solicitante_id} no pertenece al grupo {grupo_id}")
            return {"error": "No tienes permiso para ver las ubicaciones de este grupo"}

        # Ubicaciones de cuidadores
        ubicaciones_cuidadores = []
        async for ub in col_ubicaciones.find({"cuidador_id": {"$in": grupo["cuidador_ids"]}}):
            ub.pop("_id", None)
            ubicaciones_cuidadores.append(ub)

        # Ultima ubicacion de cada paciente
        ubicaciones_pacientes = []
        for paciente_id in grupo["paciente_ids"]:
            paciente = await col_pacientes.find_one({"_id": ObjectId(paciente_id)})
            if paciente and paciente.get("ultima_ubicacion"):
                ubicaciones_pacientes.append({
                    "paciente_id":      paciente_id,
                    "nombre_paciente":  paciente["nombre_paciente"],
                    "ultima_ubicacion": paciente["ultima_ubicacion"]
                })

        Logger.add_to_log("info", f"Ubicaciones obtenidas para grupo: {grupo_id}")
        return {
            "cuidadores": ubicaciones_cuidadores,
            "pacientes":  ubicaciones_pacientes
        }

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener ubicaciones del grupo: {ex}")
        return {"error": f"No se pudieron obtener las ubicaciones: {ex}"}


async def obtener_cuidador_mas_cercano(grupo_id: str, latitud_paciente: float, longitud_paciente: float, cuidador_solicitante_id: str):
    try:
        db              = get_database()
        col_grupos      = db["Grupos"]
        col_ubicaciones = db["UbicacionesCuidadores"]
        col_cuidadores  = db["Cuidadores"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"mensaje": "No se encontró el grupo"}

        if cuidador_solicitante_id not in grupo.get("cuidador_ids", []):
            Logger.add_to_log("warn", f"Cuidador {cuidador_solicitante_id} no pertenece al grupo {grupo_id}")
            return {"error": "No tienes permiso para ver este grupo"}

        mas_cercano  = None
        min_distancia = float("inf")

        async for ub in col_ubicaciones.find({"cuidador_id": {"$in": grupo["cuidador_ids"]}}):
            distancia = calcular_distancia(
                latitud_paciente, longitud_paciente,
                ub["latitud"], ub["longitud"]
            )
            if distancia < min_distancia:
                min_distancia = distancia
                mas_cercano   = ub["cuidador_id"]

        if not mas_cercano:
            Logger.add_to_log("warn", f"Sin ubicaciones de cuidadores para grupo: {grupo_id}")
            return {"mensaje": "No hay ubicaciones disponibles de los cuidadores"}

        cuidador = await col_cuidadores.find_one({"_id": ObjectId(mas_cercano)})
        if not cuidador:
            Logger.add_to_log("warn", f"Cuidador no encontrado: {mas_cercano}")
            return {"mensaje": "El cuidador más cercano ya no existe"}

        Logger.add_to_log("info", f"Cuidador más cercano: {mas_cercano}")
        return {
            "cuidador_id":  mas_cercano,
            "nombre":       cuidador["name"],
            "distancia_m":  round(min_distancia, 2)
        }

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener cuidador más cercano: {ex}")
        return {"error": f"No se pudo obtener el cuidador más cercano: {ex}"}


async def obtener_grupo(grupo_id: str):
    try:
        db         = get_database()
        col_grupos = db["Grupos"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"error": "No se encontró el grupo"}

        grupo["id"] = str(grupo["_id"])
        del grupo["_id"]

        Logger.add_to_log("info", f"Grupo obtenido: {grupo_id}")
        return grupo

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener grupo: {ex}")
        return {"error": f"No se pudo obtener el grupo: {ex}"}


async def actualizar_grupo(grupo_id: str, cuidador_id: str, datos: ActualizarGrupo):
    try:
        db         = get_database()
        col_grupos = db["Grupos"]

        grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
        if not grupo:
            Logger.add_to_log("warn", f"Grupo no encontrado: {grupo_id}")
            return {"error": "No se encontró el grupo"}

        if str(grupo.get("cuidador_principal_id")) != cuidador_id:
            Logger.add_to_log("warn", f"Intento de actualización no autorizado: {cuidador_id}")
            return {"error": "No tienes permiso para actualizar este grupo"}

        campos = {}
        if datos.nombre:
            campos["nombre"] = datos.nombre

        if campos:
            await col_grupos.update_one({"_id": ObjectId(grupo_id)}, {"$set": campos})
            Logger.add_to_log("info", f"Grupo actualizado: {grupo_id}")
            return {"mensaje": "Grupo actualizado exitosamente"}
        else:
            return {"mensaje": "No se proporcionaron campos para actualizar"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al actualizar grupo: {ex}")
        return {"error": f"No se pudo actualizar el grupo: {ex}"}