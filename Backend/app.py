from fastapi import FastAPI
from routes.ruta_cliente import router as cuidador_router
from routes.ruta_paciente import router as paciente_router
from routes.ruta_dispositivo import router as dispositivo_router

app = FastAPI(
    title="UbiLife API",
    description="Backend para el sistema de rastreo GPS de pacientes con Alzheimer",
    version="1.0.0"
)

app.include_router(cuidador_router)
app.include_router(paciente_router)
app.include_router(dispositivo_router)


@app.get("/")
async def raiz():
    return {"mensaje": "UbiLife API corriendo"}