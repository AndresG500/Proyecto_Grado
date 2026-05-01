from datetime import datetime, timedelta
from bson import ObjectId
from database.database import get_database  # ← corregido
from models.model_dispositivo import CrearDispositivo, ActualizarDispositivo
from utils.Logger import Logger

MINUTOS_DISPONIBLE = 5


async def registrar_dispositivo(datos: CrearDispositivo):
    try:
        coleccion = get_database()["Dispositivos"]
        dispositivo = await coleccion.find_one({"id_dispositivo": datos.id_dispositivo})
        if dispositivo:
            Logger.add_to_log("warn", f"Dispositivo ya registrado: {datos.id_dispositivo}")
            return {"mensaje": "Este ID de dispositivo ya ha sido registrado"}

        await coleccion.insert_one({
            "id_dispositivo":     datos.id_dispositivo,
            "paciente_id":        datos.paciente_id,
            "estado":             datos.estado,
            "ultima_localizacion": None,
            "ultima_conexion":    None,
            "nivel_bateria":      None,
            "created_at":         datetime.utcnow()
        })

        Logger.add_to_log("info", f"Dispositivo registrado: {datos.id_dispositivo}")
        return {"mensaje": "Dispositivo registrado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al registrar dispositivo: {ex}")
        return {"error": f"No se pudo registrar el dispositivo: {ex}"}


async def obtener_dispositivo(id_dispositivo: str):
    try:
        coleccion = get_database()["Dispositivos"]
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


async def obtener_dispositivo_por_paciente(paciente_id: str):
    try:
        coleccion = get_database()["Dispositivos"]
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


async def actualizar_dispositivo(id_dispositivo: str, datos: ActualizarDispositivo, cuidador_email: str):
    try:
        db                  = get_database()
        coleccion           = db["Dispositivos"]
        coleccion_pacientes = db["Pacientes"]
        coleccion_cuidadores = db["Cuidadores"]

        dispositivo = await coleccion.find_one({"id_dispositivo": id_dispositivo})
        if not dispositivo:
            Logger.add_to_log("warn", f"Dispositivo no encontrado: {id_dispositivo}")
            return {"mensaje": "No se encontró el dispositivo"}

        # Verificar ownership via email
        if dispositivo.get("paciente_id"):
            cuidador = await coleccion_cuidadores.find_one({"email": cuidador_email})
            if not cuidador:
                return {"error": "Cuidador no encontrado"}

            paciente = await coleccion_pacientes.find_one({"_id": ObjectId(dispositivo["paciente_id"])})
            if paciente and str(paciente.get("id_cuidador")) != str(cuidador["_id"]):
                Logger.add_to_log("warn", f"Actualización no autorizada: {cuidador_email} vs dispositivo {id_dispositivo}")
                return {"error": "No tienes permiso para actualizar este dispositivo"}

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


async def desvincular_dispositivo(id_dispositivo: str, cuidador_email: str):
    try:
        db                   = get_database()
        coleccion            = db["Dispositivos"]
        coleccion_pacientes  = db["Pacientes"]
        coleccion_cuidadores = db["Cuidadores"]

        dispositivo = await coleccion.find_one({"id_dispositivo": id_dispositivo})
        if not dispositivo:
            Logger.add_to_log("warn", f"Dispositivo no encontrado: {id_dispositivo}")
            return {"mensaje": "No se encontró el dispositivo"}

        if dispositivo.get("paciente_id"):
            cuidador = await coleccion_cuidadores.find_one({"email": cuidador_email})
            if not cuidador:
                return {"error": "Cuidador no encontrado"}

            paciente = await coleccion_pacientes.find_one({"_id": ObjectId(dispositivo["paciente_id"])})
            if paciente and str(paciente.get("id_cuidador")) != str(cuidador["_id"]):
                Logger.add_to_log("warn", f"Desvinculación no autorizada: {cuidador_email} vs dispositivo {id_dispositivo}")
                return {"error": "No tienes permiso para desvincular este dispositivo"}

        await coleccion.update_one(
            {"id_dispositivo": id_dispositivo},
            {"$set": {
                "paciente_id":     None,
                "estado":          False,
                "ultima_conexion": datetime.utcnow()
            }}
        )

        Logger.add_to_log("info", f"Dispositivo desvinculado: {id_dispositivo}")
        return {"mensaje": "Dispositivo desvinculado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al desvincular dispositivo: {ex}")
        return {"error": f"No se pudo desvincular el dispositivo: {ex}"}


