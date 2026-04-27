from database.database import conexion_database
from models.model_paciente import CrearPaciente, ActualizarPaciente, ActaulizarUbicacion
from bson import ObjectId
from datetime import datetime
from utils.Logger import Logger

conexion = conexion_database()
coleccion         = conexion["Pacientes"]
col_ubicaciones   = conexion["Ubicaciones"]
col_cuidadores    = conexion["Cuidadores"]

async def registrar_paciente(datos: CrearPaciente):
    try:
        cuidador = await col_cuidadores.find_one({"_id": ObjectId(datos.id_cuidador)})
        if not cuidador:
            Logger.add_to_log("warn", f"Cuidador no encontrado: {datos.id_cuidador}")
            return {"mensaje": "No se encontró el cuidador especificado"}

        resultado = await coleccion.insert_one({
            "nombre_paciente": datos.nombre_paciente,
            "edad_paciente":   datos.edad_paciente,
            "enfermedad":      datos.enfermedad,
            "id_cuidador":     datos.id_cuidador,
            "id_dispositivo":  datos.id_dispositivo,
            "ultima_ubicacion": None,
            "ultima_señal": None,
            "estado_dispositivo": None,
            "created_at": datetime.utcnow(),
            "activo": True
        })

        await col_cuidadores.update_one(
            {"_id": ObjectId(datos.id_cuidador)},
            {"$push": {"patient_ids": str(resultado.inserted_id)}}
        )

        Logger.add_to_log("info", f"Paciente registrado: {datos.nombre_paciente}")
        return {"mensaje": "Paciente registrado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al registrar paciente: {ex}")
        return {"error": f"No se pudo registrar el paciente: {ex}"}

async def borrar_paciente(patient_id: str):
    try:
        paciente = await coleccion.find_one({"_id": ObjectId(patient_id)})

        if not paciente:
            Logger.add_to_log("warn", f"Paciente no encontrado para eliminar: {patient_id}")
            return {"mensaje": "No se encontró el paciente"}

        await coleccion.delete_one({"_id": ObjectId(patient_id)})

        await col_cuidadores.update_one(
            {"_id": ObjectId(paciente["id_cuidador"])},
            {"$pull": {"patient_ids": patient_id}}
        )

        Logger.add_to_log("info", f"Paciente eliminado: {patient_id}")
        return {"mensaje": "Paciente eliminado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al eliminar paciente: {ex}")
        return {"error": f"No se pudo eliminar el paciente: {ex}"}
    
async def actualizar_paciente(patient_id: str, datos: ActualizarPaciente):
    try:
        paciente = await coleccion.find_one({"_id": ObjectId(patient_id)})

        if not paciente:
            Logger.add_to_log("warn", f"Paciente no encontrado para actualizar: {patient_id}")
            return {"mensaje": "No se encontró el paciente"}

        campos = {}
        if datos.nombre_paciente:
            campos["nombre_paciente"] = datos.nombre_paciente
        if datos.edad_paciente is not None:
            campos["edad_paciente"] = datos.edad_paciente
        if datos.enfermedad:
            campos["enfermedad"] = datos.enfermedad
        if datos.id_dispositivo:
            campos["id_dispositivo"] = datos.id_dispositivo

        if campos:
            await coleccion.update_one({"_id": ObjectId(patient_id)}, {"$set": campos})
            Logger.add_to_log("info", f"Paciente actualizado: {patient_id}")
            return {"mensaje": "Paciente actualizado exitosamente"}
        else:
            Logger.add_to_log("warn", f"No se proporcionaron campos para actualizar paciente: {patient_id}")
            return {"mensaje": "No se proporcionaron campos para actualizar"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al actualizar paciente: {ex}")
        return {"error": f"No se pudo actualizar el paciente: {ex}"}

async def guardar_ubicacion(datos: ActaulizarUbicacion):
    try:
        paciente = await coleccion.find_one({"_id": ObjectId(datos.patient_id)})

        if not paciente:
            Logger.add_to_log("warn", f"Paciente no encontrado para guardar ubicación: {datos.patient_id}")
            return {"mensaje": "No se encontró el paciente"}

        ubicacion = {
            "patient_id": datos.patient_id,
            "latitude": datos.latitude,
            "longitude": datos.longitude,
            "device_id": datos.device_id,
            "recorded_at": datos.recorded_at
        }

        await col_ubicaciones.insert_one(ubicacion)

        await coleccion.update_one(
            {"_id": ObjectId(datos.patient_id)},
            {
                "$set": {
                    "ultima_ubicacion": {"latitude": datos.latitude, "longitude": datos.longitude},
                    "ultima_señal": None,
                    "estado_dispositivo": None
                }
            }
        )

        Logger.add_to_log("info", f"Ubicación guardada para paciente: {datos.patient_id}")
        return {"mensaje": "Ubicación actualizada exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al guardar ubicación: {ex}")
        return {"error": f"No se pudo actualizar la ubicación: {ex}"}