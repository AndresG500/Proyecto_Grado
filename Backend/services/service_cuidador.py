from database.database import get_database
from models.model_cuidador import CrearCuidador, ActualizarCuidador
from datetime import datetime
import asyncio
import bcrypt
from utils.Logger import Logger
from security.jwt_handler import crear_token

BCRYPT_ROUNDS = 12
AUTH_DELAY = 0.2


async def registrar_cuidador(datos: CrearCuidador):
    try:
        coleccion = get_database()["Cuidadores"]

        if await coleccion.find_one({"email": datos.email}):
            Logger.add_to_log("warn", f"Correo ya registrado: {datos.email}")
            return {"mensaje": "Este correo ya ha sido registrado"}

        if datos.phone and await coleccion.find_one({"phone": datos.phone}):
            Logger.add_to_log("warn", f"Teléfono ya registrado: {datos.phone}")
            return {"mensaje": "Este teléfono ya ha sido registrado"}

        hashed = bcrypt.hashpw(datos.password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")

        await coleccion.insert_one({
            "name":    datos.name,
            "email":   datos.email,
            "password": hashed,
            "phone":  datos.phone,
            "patient_ids": [],
            "activo": True,
            "fecha_creacion": datetime.utcnow(),
        })

        Logger.add_to_log("info", f"Cuidador registrado")
        return {"mensaje": "Cuidador registrado exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al registrar cuidador: {ex}")
        return {"error": f"No se pudo registrar el cuidador: {ex}"}


async def borrar_cuidador(email: str, email_solicitante: str):
    try:
        if email != email_solicitante:
            Logger.add_to_log("warn", f"Intento de eliminación no autorizado: {email_solicitante} tried to delete {email}")
            return {"error": "No tienes permiso para eliminar esta cuenta"}

        coleccion = get_database()["Cuidadores"]
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


async def actualizar_cuidador(email: str, datos: ActualizarCuidador, email_solicitante: str):
    try:
        if email != email_solicitante:
            Logger.add_to_log("warn", f"Intento de actualización no autorizado: {email_solicitante} tried to update {email}")
            return {"error": "No tienes permiso para actualizar esta cuenta"}

        coleccion = get_database()["Cuidadores"]
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
                datos.password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
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
        db = get_database()
        coleccion = db["Cuidadores"]
        cuidador = await coleccion.find_one({"email": email})
        dummy_hash = bcrypt.hashpw(b"dummy_password", bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
        stored_hash = cuidador["password"].encode("utf-8") if cuidador else dummy_hash

        es_valida = bcrypt.checkpw(password.encode("utf-8"), stored_hash)

        await asyncio.sleep(AUTH_DELAY)

        if not cuidador or not es_valida:
            Logger.add_to_log("warn", f"Verificación fallida: {email}")
            return {"mensaje": "Credenciales inválidas"}

        if not cuidador.get("is_active", True):
            Logger.add_to_log("warn", f"Intento de login en cuenta inactiva: {email}")
            return {"mensaje": "Credenciales inválidas"}

        token = crear_token({"sub": cuidador["email"]})

        Logger.add_to_log("info", f"Verificación exitosa: {email}")
        return {
            "access_token": token,
            "token_type": "bearer",
        }

    except Exception as ex:
        Logger.add_to_log("error", f"Error al verificar cuidador: {ex}")
        await asyncio.sleep(AUTH_DELAY)
        return {"mensaje": "Credenciales inválidas"}