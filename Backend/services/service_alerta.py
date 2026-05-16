import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from bson import ObjectId
from FCM.client import enviar_notificacion_multicast
from utilidades.geo import distancia_metros
from utilidades.mongo_utils import to_object_id, to_str_id
from database.database import get_database

logger = logging.getLogger(__name__)

COOLDOWN_ALERTA_SEGUNDOS = 300  # 5 minutos


# ─────────────────────────────────────────────────────────────────────
# EVALUACIÓN DE GEOCERCAS
# ─────────────────────────────────────────────────────────────────────

async def evaluar_zonas_seguras(paciente_id, lat: float, lng: float) -> None:
    # BUG CORREGIDO: colecciones obtenidas dentro de la función (no al importar el módulo)
    db = get_database()
    coleccion_zonas_seguras = db["ZonasSeguras"]
    coleccion_pacientes     = db["Pacientes"]

    if isinstance(paciente_id, ObjectId):
        paciente_id_str = str(paciente_id)
    else:
        paciente_id_str = str(paciente_id)

    # BUG CORREGIDO: campo "activa": True en vez de "estado": "activa"
    zonas = await coleccion_zonas_seguras.find({
        "paciente_id": paciente_id_str,
        "activa": True,
    }).to_list(length=None)

    if not zonas:
        return

    dentro_de_alguna = False
    zona_mas_cercana = None
    distancia_minima = float("inf")

    for zona in zonas:
        # BUG CORREGIDO: zona["centro"]["latitud"] y zona["centro"]["longitud"]
        #                en vez de zona["latitud_centro"] / zona["longitud_centro"]
        # BUG CORREGIDO: zona["radio_metros"] en vez de zona["radio"]
        d = distancia_metros(
            lat, lng,
            zona["centro"]["latitud"],
            zona["centro"]["longitud"],
        )
        if d <= zona["radio_metros"]:
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

    estaba_fuera  = paciente.get("fuera_de_zona", False)
    ultima_alerta = paciente.get("ultima_alerta_timestamp")
    ahora         = datetime.now(timezone.utc)

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
                {"$set": {"fuera_de_zona": True, "ultima_alerta_timestamp": ahora}},
            )
        except Exception:
            await coleccion_pacientes.update_one(
                {"_id": paciente_id_str},
                {"$set": {"fuera_de_zona": True, "ultima_alerta_timestamp": ahora}},
            )
        return

    if ultima_alerta is not None and ultima_alerta.tzinfo is None:
        ultima_alerta = ultima_alerta.replace(tzinfo=timezone.utc)

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

