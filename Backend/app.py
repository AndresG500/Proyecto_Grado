from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import asyncio
import os
import sentry_sdk

from MQTT.subscriber import mqtt_subscriber_task
from database.database import close_database, get_database
from routes.ruta_cliente import router as cuidador_router
from routes.ruta_paciente import router as paciente_router
from routes.ruta_dispositivo import router as dispositivo_router
from routes.ruta_historial import router as historial_router
from routes.ruta_zonasegura import router as zona_segura_router
from routes.ruta_grupo import router as grupo_router
from routes.ruta_alerta import router as alerta_router
from routes.ruta_familiar import router as familiar_router
from routes.ruta_modo_viaje import router as modo_viaje_router
from services.service_alerta import reenviar_alertas_activas
from utils.Logger import Logger

_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=0.2)


rate_limit_store: dict[str, list] = {}
RATE_LIMIT = 120
RATE_WINDOW = 60


def get_client_ip(request: Request) -> str:
    return request.client.host


async def tarea_alertas():
    while True:
        await asyncio.sleep(300)  # 5 minutos
        await reenviar_alertas_activas()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_database()
    # TTL: borra tokens revocados automáticamente cuando expira el JWT
    await db["TokensRevocados"].create_index("exp", expireAfterSeconds=0)
    # TTL: borra ubicaciones de cuidadores si no se actualizan en 15 min
    await db["UbicacionesCuidadores"].create_index("timestamp", expireAfterSeconds=900)

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


_produccion = os.getenv("ENVIRONMENT") == "production"

app = FastAPI(
    title="UbiLife API",
    description="Backend para el sistema de rastreo GPS de pacientes con Alzheimer",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None  if _produccion else "/docs",
    redoc_url=None if _produccion else "/redoc",
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


@app.exception_handler(StarletteHTTPException)
async def handler_http(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 500:
        Logger.add_to_log("error", f"Error interno [{request.method} {request.url.path}]: {exc.detail}")
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def handler_excepcion_global(request: Request, exc: Exception):
    Logger.add_to_log("error", f"Excepción no manejada [{request.method} {request.url.path}]: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


app.include_router(cuidador_router)
app.include_router(paciente_router)
app.include_router(dispositivo_router)
app.include_router(historial_router)
app.include_router(zona_segura_router)
app.include_router(grupo_router)
app.include_router(alerta_router)
app.include_router(familiar_router)
app.include_router(modo_viaje_router)


@app.get("/")
async def raiz():
    return {"mensaje": "UbiLife API corriendo"}
