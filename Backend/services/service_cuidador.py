from database.database import conexion_database
from models.model_cuidador import CrearCuidador, ActualizarCuidador
from datetime import datetime
import bcrypt
from utils.Logger import Logger


async def registrar_cuidador(datos: CrearCuidador):
    try:
        coleccion = conexion_database()["Cuidadores"]

        if await coleccion.find_one({"email": datos.email}):
            Logger.add_to_log("warn", f"Correo ya registrado: {datos.email}")
            return {"mensaje": "Este correo ya ha sido registrado"}

        if datos.phone and await coleccion.find_one({"phone": datos.phone}):
            Logger.add_to_log("warn", f"Teléfono ya registrado: {datos.phone}")
            return {"mensaje": "Este teléfono ya ha sido registrado"}

        hashed = bcrypt.hashpw(datos.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        await coleccion.insert_one({
            "name":        datos.name,
            "email":       datos.email,
            "password":    hashed,
            "phone":       datos.phone,
            "patient_ids": [],
            "is_active":   True,
            "created_at":  datetime.utcnow(),
        })

        Logger.add_to_log("info", f"Cuidador registrado")
        return {"mensaje": "Cuidador registrado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al registrar cuidador: {ex}")
        return {"error": f"No se pudo registrar el cuidador: {ex}"}


async def borrar_cuidador(email: str):
    try:
        coleccion = conexion_database()["Cuidadores"]
        cuidador = await coleccion.find_one({"email": email})

        if not cuidador:
            Logger.add_to_log("warn", f"Cuidador no encontrado para eliminar: {email}")
            return {"mensaje": "No se encontró la cuenta"}

        await coleccion.delete_one({"email": email})
        Logger.add_to_log("info", f"Cuidador eliminado: {email}")
        return {"mensaje": "Cuenta eliminada exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al eliminar cuidador: {ex}")
        return {"error": f"No se pudo eliminar el cuidador: {ex}"}


async def actualizar_cuidador(email: str, datos: ActualizarCuidador):
    try:
        coleccion = conexion_database()["Cuidadores"]
        cuidador = await coleccion.find_one({"email": email})

        if not cuidador:
            Logger.add_to_log("warn", f"Cuidador no encontrado para actualizar: {email}")
            return {"mensaje": "No se encontró la cuenta"}

        campos = {}
        if datos.name:
            campos["name"] = datos.name
        if datos.phone:
            campos["phone"] = datos.phone
        if datos.password:
            campos["password"] = bcrypt.hashpw(
                datos.password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

        if not campos:
            Logger.add_to_log("warn", f"No se enviaron campos para actualizar: {email}")
            return {"mensaje": "No se enviaron campos para actualizar"}

        await coleccion.update_one({"email": email}, {"$set": campos})
        Logger.add_to_log("info", f"Cuidador actualizado: {email}")
        return {"mensaje": "Cuenta actualizada exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al actualizar cuidador: {ex}")
        return {"error": f"No se pudo actualizar el cuidador: {ex}"}


async def verificar_cuidador(email: str, password: str):
    try:
        coleccion = conexion_database()["Cuidadores"]
        cuidador = await coleccion.find_one({"email": email})

        if not cuidador:
            Logger.add_to_log("warn", f"Verificación fallida - cuidador no encontrado: {email}")
            return {"mensaje": "Acceso denegado"}

        if bcrypt.checkpw(password.encode("utf-8"), cuidador["password"].encode("utf-8")):
            Logger.add_to_log("info", f"Verificación exitosa: {email}")
            return {"mensaje": "Acceso permitido"}

        Logger.add_to_log("warn", f"Verificación fallida - contraseña incorrecta: {email}")
        return {"mensaje": "Acceso denegado"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al verificar cuidador: {ex}")
        return {"error": f"No se pudo verificar el cuidador: {ex}"}