async def crear_y_despachar_alerta(
    paciente: dict,
    zona_mas_cercana: Optional[dict],
    lat: float,
    lng: float,
    tipo: str,
    distancia: float,
) -> None:
    # BUG CORREGIDO: colecciones obtenidas dentro de la función
    db = get_database()
    coleccion_alertas    = db["Alertas"]
    coleccion_grupos     = db["Grupos"]
    coleccion_cuidadores = db["Cuidadores"]

    paciente_id = paciente["_id"]
    if isinstance(paciente_id, ObjectId):
        paciente_id_str = str(paciente_id)
    else:
        paciente_id_str = str(paciente_id)

    # BUG CORREGIDO: usa nombre_paciente (campo real del modelo)
    nombre_paciente = paciente.get("nombre_paciente", "El paciente")

    if tipo == "salida_zona_segura":
        titulo = "⚠️ Alerta UbiLife"
        cuerpo = f"{nombre_paciente} ha salido de su zona segura"
    else:
        titulo = f"⚠️ {nombre_paciente} sigue fuera de zona"
        cuerpo = f"Está a aproximadamente {int(distancia)} metros de la zona más cercana"

    ahora = datetime.now(timezone.utc)

    # BUG CORREGIDO: incluye paciente_nombre y zona_nombre para que el frontend pueda mostrarlos
    alerta_doc = {
        "paciente_id":             paciente_id_str,
        "paciente_nombre":         nombre_paciente,
        "zonasegura_id":           zona_mas_cercana["_id"] if zona_mas_cercana else None,
        "zona_nombre":             zona_mas_cercana.get("nombre") if zona_mas_cercana else None,
        "tipo":                    tipo,
        "latitud":                 lat,
        "longitud":                lng,
        "timestamp":               ahora,
        "estado":                  "pendiente",
        "mensaje":                 cuerpo,
        "cuidadores_notificados":  [],
        "fcm_exitos":              0,
        "fcm_fallos":              0,
        "ultima_notif":            ahora,
    }
    result    = await coleccion_alertas.insert_one(alerta_doc)
    alerta_id = result.inserted_id

    # BUG CORREGIDO: usa paciente_ids (array) en vez de paciente_id (singular)
    grupos = await coleccion_grupos.find({"paciente_ids": paciente_id_str}).to_list(length=None)
    if not grupos:
        logger.warning("Paciente %s sin cuidadores asignados", paciente_id_str)
        await coleccion_alertas.update_one(
            {"_id": alerta_id}, {"$set": {"estado": "fallida"}}
        )
        return

    cuidador_ids = []
    for g in grupos:
        # BUG CORREGIDO: usa cuidador_ids (array) en vez de cuidador_id (singular)
        cuidador_ids.extend(g.get("cuidador_ids", []))

    cuidador_ids_unicos = list(set(cuidador_ids))

    cuidadores = await coleccion_cuidadores.find(
        {"_id": {"$in": [
            ObjectId(cid) if isinstance(cid, str) and len(cid) == 24 else cid
            for cid in cuidador_ids_unicos
        ]}}
    ).to_list(length=None)

    tokens = []
    cuidador_ids_con_token = []
    for c in cuidadores:
        token = c.get("fcm_token")
        if token:
            tokens.append(token)
            cuidador_ids_con_token.append(to_str_id(c["_id"]))

    if not tokens:
        logger.warning(
            "Ningún cuidador del paciente %s tiene fcm_token registrado", paciente_id_str
        )
        await coleccion_alertas.update_one(
            {"_id": alerta_id}, {"$set": {"estado": "fallida"}}
        )
        return

    resultado = await enviar_notificacion_multicast(
        tokens=tokens,
        titulo=titulo,
        cuerpo=cuerpo,
        data={
            "tipo":        tipo,
            "alerta_id":   str(alerta_id),
            "paciente_id": paciente_id_str,
            "lat":         lat,
            "lng":         lng,
        },
    )

    estado_final = "enviada" if resultado["exitos"] > 0 else "fallida"
    await coleccion_alertas.update_one(
        {"_id": alerta_id},
        {"$set": {
            "estado":                 estado_final,
            "cuidadores_notificados": cuidador_ids_con_token,
            "fcm_exitos":             resultado["exitos"],
            "fcm_fallos":             resultado["fallos"],
        }},
    )

    logger.info(
        "Alerta %s | tipo=%s | paciente=%s | cuidadores=%d | FCM exitos=%d fallos=%d",
        str(alerta_id), tipo, paciente_id_str, len(tokens),
        resultado["exitos"], resultado["fallos"],
    )

    if resultado["tokens_invalidos"]:
        await coleccion_cuidadores.update_many(
            {"fcm_token": {"$in": resultado["tokens_invalidos"]}},
            {"$unset": {"fcm_token": ""}},
        )
        logger.info("Limpiados %d tokens FCM inválidos", len(resultado["tokens_invalidos"]))


# ─────────────────────────────────────────────────────────────────────
# OPERACIONES PARA EL ROUTER HTTP
# ─────────────────────────────────────────────────────────────────────

async def listar_alertas_familiar(familiar_id: str) -> list[dict]:
    db = get_database()
    grupos = await db["Grupos"].find({"familiar_ids": familiar_id}).to_list(length=None)
    if not grupos:
        return []
    paciente_ids: list[str] = []
    for g in grupos:
        paciente_ids.extend(g.get("paciente_ids", []))
    if not paciente_ids:
        return []
    alertas = await db["Alertas"].find(
        {"paciente_id": {"$in": paciente_ids}}
    ).sort("timestamp", -1).to_list(length=None)
    for a in alertas:
        a["id"] = str(a["_id"])
        del a["_id"]
        a["paciente_id"]  = str(a.get("paciente_id", ""))
        if a.get("zonasegura_id"):
            a["zonasegura_id"] = str(a["zonasegura_id"])
        a["cuidadores_notificados"] = [str(c) for c in a.get("cuidadores_notificados", [])]
    return alertas


async def _paciente_ids_del_cuidador(cuidador_id: str) -> list[str]:
    db     = get_database()
    grupos = await db["Grupos"].find({"cuidador_ids": cuidador_id}).to_list(length=None)
    ids: list[str] = []
    for g in grupos:
        ids.extend(g.get("paciente_ids", []))
    return list(set(ids))


