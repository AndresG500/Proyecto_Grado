import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from bson import ObjectId
from FCM.client import enviar_notificacion_multicast
from utilidades.geo import distancia_metros
from utilidades.mongo_utils import to_object_id, to_str_id
from database.database import get_database

logger = logging.getLogger(__name__)

COOLDOWN_ALERTA_SEGUNDOS = 300  # 5 minutos

coleccion_zonas_seguras = get_database()["ZonasSeguras"]
coleccion_pacientes = get_database()["Pacientes"]
coleccion_alertas = get_database()["Alertas"]
coleccion_grupos = get_database()["Grupos"]
coleccion_cuidadores = get_database()["Cuidadores"]


# ─────────────────────────────────────────────────────────────────────
# EVALUACIÓN DE GEOCERCAS
# ─────────────────────────────────────────────────────────────────────

async def evaluar_zonas_seguras(paciente_id, lat: float, lng: float) -> None:
    if isinstance(paciente_id, ObjectId):
        paciente_id_str = str(paciente_id)
    else:
        paciente_id_str = str(paciente_id)

    zonas = await coleccion_zonas_seguras.find({
        "paciente_id": paciente_id_str,
        "estado": "activa",
    }).to_list(length=None)

    if not zonas:
        return

    dentro_de_alguna = False
    zona_mas_cercana = None
    distancia_minima = float("inf")

    for zona in zonas:
        d = distancia_metros(
            lat, lng,
            zona["latitud_centro"], zona["longitud_centro"],
        )
        if d <= zona["radio"]:
            dentro_de_alguna = True
            break
        if d < distancia_minima:
            distancia_minima = d
            zona_mas_cercana = zona

    try:
        paciente = await coleccion_pacientes.find_one({"_id": ObjectId(paciente_id_str)})
    except Exception:
        paciente = await coleccion_pacientes.find_one({"_id": paciente_id_str})

    if not paciente:
        logger.warning("Paciente %s no encontrado al evaluar zonas", paciente_id_str)
        return

    estaba_fuera = paciente.get("fuera_de_zona", False)
    ultima_alerta = paciente.get("ultima_alerta_timestamp")
    ahora = datetime.now(timezone.utc)

    if dentro_de_alguna:
        if estaba_fuera:
            try:
                await coleccion_pacientes.update_one(
                    {"_id": ObjectId(paciente_id_str)},
                    {"$set": {"fuera_de_zona": False}},
                )
            except Exception:
                await coleccion_pacientes.update_one(
                    {"_id": paciente_id_str},
                    {"$set": {"fuera_de_zona": False}},
                )
            logger.info("Paciente %s volvió a zona segura", paciente_id_str)
        return

    if not estaba_fuera:
        await crear_y_despachar_alerta(
            paciente=paciente,
            zona_mas_cercana=zona_mas_cercana,
            lat=lat,
            lng=lng,
            tipo="salida_zona_segura",
            distancia=distancia_minima,
        )
        try:
            await coleccion_pacientes.update_one(
                {"_id": ObjectId(paciente_id_str)},
                {"$set": {
                    "fuera_de_zona": True,
                    "ultima_alerta_timestamp": ahora,
                }},
            )
        except Exception:
            await coleccion_pacientes.update_one(
                {"_id": paciente_id_str},
                {"$set": {
                    "fuera_de_zona": True,
                    "ultima_alerta_timestamp": ahora,
                }},
            )
        return

    if (ultima_alerta is None or
            (ahora - ultima_alerta).total_seconds() >= COOLDOWN_ALERTA_SEGUNDOS):
        await crear_y_despachar_alerta(
            paciente=paciente,
            zona_mas_cercana=zona_mas_cercana,
            lat=lat,
            lng=lng,
            tipo="alerta_periodica",
            distancia=distancia_minima,
        )
        try:
            await coleccion_pacientes.update_one(
                {"_id": ObjectId(paciente_id_str)},
                {"$set": {"ultima_alerta_timestamp": ahora}},
            )
        except Exception:
            await coleccion_pacientes.update_one(
                {"_id": paciente_id_str},
                {"$set": {"ultima_alerta_timestamp": ahora}},
            )


# ─────────────────────────────────────────────────────────────────────
# CREACIÓN Y DESPACHO DE ALERTAS
# ─────────────────────────────────────────────────────────────────────

