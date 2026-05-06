from datetime import datetime, timedelta
from database.database import get_database
from models.model_alertas import CrearAlerta, EstadoAlerta
from bson import ObjectId
from utils.Logger import Logger

INTERVALO_NOTIF_MINUTOS = 1


# ─── FCM ────────────────────────────────────────────────────────────────────
# TODO mañana: inicializar firebase_admin con serviceAccountKey.json
# e implementar el envío real

async def enviar_notificacion_fcm(tokens: list[str], titulo: str, cuerpo: str):
    """
    Placeholder — mañana se rellena con firebase_admin.messaging
    tokens: lista de FCM tokens de los cuidadores del grupo
    """
    Logger.add_to_log("info", f"[FCM placeholder] '{titulo}' → {len(tokens)} cuidadores")
    pass


# ─── Helpers ────────────────────────────────────────────────────────────────

async def obtener_tokens_grupo(grupo_id: str) -> list[str]:
    """
    Obtiene los FCM tokens de todos los cuidadores del grupo.
    TODO mañana: agregar campo fcm_token al modelo y colección Cuidadores.
    """
    db             = get_database()
    col_grupos     = db["Grupos"]
    col_cuidadores = db["Cuidadores"]

    grupo = await col_grupos.find_one({"_id": ObjectId(grupo_id)})
    if not grupo:
        return []

    tokens = []
    async for cuidador in col_cuidadores.find(
        {"_id": {"$in": [ObjectId(c) for c in grupo["cuidador_ids"]]}},
        {"fcm_token": 1}
    ):
        if cuidador.get("fcm_token"):
            tokens.append(cuidador["fcm_token"])

    return tokens


# ─── Lógica principal ───────────────────────────────────────────────────────

async def crear_alerta(datos: CrearAlerta):
    try:
        db         = get_database()
        col_alertas = db["Alertas"]
        col_pacientes = db["Pacientes"]

        # Verificar que no haya una alerta activa para este paciente
        alerta_existente = await col_alertas.find_one({
            "paciente_id": datos.paciente_id,
            "estado":      EstadoAlerta.ACTIVA
        })
        if alerta_existente:
            Logger.add_to_log("warn", f"Ya existe alerta activa para paciente: {datos.paciente_id}")
            return {"mensaje": "Ya existe una alerta activa para este paciente"}

        paciente = await col_pacientes.find_one({"_id": ObjectId(datos.paciente_id)})
        if not paciente:
            Logger.add_to_log("warn", f"Paciente no encontrado: {datos.paciente_id}")
            return {"mensaje": "No se encontró el paciente"}

        ahora = datetime.utcnow()

        resultado = await col_alertas.insert_one({
            "paciente_id":  datos.paciente_id,
            "grupo_id":     datos.grupo_id,
            "coordenadas":  datos.coordenadas,
            "zona_nombre":  datos.zona_nombre,
            "estado":       EstadoAlerta.ACTIVA,
            "atendida_por": None,
            "created_at":   ahora,
            "ultima_notif": ahora
        })

        # Enviar notificación inicial
        tokens = await obtener_tokens_grupo(datos.grupo_id)
        await enviar_notificacion_fcm(
            tokens,
            titulo=f"⚠️ {paciente['nombre_paciente']} salió de la zona segura",
            cuerpo=f"Ubicación: {datos.coordenadas['latitud']}, {datos.coordenadas['longitud']}"
        )

        Logger.add_to_log("info", f"Alerta creada para paciente: {datos.paciente_id}")
        return {"mensaje": "Alerta creada y cuidadores notificados", "alerta_id": str(resultado.inserted_id)}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al crear alerta: {ex}")
        return {"error": f"No se pudo crear la alerta: {ex}"}


async def atender_alerta(alerta_id: str, cuidador_id: str):
    try:
        db          = get_database()
        col_alertas = db["Alertas"]

        alerta = await col_alertas.find_one({"_id": ObjectId(alerta_id)})
        if not alerta:
            Logger.add_to_log("warn", f"Alerta no encontrada: {alerta_id}")
            return {"mensaje": "No se encontró la alerta"}

        if alerta["estado"] != EstadoAlerta.ACTIVA:
            Logger.add_to_log("warn", f"Alerta ya no está activa: {alerta_id}")
            return {"mensaje": "Esta alerta ya fue atendida o resuelta"}

        await col_alertas.update_one(
            {"_id": ObjectId(alerta_id)},
            {"$set": {
                "estado":       EstadoAlerta.ATENDIDA,
                "atendida_por": cuidador_id
            }}
        )

        Logger.add_to_log("info", f"Alerta {alerta_id} atendida por cuidador {cuidador_id}")
        return {"mensaje": "Alerta marcada como atendida"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al atender alerta: {ex}")
        return {"error": f"No se pudo atender la alerta: {ex}"}


async def resolver_alerta(paciente_id: str):
    """
    Se llama automáticamente cuando el paciente vuelve a la zona segura.
    """
    try:
        db          = get_database()
        col_alertas = db["Alertas"]

        alerta = await col_alertas.find_one({
            "paciente_id": paciente_id,
            "estado":      {"$in": [EstadoAlerta.ACTIVA, EstadoAlerta.ATENDIDA]}
        })

        if not alerta:
            return {"mensaje": "No hay alerta activa para este paciente"}

        await col_alertas.update_one(
            {"_id": alerta["_id"]},
            {"$set": {"estado": EstadoAlerta.RESUELTA}}
        )

        Logger.add_to_log("info", f"Alerta resuelta para paciente: {paciente_id}")
        return {"mensaje": "Alerta resuelta, el paciente volvió a la zona segura"}

    except Exception as ex:
        Logger.add_to_log("error", f"Error al resolver alerta: {ex}")
        return {"error": f"No se pudo resolver la alerta: {ex}"}


async def reenviar_alertas_activas():
    """
    Background task — se ejecuta cada 5 minutos.
    Busca alertas activas cuya ultima_notif tenga más de 5 minutos
    y reenvía la notificación FCM.
    """
    try:
        db          = get_database()
        col_alertas = db["Alertas"]
        col_pacientes = db["Pacientes"]

        corte = datetime.utcnow() - timedelta(minutes=INTERVALO_NOTIF_MINUTOS)

        cursor = col_alertas.find({
            "estado":      EstadoAlerta.ACTIVA,
            "ultima_notif": {"$lte": corte}
        })

        async for alerta in cursor:
            paciente = await col_pacientes.find_one({"_id": ObjectId(alerta["paciente_id"])})
            if not paciente:
                continue

            tokens = await obtener_tokens_grupo(alerta["grupo_id"])
            await enviar_notificacion_fcm(
                tokens,
                titulo=f"⚠️ {paciente['nombre_paciente']} sigue fuera de la zona segura",
                cuerpo=f"Ubicación: {alerta['coordenadas']['latitud']}, {alerta['coordenadas']['longitud']}"
            )

            await col_alertas.update_one(
                {"_id": alerta["_id"]},
                {"$set": {"ultima_notif": datetime.utcnow()}}
            )

            Logger.add_to_log("info", f"Alerta reenviada para paciente: {alerta['paciente_id']}")

    except Exception as ex:
        Logger.add_to_log("error", f"Error al reenviar alertas: {ex}")