# ─── Flujo de vinculación automática ─────────────────────────────────────────

async def anunciar_dispositivo(id_dispositivo: str):
    try:
        coleccion = get_database()["DispositivosDisponibles"]
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
        db              = get_database()
        disponibles_col = db["DispositivosDisponibles"]
        registrados_col = db["Dispositivos"]

        ids_registrados = await registrados_col.distinct(
            "id_dispositivo", {"paciente_id": {"$ne": None}}
        )

        corte = datetime.utcnow() - timedelta(minutes=MINUTOS_DISPONIBLE)

        cursor = disponibles_col.find({
            "dispositivo_detectado": {"$gte": corte},
            "id_dispositivo":        {"$nin": ids_registrados}
        })

        return [
            {"id_dispositivo": d["id_dispositivo"], "dispositivo_detectado": d["dispositivo_detectado"]}
            async for d in cursor
        ]

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener dispositivos disponibles: {ex}")
        return {"error": f"No se pudieron obtener los dispositivos disponibles: {ex}"}


async def vincular_dispositivo(id_dispositivo: str, paciente_id: str, cuidador_email: str):
    try:
        db               = get_database()
        disponibles_col  = db["DispositivosDisponibles"]
        dispositivos_col = db["Dispositivos"]
        pacientes_col    = db["Pacientes"]
        cuidadores_col   = db["Cuidadores"]

        # Verificar que el paciente pertenece al cuidador
        cuidador = await cuidadores_col.find_one({"email": cuidador_email})
        if not cuidador:
            return {"error": "Cuidador no encontrado"}

        paciente = await pacientes_col.find_one({"_id": ObjectId(paciente_id)})
        if not paciente:
            return {"error": "Paciente no encontrado"}

        if str(paciente.get("id_cuidador")) != str(cuidador["_id"]):
            return {"error": "No tienes permiso para vincular a este paciente"}

        encontrado = await disponibles_col.find_one({"id_dispositivo": id_dispositivo})
        if not encontrado:
            Logger.add_to_log("warn", f"Dispositivo no disponible: {id_dispositivo}")
            return {"error": "Dispositivo no disponible o no detectado recientemente"}

        existente = await dispositivos_col.find_one({
            "id_dispositivo": id_dispositivo,
            "paciente_id":    {"$ne": None}
        })
        if existente:
            Logger.add_to_log("warn", f"Dispositivo ya vinculado: {id_dispositivo}")
            return {"error": "El dispositivo ya está vinculado a un paciente"}

        desvinculado = await dispositivos_col.find_one({
            "id_dispositivo": id_dispositivo,
            "paciente_id":    None
        })

        if desvinculado:
            await dispositivos_col.update_one(
                {"id_dispositivo": id_dispositivo},
                {"$set": {
                    "paciente_id":     paciente_id,
                    "estado":          True,
                    "ultima_conexion": datetime.utcnow()
                }}
            )
        else:
            await dispositivos_col.insert_one({
                "id_dispositivo":      id_dispositivo,
                "paciente_id":         paciente_id,
                "estado":              True,
                "ultima_localizacion": None,
                "ultima_conexion":     datetime.utcnow(),
                "nivel_bateria":       None,
                "created_at":          datetime.utcnow()
            })

        await disponibles_col.delete_one({"id_dispositivo": id_dispositivo})

        Logger.add_to_log("info", f"Dispositivo {id_dispositivo} vinculado a paciente {paciente_id}")
        return {"mensaje": f"Dispositivo {id_dispositivo} vinculado al paciente exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al vincular dispositivo: {ex}")
        return {"error": f"No se pudo vincular el dispositivo: {ex}"}