async def crear_y_despachar_alerta(paciente: dict,zona_mas_cercana: Optional[dict],lat: float,lng: float,tipo: str,distancia: float,) -> None:

    paciente_id = paciente["_id"]
    if isinstance(paciente_id, ObjectId):
        paciente_id_str = str(paciente_id)
    else:
        paciente_id_str = str(paciente_id)

    nombre_paciente = paciente.get("nombre_paciente", paciente.get("nombre", "El paciente"))

    # 1. Construir mensaje según tipo de alerta
    if tipo == "salida_zona_segura":
        titulo = "⚠️ Alerta UbiLife"
        cuerpo = f"{nombre_paciente} ha salido de su zona segura"
    else:  # alerta_periodica
        titulo = f"⚠️ {nombre_paciente} sigue fuera de zona"
        cuerpo = f"Está a aproximadamente {int(distancia)} metros de la zona más cercana"

    # 2. Crear documento de alerta (estado inicial: pendiente)
    ahora = datetime.now(timezone.utc)
    alerta_doc = {
        "paciente_id": paciente_id_str,
        "zonasegura_id": zona_mas_cercana["_id"] if zona_mas_cercana else None,
        "tipo": tipo,
        "latitud": lat,
        "longitud": lng,
        "timestamp": ahora,
        "estado": "pendiente",
        "mensaje": cuerpo,
        "cuidadores_notificados": [],
        "fcm_exitos": 0,
        "fcm_fallos": 0,
        "ultima_notif": ahora,
    }
    result = await coleccion_alertas.insert_one(alerta_doc)
    alerta_id = result.inserted_id

    # 3. Buscar cuidadores del paciente vía colección grupo
    grupos = await coleccion_grupos.find({"paciente_ids": paciente_id_str}).to_list(length=None)
    if not grupos:
        logger.warning("Paciente %s sin cuidadores asignados", paciente_id_str)
        await coleccion_alertas.update_one(
            {"_id": alerta_id},
            {"$set": {"estado": "fallida"}},
        )
        return

    cuidador_ids = []
    for g in grupos:
        cuidador_ids.extend(g.get("cuidador_ids", []))

    cuidador_ids_unicos = list(set(cuidador_ids))

    cuidadores = await coleccion_cuidadores.find(
        {"_id": {"$in": [ObjectId(cid) if isinstance(cid, str) and len(cid) == 24 else cid for cid in cuidador_ids_unicos]}}
    ).to_list(length=None)

    # 4. Filtrar solo cuidadores con FCM token registrado
    tokens = []
    cuidador_ids_con_token = []
    for c in cuidadores:
        token = c.get("fcm_token")
        if token:
            tokens.append(token)
            cuidador_ids_con_token.append(to_str_id(c["_id"]))

    if not tokens:
        logger.warning(
            "Ningún cuidador del paciente %s tiene fcm_token registrado",
            paciente_id_str,
        )
        await coleccion_alertas.update_one(
            {"_id": alerta_id},
            {"$set": {"estado": "fallida"}},
        )
        return

    # 5. Enviar notificaciones FCM
    resultado = await enviar_notificacion_multicast(
        tokens=tokens,
        titulo=titulo,
        cuerpo=cuerpo,
        data={
            "tipo": tipo,
            "alerta_id": str(alerta_id),
            "paciente_id": paciente_id_str,
            "lat": lat,
            "lng": lng,
        },
    )

    # 6. Actualizar la alerta con el resultado
    estado_final = "enviada" if resultado["exitos"] > 0 else "fallida"
    await coleccion_alertas.update_one(
        {"_id": alerta_id},
        {"$set": {
            "estado": estado_final,
            "cuidadores_notificados": cuidador_ids_con_token,
            "fcm_exitos": resultado["exitos"],
            "fcm_fallos": resultado["fallos"],
        }},
    )

    logger.info(
        "Alerta %s | tipo=%s | paciente=%s | cuidadores=%d | "
        "FCM exitos=%d fallos=%d",
        str(alerta_id), tipo, paciente_id_str, len(tokens),
        resultado["exitos"], resultado["fallos"],
    )

    # 7. Limpiar tokens inválidos (opcional, robustez)
    if resultado["tokens_invalidos"]:
        await coleccion_cuidadores.update_many(
            {"fcm_token": {"$in": resultado["tokens_invalidos"]}},
            {"$unset": {"fcm_token": ""}},
        )
        logger.info(
            "Limpiados %d tokens FCM inválidos",
            len(resultado["tokens_invalidos"]),
        )


# ─────────────────────────────────────────────────────────────────────
# OPERACIONES PARA EL ROUTER HTTP
# ─────────────────────────────────────────────────────────────────────

