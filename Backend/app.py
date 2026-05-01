from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

from database.database import close_database, get_database
from routes.ruta_cliente import router as cuidador_router
from routes.ruta_paciente import router as paciente_router
from routes.ruta_dispositivo import router as dispositivo_router
from routes.ruta_historial import router as historial_router
from routes.ruta_zonasegura import router as zona_segura_router
from routes.ruta_grupo import router as grupo_router


rate_limit_store = defaultdict(list)
RATE_LIMIT = 30
RATE_WINDOW = 60


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_database()
    yield
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
    
    rate_limit_store[client_ip] = [
        ts for ts in rate_limit_store[client_ip]
        if now - ts < timedelta(seconds=RATE_WINDOW)
    ]
    
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."}
        )
    
    rate_limit_store[client_ip].append(now)
    
    response = await call_next(request)
    return response


app.include_router(cuidador_router)
app.include_router(paciente_router)
app.include_router(dispositivo_router)
app.include_router(historial_router)
app.include_router(zona_segura_router)
app.include_router(grupo_router)

@app.get("/")
async def raiz():
    return {"mensaje": "UbiLife API corriendo"}