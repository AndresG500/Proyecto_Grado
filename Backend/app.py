from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import asyncio

from MQTT.subscriber import mqtt_subscriber_task
from database.database import close_database, get_database
from routes.ruta_cliente import router as cuidador_router
from routes.ruta_paciente import router as paciente_router
from routes.ruta_dispositivo import router as dispositivo_router
from routes.ruta_historial import router as historial_router
from routes.ruta_zonasegura import router as zona_segura_router
from routes.ruta_grupo import router as grupo_router
from routes.ruta_alerta import router as alerta_router
from services.service_alerta import reenviar_alertas_activas


rate_limit_store: dict[str, list] = {}
RATE_LIMIT = 30
RATE_WINDOW = 60


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


async def tarea_alertas():
    while True:
        await asyncio.sleep(300)  # 5 minutos
        await reenviar_alertas_activas()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_database()
    # TTL: borra tokens revocados automáticamente cuando expira el JWT
    await db["TokensRevocados"].create_index("exp", expireAfterSeconds=0)

    alertas_task = asyncio.create_task(tarea_alertas())
    mqtt_task = asyncio.create_task(mqtt_subscriber_task())

    yield

    for task in (alertas_task, mqtt_task):
        task.cancel()
    for task in (alertas_task, mqtt_task):
        try:
            await task
        except asyncio.CancelledError:
            pass

    await close_database()


app = FastAPI(
    title="UbiLife API",
    description="Backend para el sistema de rastreo GPS de pacientes con Alzheimer",
    version="1.0.0",
    lifespan=lifespan
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = get_client_ip(request)
    now = datetime.now()

    timestamps = [
        ts for ts in rate_limit_store.get(client_ip, [])
        if now - ts < timedelta(seconds=RATE_WINDOW)
    ]

    if len(timestamps) >= RATE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."}
        )

    timestamps.append(now)
    rate_limit_store[client_ip] = timestamps

    response = await call_next(request)
    return response


app.include_router(cuidador_router)
app.include_router(paciente_router)
app.include_router(dispositivo_router)
app.include_router(historial_router)
app.include_router(zona_segura_router)
app.include_router(grupo_router)
app.include_router(alerta_router)


@app.get("/")
async def raiz():
    return {"mensaje": "UbiLife API corriendo"}