async def listar_alertas(paciente_id: Optional[str] = None) -> list[dict]:
    """Lista las alertas, opcionalmente filtradas por paciente."""
    query = {}
    if paciente_id:
        query["paciente_id"] = to_str_id(paciente_id)
    cursor = coleccion_alertas.find(query).sort("timestamp", -1)
    return await cursor.to_list(length=None)


async def obtener_alerta(alerta_id: str) -> Optional[dict]:
    return await coleccion_alertas.find_one({"_id": ObjectId(alerta_id)})


async def actualizar_estado(alerta_id: str, nuevo_estado: str) -> Optional[dict]:
    await coleccion_alertas.update_one(
        {"_id": ObjectId(alerta_id)},
        {"$set": {"estado": nuevo_estado}},
    )
    return await obtener_alerta(alerta_id)


# ─────────────────────────────────────────────────────────────────────
# TAREA PERIÓDICA DE REENVÍO DE ALERTAS
# ─────────────────────────────────────────────────────────────────────


async def reenviar_alertas_activas() -> dict:
    """
    Reenvía notificaciones para alertas activas que ya pasaron el cooldown.
    Se ejecuta cada 5 minutos desde app.py.
    """
    try:
        ahora = datetime.now(timezone.utc)
        cutoff = ahora - timedelta(seconds=COOLDOWN_ALERTA_SEGUNDOS)

        alertas_activas = await coleccion_alertas.find({
            "estado": "enviada",
            "ultima_notif": {"$lt": cutoff},
        }).to_list(length=None)

        if not alertas_activas:
            logger.info("No hay alertas activas pendientes de reenvío")
            return {"mensaje": "Sin alertas pendientes"}

        logger.info(f"Encontradas {len(alertas_activas)} alertas activas para reenviar")

        for alerta in alertas_activas:
            paciente_id = alerta.get("paciente_id")

            if isinstance(paciente_id, ObjectId):
                paciente_id_str = str(paciente_id)
            else:
                paciente_id_str = str(paciente_id) if paciente_id else None

            if not paciente_id_str:
                continue

            try:
                paciente = await coleccion_pacientes.find_one({"_id": ObjectId(paciente_id_str)})
            except Exception:
                paciente = await coleccion_pacientes.find_one({"_id": paciente_id_str})

            if not paciente:
                continue

            nombre_paciente = paciente.get("nombre_paciente", "El paciente")
            lat = alerta.get("latitud", 0)
            lng = alerta.get("longitud", 0)

            grupos = await coleccion_grupos.find({"paciente_ids": paciente_id_str}).to_list(length=None)
            if not grupos:
                logger.warning("No se encontraron grupos para paciente %s", paciente_id_str)
                continue

            cuidador_ids = []
            for g in grupos:
                cuidador_ids.extend(g.get("cuidador_ids", []))

            cuidador_ids_unicos = list(set(cuidador_ids))

            if not cuidador_ids_unicos:
                continue

            object_ids = []
            for cid in cuidador_ids_unicos:
                try:
                    if isinstance(cid, str) and len(cid) == 24:
                        object_ids.append(ObjectId(cid))
                    elif isinstance(cid, ObjectId):
                        object_ids.append(cid)
                except Exception:
                    pass

            if not object_ids:
                continue

            cuidadores = await coleccion_cuidadores.find(
                {"_id": {"$in": object_ids}}
            ).to_list(length=None)

            tokens = [c.get("fcm_token") for c in cuidadores if c.get("fcm_token")]
            if not tokens:
                logger.warning("No hay tokens FCM para cuidadores del paciente %s", paciente_id_str)
                continue

            titulo = f"⚠️ Recordatorio: {nombre_paciente} sigue fuera de zona"
            cuerpo = f"El paciente sigue fuera de su zona segura. Última ubicación conocida."

            resultado = await enviar_notificacion_multicast(
                tokens=tokens,
                titulo=titulo,
                cuerpo=cuerpo,
                data={
                    "tipo": "alerta_periodica",
                    "alerta_id": str(alerta["_id"]),
                    "paciente_id": paciente_id_str,
                    "lat": str(lat),
                    "lng": str(lng),
                },
            )

            await coleccion_alertas.update_one(
                {"_id": alerta["_id"]},
                {"$set": {"ultima_notif": ahora}},
            )

            logger.info(f"Alerta {alerta['_id']} reenviada a {resultado['exitos']} cuidadores")

        return {"mensaje": f"Se procesaron {len(alertas_activas)} alertas"}

    except Exception as ex:
        logger.error(f"Error en reenviar_alertas_activas: {ex}")
        return {"error": str(ex)}