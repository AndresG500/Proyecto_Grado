from database.database import conexion_database
from models.model_cuidador import CrearCuidador, ActualizarCuidador
from datetime import datetime, timedelta, timezone
import bcrypt
import os
from jose import jwt
from utils.Logger import Logger

SECRET_KEY = os.getenv("JWT_SECRET", "ubilife_dev_secret_cambia_en_produccion")
ALGORITHM  = "HS256"
EXPIRE_HORAS = 24


async def registrar_cuidador(datos: CrearCuidador):
    try:
        coleccion = conexion_database()["Cuidadores"]

        if await coleccion.find_one({"email": datos.email}):
            Logger.add_to_log("warn", f"Correo ya registrado: {datos.email}")
            return {"duplicado": "Este correo ya ha sido registrado"}

        if datos.phone and await coleccion.find_one({"phone": datos.phone}):
            Logger.add_to_log("warn", f"Teléfono ya registrado: {datos.phone}")
            return {"duplicado": "Este teléfono ya ha sido registrado"}

        hashed = bcrypt.hashpw(datos.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        await coleccion.insert_one({
            "name":        datos.name,
            "email":       datos.email,
            "password":    hashed,
            "phone":       datos.phone,
            "patient_ids": [],
            "is_active":   True,
            "created_at":  datetime.now(timezone.utc),
        })

        Logger.add_to_log("info", f"Cuidador registrado: {datos.email}")
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
        if datos.nombre:
            campos["name"] = datos.nombre
        if datos.telefono:
            campos["phone"] = datos.telefono
        if datos.password:
            campos["password"] = bcrypt.hashpw(
                datos.password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

        if not campos:
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
            Logger.add_to_log("warn", f"Verificación fallida - no encontrado: {email}")
            return {"error": "Credenciales inválidas"}

        if not bcrypt.checkpw(password.encode("utf-8"), cuidador["password"].encode("utf-8")):
            Logger.add_to_log("warn", f"Verificación fallida - contraseña incorrecta: {email}")
            return {"error": "Credenciales inválidas"}

        expiracion = datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HORAS)
        token = jwt.encode(
            {"sub": email, "exp": expiracion},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

        Logger.add_to_log("info", f"Login exitoso: {email}")
        return {
            "token": token,
            "cuidador": {
                "id":    str(cuidador.get("_id", "")),
                "name":  cuidador.get("name", ""),
                "email": cuidador.get("email", ""),
                "phone": cuidador.get("phone", ""),
            },
        }

    except Exception as ex:
        Logger.add_to_log("error", f"Error al verificar cuidador: {ex}")
        return {"error": f"No se pudo verificar el cuidador: {ex}"}
