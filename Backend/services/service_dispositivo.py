from datetime import datetime, timedelta
from database.database import conexion_database
from models.model_dispositivo import CrearDispositivo, ActualizarDispositivo
from utils.Logger import Logger

MINUTOS_DISPONIBLE = 5


async def registrar_dispositivo(datos: CrearDispositivo):
    try:
        coleccion = conexion_database()["Dispositivos"]
        dispositivo = await coleccion.find_one({"id_dispositivo": datos.id_dispositivo})
        if dispositivo:
            Logger.add_to_log("warn", f"Dispositivo ya registrado: {datos.id_dispositivo}")
            return {"mensaje": "Este ID de dispositivo ya ha sido registrado"}

        await coleccion.insert_one({
            "id_dispositivo": datos.id_dispositivo,
            "paciente_id": datos.paciente_id,
            "estado": datos.estado,
            "ultima_localizacion": None,
            "ultima_conexion": None,
            "nivel_bateria": None,
            "created_at": datetime.utcnow()
        })

        Logger.add_to_log("info", f"Dispositivo registrado: {datos.id_dispositivo}")
        return {"mensaje": "Dispositivo registrado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al registrar dispositivo: {ex}")
        return {"error": f"No se pudo registrar el dispositivo: {ex}"}


async def obtener_dispositivo(id_dispositivo: str) -> dict | None:
    try:
        coleccion = conexion_database()["Dispositivos"]
        dispositivo = await coleccion.find_one({"id_dispositivo": id_dispositivo})
        if not dispositivo:
            Logger.add_to_log("warn", f"Dispositivo no encontrado: {id_dispositivo}")
            return {"mensaje": "No se encontró el dispositivo"}

        dispositivo["id"] = str(dispositivo["_id"])
        del dispositivo["_id"]
        return dispositivo

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener dispositivo: {ex}")
        return {"error": f"No se pudo obtener el dispositivo: {ex}"}


async def obtener_dispositivo_por_paciente(paciente_id: str) -> dict | None:
    try:
        coleccion = conexion_database()["Dispositivos"]
        dispositivo = await coleccion.find_one({"paciente_id": paciente_id})
        if not dispositivo:
            Logger.add_to_log("warn", f"Dispositivo no encontrado para paciente: {paciente_id}")
            return {"mensaje": "No se encontró un dispositivo asociado a este paciente"}

        dispositivo["id"] = str(dispositivo["_id"])
        del dispositivo["_id"]
        return dispositivo

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener dispositivo por paciente: {ex}")
        return {"error": f"No se pudo obtener el dispositivo: {ex}"}


async def actualizar_dispositivo(id_dispositivo: str, datos: ActualizarDispositivo):
    try:
        coleccion = conexion_database()["Dispositivos"]
        dispositivo = await coleccion.find_one({"id_dispositivo": id_dispositivo})
        if not dispositivo:
            Logger.add_to_log("warn", f"Dispositivo no encontrado para actualizar: {id_dispositivo}")
            return {"mensaje": "No se encontró el dispositivo"}

        campos = {}
        if datos.estado is not None:
            campos["estado"] = datos.estado
        if datos.ultima_localizacion is not None:
            campos["ultima_localizacion"] = datos.ultima_localizacion.model_dump()
        if datos.ultima_conexion is not None:
            campos["ultima_conexion"] = datos.ultima_conexion
        if datos.nivel_bateria is not None:
            campos["nivel_bateria"] = datos.nivel_bateria

        if campos:
            await coleccion.update_one({"id_dispositivo": id_dispositivo}, {"$set": campos})

        Logger.add_to_log("info", f"Dispositivo actualizado: {id_dispositivo}")
        return {"mensaje": "Dispositivo actualizado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al actualizar dispositivo: {ex}")
        return {"error": f"No se pudo actualizar el dispositivo: {ex}"}