async def listar_alertas(cuidador_id: str, paciente_id: Optional[str] = None) -> list[dict]:
    db            = get_database()
    paciente_ids  = await _paciente_ids_del_cuidador(cuidador_id)
    query: dict   = {"paciente_id": {"$in": paciente_ids}}
    if paciente_id:
        pid = to_str_id(paciente_id)
        if pid not in paciente_ids:
            return []
        query["paciente_id"] = pid
    return await db["Alertas"].find(query).sort("timestamp", -1).to_list(length=None)


async def obtener_alerta(alerta_id: str, cuidador_id: str) -> Optional[dict]:
    db     = get_database()
    alerta = await db["Alertas"].find_one({"_id": ObjectId(alerta_id)})
    if not alerta:
        return None
    paciente_ids = await _paciente_ids_del_cuidador(cuidador_id)
    if str(alerta.get("paciente_id")) not in paciente_ids:
        return None
    return alerta


async def actualizar_estado(alerta_id: str, nuevo_estado: str, cuidador_id: str) -> Optional[dict]:
    alerta = await obtener_alerta(alerta_id, cuidador_id)
    if not alerta:
        return None
    db = get_database()
    await db["Alertas"].update_one(
        {"_id": ObjectId(alerta_id)},
        {"$set": {"estado": nuevo_estado}},
    )
    return await obtener_alerta(alerta_id, cuidador_id)


# ─────────────────────────────────────────────────────────────────────
# TAREA PERIÓDICA DE REENVÍO
# ─────────────────────────────────────────────────────────────────────

async def reenviar_alertas_activas() -> dict:
    try:
        db = get_database()
        coleccion_alertas    = db["Alertas"]
        coleccion_pacientes  = db["Pacientes"]
        coleccion_grupos     = db["Grupos"]
        coleccion_cuidadores = db["Cuidadores"]

        ahora  = datetime.now(timezone.utc)
        cutoff = ahora - timedelta(seconds=COOLDOWN_ALERTA_SEGUNDOS)

        alertas_activas = await coleccion_alertas.find({
            "estado":      "enviada",
            "ultima_notif": {"$lt": cutoff},
        }).to_list(length=None)

        if not alertas_activas:
            logger.info("No hay alertas activas pendientes de reenvío")
            return {"mensaje": "Sin alertas pendientes"}

        logger.info("Encontradas %d alertas activas para reenviar", len(alertas_activas))

        for alerta in alertas_activas:
            paciente_id = alerta.get("paciente_id")
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

            grupos = await coleccion_grupos.find(
                {"paciente_ids": paciente_id_str}
            ).to_list(length=None)
            if not grupos:
                continue

            cuidador_ids = []
            for g in grupos:
                cuidador_ids.extend(g.get("cuidador_ids", []))

            object_ids = []
            for cid in set(cuidador_ids):
                try:
                    object_ids.append(
                        ObjectId(cid) if isinstance(cid, str) and len(cid) == 24 else cid
                    )
                except Exception:
                    pass

            if not object_ids:
                continue

            cuidadores = await coleccion_cuidadores.find(
                {"_id": {"$in": object_ids}}
            ).to_list(length=None)

            tokens = [c.get("fcm_token") for c in cuidadores if c.get("fcm_token")]
            if not tokens:
                continue

            resultado = await enviar_notificacion_multicast(
                tokens=tokens,
                titulo=f"⚠️ Recordatorio: {nombre_paciente} sigue fuera de zona",
                cuerpo="El paciente sigue fuera de su zona segura.",
                data={
                    "tipo":        "alerta_periodica",
                    "alerta_id":   str(alerta["_id"]),
                    "paciente_id": paciente_id_str,
                    "lat":         str(lat),
                    "lng":         str(lng),
                },
            )

            await coleccion_alertas.update_one(
                {"_id": alerta["_id"]},
                {"$set": {"ultima_notif": ahora}},
            )

            logger.info(
                "Alerta %s reenviada a %d cuidadores", alerta["_id"], resultado["exitos"]
            )

        return {"mensaje": f"Se procesaron {len(alertas_activas)} alertas"}

    except Exception as ex:
        logger.error("Error en reenviar_alertas_activas: %s", ex)
        return {"error": str(ex)}