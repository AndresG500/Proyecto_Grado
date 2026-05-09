import asyncio
import json
import ssl
import aiomqtt
from MQTT.config import settings
from database.database import get_database
from models.model_historial import HistorialUbicacionBase, CoordenadasPaciente
from services.service_historial import registrar_ubicacion
from utils.Logger import Logger
from services.service_alerta import evaluar_zonas_seguras

TOPIC_PATRON = "ubilife/dispositivo/+/gps"


async def procesar_mensaje_gps(id_dispositivo: str, payload: dict) -> None:
    lat = payload.get("lat")
    lng = payload.get("lng", payload.get("lon"))

    if lat is None or lng is None:
        Logger.add_to_log("warn", f"Payload sin coordenadas válidas: {payload}")
        return

    db = get_database()
    dispositivo = await db["Dispositivos"].find_one({"id_dispositivo": id_dispositivo})
    if not dispositivo:
        Logger.add_to_log("warn", f"Dispositivo no registrado: {id_dispositivo}")
        return

    paciente_id = dispositivo.get("paciente_id")
    if not paciente_id:
        Logger.add_to_log("warn", f"Dispositivo {id_dispositivo} sin paciente asignado")
        return

    try:
        datos = HistorialUbicacionBase(
            paciente_id=str(paciente_id),
            dispositivo_id=id_dispositivo,
            coordenadas=CoordenadasPaciente(latitud=float(lat), longitud=float(lng)),
        )
    except Exception as ex:
        Logger.add_to_log("error", f"Coordenadas inválidas en payload MQTT: {ex}")
        return

    resultado = await registrar_ubicacion(datos)
    if isinstance(resultado, dict) and "error" in resultado:
        Logger.add_to_log("error", f"Fallo registrando ubicación MQTT: {resultado['error']}")
    if not (isinstance(resultado, dict) and "error" in resultado):
        try:
            await evaluar_zonas_seguras(str(paciente_id), float(lat), float(lng))
        except Exception as ex:
            Logger.add_to_log("error", f"Error evaluando zonas seguras: {ex}")
    else:
        Logger.add_to_log(
            "info",
            f"GPS guardado | dispositivo={id_dispositivo} paciente={paciente_id} lat={lat} lng={lng}",
        )


async def manejar_mensaje(message: aiomqtt.Message) -> None:
    topic = message.topic.value
    partes = topic.split("/")

    if len(partes) != 4 or partes[0] != "ubilife" or partes[3] != "gps":
        Logger.add_to_log("warn", f"Tópico con formato inesperado: {topic}")
        return

    id_dispositivo = partes[2]

    try:
        payload = json.loads(message.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        Logger.add_to_log("error", f"Payload no es JSON válido: {e}")
        return

    await procesar_mensaje_gps(id_dispositivo, payload)


async def mqtt_subscriber_task() -> None:
    tls_context = ssl.create_default_context()

    while True:
        try:
            Logger.add_to_log(
                "info",
                f"Conectando a MQTT ",
            )
            async with aiomqtt.Client(
                hostname=settings.MQTT_HOST,
                port=settings.MQTT_PORT,
                username=settings.MQTT_USER,
                password=settings.MQTT_PASS,
                tls_context=tls_context,
                identifier=settings.MQTT_CLIENT_ID,
                keepalive=60,
            ) as client:
                await client.subscribe(TOPIC_PATRON)
                Logger.add_to_log("info", f"Suscrito a {TOPIC_PATRON}")

                async for message in client.messages:
                    try:
                        await manejar_mensaje(message)
                    except Exception as ex:
                        Logger.add_to_log("error", f"Error procesando mensaje MQTT: {ex}")

        except aiomqtt.MqttError as e:
            Logger.add_to_log("warn", f"Conexión MQTT perdida: {e} — reintentando en 5s")
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            Logger.add_to_log("info", "Tarea MQTT cancelada (shutdown del backend)")
            raise
        except Exception as ex:
            Logger.add_to_log("error", f"Error inesperado en subscriber MQTT: {ex}")
            await asyncio.sleep(5)