async def desvincular_dispositivo(id_dispositivo: str):
    try:
        coleccion = conexion_database()["Dispositivos"]
        dispositivo = await coleccion.find_one({"id_dispositivo": id_dispositivo})
        if not dispositivo:
            Logger.add_to_log("warn", f"Dispositivo no encontrado para desvincular: {id_dispositivo}")
            return {"mensaje": "No se encontró el dispositivo"}

        await coleccion.update_one(
            {"id_dispositivo": id_dispositivo},
            {"$set": {
                "paciente_id": None,
                "estado": False,
                "ultima_conexion": datetime.utcnow()
            }}
        )

        Logger.add_to_log("info", f"Dispositivo desvinculado: {id_dispositivo}")
        return {"mensaje": "Dispositivo desvinculado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al desvincular dispositivo: {ex}")
        return {"error": f"No se pudo desvincular el dispositivo: {ex}"}


# --- Flujo de vinculación automática ---

async def anunciar_dispositivo(id_dispositivo: str):
    try:
        coleccion = conexion_database()["DispositivosDisponibles"]
        await coleccion.update_one(
            {"id_dispositivo": id_dispositivo},
            {"$set": {"id_dispositivo": id_dispositivo, "dispositivo_detectado": datetime.utcnow()}},
            upsert=True
        )
        Logger.add_to_log("info", f"Dispositivo anunciado: {id_dispositivo}")

    except Exception as ex:
        Logger.add_to_log("error", f"Error al anunciar dispositivo: {ex}")
        return {"error": f"No se pudo anunciar el dispositivo: {ex}"}


async def obtener_dispositivos_disponibles() -> list:
    try:
        disponibles_col = conexion_database()["DispositivosDisponibles"]
        registrados_col = conexion_database()["Dispositivos"]

        # Excluir solo dispositivos que tienen paciente asignado activamente
        ids_registrados = await registrados_col.distinct(
            "id_dispositivo", {"paciente_id": {"$ne": None}}
        )

        corte = datetime.utcnow() - timedelta(minutes=MINUTOS_DISPONIBLE)

        cursor = disponibles_col.find({
            "dispositivo_detectado": {"$gte": corte},
            "id_dispositivo": {"$nin": ids_registrados}
        })

        return [
            {"id_dispositivo": d["id_dispositivo"], "dispositivo_detectado": d["dispositivo_detectado"]}
            async for d in cursor
        ]

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener dispositivos disponibles: {ex}")
        return {"error": f"No se pudieron obtener los dispositivos disponibles: {ex}"}


async def vincular_dispositivo(id_dispositivo: str, paciente_id: str):
    try:
        disponibles_col = conexion_database()["DispositivosDisponibles"]
        dispositivos_col = conexion_database()["Dispositivos"]

        encontrado = await disponibles_col.find_one({"id_dispositivo": id_dispositivo})
        if not encontrado:
            Logger.add_to_log("warn", f"Dispositivo no disponible para vincular: {id_dispositivo}")
            return {"error": "Dispositivo no disponible o no detectado recientemente"}

        existente = await dispositivos_col.find_one({
            "id_dispositivo": id_dispositivo,
            "paciente_id": {"$ne": None}
        })
        if existente:
            Logger.add_to_log("warn", f"Dispositivo ya vinculado: {id_dispositivo}")
            return {"error": "El dispositivo ya está vinculado a un paciente"}

        # Si el dispositivo fue desvinculado antes, reutilizar el documento
        desvinculado = await dispositivos_col.find_one({
            "id_dispositivo": id_dispositivo,
            "paciente_id": None
        })

        if desvinculado:
            await dispositivos_col.update_one(
                {"id_dispositivo": id_dispositivo},
                {"$set": {
                    "paciente_id": paciente_id,
                    "estado": True,
                    "ultima_conexion": datetime.utcnow()
                }}
            )
        else:
            await dispositivos_col.insert_one({
                "id_dispositivo": id_dispositivo,
                "paciente_id": paciente_id,
                "estado": True,
                "ultima_localizacion": None,
                "ultima_conexion": datetime.utcnow(),
                "nivel_bateria": None,
                "created_at": datetime.utcnow()
            })

        await disponibles_col.delete_one({"id_dispositivo": id_dispositivo})

        Logger.add_to_log("info", f"Dispositivo {id_dispositivo} vinculado a paciente {paciente_id}")
        return {"mensaje": f"Dispositivo {id_dispositivo} vinculado al paciente exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al vincular dispositivo: {ex}")
        return {"error": f"No se pudo vincular el dispositivo: {ex}"}