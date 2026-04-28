from datetime import datetime, timedelta
from math import radians, sin, cos, sqrt, atan2
from database.database import conexion_database
from models.model_historial import HistorialUbicacionBase
from utils.Logger import Logger

DISTANCIA_MINIMA_METROS = 10
DIAS_HISTORIAL = 7


def calcular_distancia(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000  # Radio de la tierra en metros
    lat1, lat2, dlat, dlng = map(radians, [lat1, lat2, lat2 - lat1, lng2 - lng1])
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


async def registrar_ubicacion(datos: HistorialUbicacionBase):
    try:
        coleccion = conexion_database()["Historial"]

        ultima = await coleccion.find_one(
            {"paciente_id": datos.paciente_id},
            sort=[("timestamp", -1)]
        )

        if ultima:
            distancia = calcular_distancia(
                ultima["coordenadas"]["latitud"],
                ultima["coordenadas"]["longitud"],
                datos.coordenadas.latitud,
                datos.coordenadas.longitud
            )
            if distancia < DISTANCIA_MINIMA_METROS:
                Logger.add_to_log("info", f"Ubicación descartada por distancia mínima: {datos.paciente_id}")
                return {"mensaje": "Ubicación descartada, el paciente no se ha movido lo suficiente"}

        await coleccion.insert_one({
            "paciente_id": datos.paciente_id,
            "dispositivo_id": datos.dispositivo_id,
            "coordenadas": datos.coordenadas.model_dump(),
            "timestamp": datetime.utcnow()
        })

        Logger.add_to_log("info", f"Ubicación registrada para paciente: {datos.paciente_id}")
        return {"mensaje": "Ubicación registrada exitosamente"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al registrar ubicación: {ex}")
        return {"error": f"No se pudo registrar la ubicación: {ex}"}


async def obtener_ultima_ubicacion(paciente_id: str) -> dict | None:
    try:
        coleccion = conexion_database()["Historial"]

        ultima = await coleccion.find_one(
            {"paciente_id": paciente_id},
            sort=[("timestamp", -1)]
        )

        if not ultima:
            Logger.add_to_log("warn", f"Sin ubicaciones para paciente: {paciente_id}")
            return {"mensaje": "No se encontraron ubicaciones para este paciente"}

        ultima["id"] = str(ultima["_id"])
        del ultima["_id"]
        return ultima

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener última ubicación: {ex}")
        return {"error": f"No se pudo obtener la última ubicación: {ex}"}


async def obtener_historial_ubicaciones(paciente_id: str) -> list:
    try:
        coleccion = conexion_database()["Historial"]
        corte = datetime.utcnow() - timedelta(days=DIAS_HISTORIAL)

        cursor = coleccion.find(
            {"paciente_id": paciente_id, "timestamp": {"$gte": corte}},
            sort=[("timestamp", 1)]
        )

        historial = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
            historial.append(doc)

        if not historial:
            Logger.add_to_log("warn", f"Sin historial para paciente: {paciente_id}")
            return {"mensaje": "No se encontró historial para este paciente"}

        Logger.add_to_log("info", f"Historial obtenido para paciente: {paciente_id}")
        return historial

    except Exception as ex:
        Logger.add_to_log("error", f"Error al obtener historial: {ex}")
        return {"error": f"No se pudo obtener el historial: {ex}"}


async def eliminar_historial_paciente(paciente_id: str):
    try:
        coleccion = conexion_database()["Historial"]

        resultado = await coleccion.delete_many({"paciente_id": paciente_id})

        if resultado.deleted_count == 0:
            Logger.add_to_log("warn", f"Sin historial para eliminar: {paciente_id}")
            return {"mensaje": "No se encontró historial para eliminar"}

        Logger.add_to_log("info", f"Historial eliminado para paciente: {paciente_id}")
        return {"mensaje": f"Historial eliminado exitosamente ({resultado.deleted_count} registros)"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al eliminar historial: {ex}")
        return {"error": f"No se pudo eliminar el historial: {ex}"}