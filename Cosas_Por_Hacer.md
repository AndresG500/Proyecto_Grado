# Prompt para Claude Code — Verificación e Implementación UbiLife
# (Versión con código corregido incluido)

## Contexto del proyecto

Eres el asistente técnico del proyecto de grado **UbiLife**, una aplicación de rastreo GPS
para pacientes con Alzheimer desarrollada en la Universidad Cooperativa de Colombia sede Santa Marta.

El proyecto tiene dos carpetas principales:
- **Backend:** FastAPI + MongoDB Motor + MQTT (HiveMQ) + JWT + BCrypt. Carpeta `Backend/`
- **Frontend:** React Native + Expo Router + TypeScript. Carpeta `Fronted/`

Convenciones del proyecto:
- Todo el código está en español.
- Colecciones MongoDB en PascalCase: `Pacientes`, `Cuidadores`, `Dispositivos`,
  `DispositivosDisponibles`, `Historial`, `ZonasSeguras`, `Grupos`, `Alertas`, `TokensRevocados`.
- La base de datos se obtiene siempre con `get_database()` de `database.database`.
- El logger se usa con `Logger.add_to_log("info"|"warn"|"error", mensaje)`.

---

## Tu tarea

Para cada archivo listado a continuación:

1. Lee el archivo actual en disco.
2. Compara su contenido con el **código esperado** que se incluye en este documento.
3. Si el contenido es idéntico o equivalente, confírmalo con ✅ y pasa al siguiente.
4. Si hay diferencias, reemplaza el contenido del archivo con el código esperado.
5. Reporta el resultado: ✅ correcto / ⚠️ corregido (lista qué cambió) / ❌ error que requiere atención manual.

---

## BACKEND

---

### 1. `Backend/MQTT/subscriber.py`

**Bugs corregidos:**
- Dispositivos desconocidos van a `DispositivosDisponibles` (upsert), no a `Dispositivos`.
- Log de éxito solo aparece cuando el guardado fue exitoso.
- `ultima_conexion` se actualiza en `Dispositivos` cuando el dispositivo ya existe.

```python
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
from utils.eventos import bus_eventos
from datetime import datetime, timezone


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
        await db["DispositivosDisponibles"].update_one(
            {"id_dispositivo": id_dispositivo},
            {
                "$set": {
                    "id_dispositivo":        id_dispositivo,
                    "dispositivo_detectado": datetime.utcnow(),
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )
        Logger.add_to_log(
            "info",
            f"Dispositivo no vinculado, anunciado en DispositivosDisponibles: {id_dispositivo}",
        )
        return

    await db["Dispositivos"].update_one(
        {"id_dispositivo": id_dispositivo},
        {"$set": {"ultima_conexion": datetime.utcnow()}},
    )

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
        return

    Logger.add_to_log(
        "info",
        f"GPS guardado | dispositivo={id_dispositivo} paciente={paciente_id} lat={lat} lng={lng}",
    )

    try:
        await evaluar_zonas_seguras(str(paciente_id), float(lat), float(lng))
    except Exception as ex:
        Logger.add_to_log("error", f"Error evaluando zonas seguras: {ex}")

    await bus_eventos.publicar(
        topic=f"ubicacion/{paciente_id}",
        datos={
            "lat": lat,
            "lng": lng,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


async def manejar_mensaje(message: aiomqtt.Message) -> None:
    topic  = message.topic.value
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
            Logger.add_to_log("info", "Conectando a MQTT")
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
```

---

### 2. `Backend/services/service_alerta.py`

**Bugs corregidos:**
- Colecciones instanciadas dentro de cada función, no a nivel de módulo.
- Query ZonasSeguras usa `"activa": True` en vez de `"estado": "activa"`.
- Coordenadas del centro: `zona["centro"]["latitud"]`, `zona["centro"]["longitud"]`.
- Radio: `zona["radio_metros"]` en vez de `zona["radio"]`.
- Nombre del paciente: `paciente.get("nombre_paciente")` en vez de `paciente.get("nombre")`.
- Grupos buscados por `paciente_ids` (array) en vez de `paciente_id` (singular).
- Cuidadores leídos de `g.get("cuidador_ids", [])` en vez de `g.get("cuidador_id")`.
- Documento de alerta incluye `paciente_nombre` y `zona_nombre`.
- `reenviar_alertas_activas` existe y es exportable.

```python
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


async def evaluar_zonas_seguras(paciente_id, lat: float, lng: float) -> None:
    db = get_database()
    coleccion_zonas_seguras = db["ZonasSeguras"]
    coleccion_pacientes     = db["Pacientes"]

    paciente_id_str = str(paciente_id)

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
            lat=lat, lng=lng,
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

    if (ultima_alerta is None or
            (ahora - ultima_alerta).total_seconds() >= COOLDOWN_ALERTA_SEGUNDOS):
        await crear_y_despachar_alerta(
            paciente=paciente,
            zona_mas_cercana=zona_mas_cercana,
            lat=lat, lng=lng,
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


async def crear_y_despachar_alerta(
    paciente: dict,
    zona_mas_cercana: Optional[dict],
    lat: float, lng: float,
    tipo: str,
    distancia: float,
) -> None:
    db = get_database()
    coleccion_alertas    = db["Alertas"]
    coleccion_grupos     = db["Grupos"]
    coleccion_cuidadores = db["Cuidadores"]

    paciente_id     = paciente["_id"]
    paciente_id_str = str(paciente_id)
    nombre_paciente = paciente.get("nombre_paciente", "El paciente")

    if tipo == "salida_zona_segura":
        titulo = "⚠️ Alerta UbiLife"
        cuerpo = f"{nombre_paciente} ha salido de su zona segura"
    else:
        titulo = f"⚠️ {nombre_paciente} sigue fuera de zona"
        cuerpo = f"Está a aproximadamente {int(distancia)} metros de la zona más cercana"

    ahora = datetime.now(timezone.utc)

    alerta_doc = {
        "paciente_id":            paciente_id_str,
        "paciente_nombre":        nombre_paciente,
        "zonasegura_id":          zona_mas_cercana["_id"] if zona_mas_cercana else None,
        "zona_nombre":            zona_mas_cercana.get("nombre") if zona_mas_cercana else None,
        "tipo":                   tipo,
        "latitud":                lat,
        "longitud":               lng,
        "timestamp":              ahora,
        "estado":                 "pendiente",
        "mensaje":                cuerpo,
        "cuidadores_notificados": [],
        "fcm_exitos":             0,
        "fcm_fallos":             0,
        "ultima_notif":           ahora,
    }
    result    = await coleccion_alertas.insert_one(alerta_doc)
    alerta_id = result.inserted_id

    grupos = await coleccion_grupos.find({"paciente_ids": paciente_id_str}).to_list(length=None)
    if not grupos:
        logger.warning("Paciente %s sin cuidadores asignados", paciente_id_str)
        await coleccion_alertas.update_one({"_id": alerta_id}, {"$set": {"estado": "fallida"}})
        return

    cuidador_ids = []
    for g in grupos:
        cuidador_ids.extend(g.get("cuidador_ids", []))

    cuidadores = await coleccion_cuidadores.find(
        {"_id": {"$in": [
            ObjectId(cid) if isinstance(cid, str) and len(cid) == 24 else cid
            for cid in set(cuidador_ids)
        ]}}
    ).to_list(length=None)

    tokens                 = []
    cuidador_ids_con_token = []
    for c in cuidadores:
        token = c.get("fcm_token")
        if token:
            tokens.append(token)
            cuidador_ids_con_token.append(to_str_id(c["_id"]))

    if not tokens:
        logger.warning("Ningún cuidador del paciente %s tiene fcm_token", paciente_id_str)
        await coleccion_alertas.update_one({"_id": alerta_id}, {"$set": {"estado": "fallida"}})
        return

    resultado = await enviar_notificacion_multicast(
        tokens=tokens, titulo=titulo, cuerpo=cuerpo,
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
        "Alerta %s | tipo=%s | paciente=%s | FCM exitos=%d fallos=%d",
        str(alerta_id), tipo, paciente_id_str, resultado["exitos"], resultado["fallos"],
    )

    if resultado["tokens_invalidos"]:
        await coleccion_cuidadores.update_many(
            {"fcm_token": {"$in": resultado["tokens_invalidos"]}},
            {"$unset": {"fcm_token": ""}},
        )


async def listar_alertas(paciente_id: Optional[str] = None) -> list[dict]:
    db = get_database()
    query = {}
    if paciente_id:
        query["paciente_id"] = to_str_id(paciente_id)
    return await db["Alertas"].find(query).sort("timestamp", -1).to_list(length=None)


async def obtener_alerta(alerta_id: str) -> Optional[dict]:
    db = get_database()
    return await db["Alertas"].find_one({"_id": ObjectId(alerta_id)})


async def actualizar_estado(alerta_id: str, nuevo_estado: str) -> Optional[dict]:
    db = get_database()
    await db["Alertas"].update_one(
        {"_id": ObjectId(alerta_id)},
        {"$set": {"estado": nuevo_estado}},
    )
    return await obtener_alerta(alerta_id)


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
            "estado":       "enviada",
            "ultima_notif": {"$lt": cutoff},
        }).to_list(length=None)

        if not alertas_activas:
            return {"mensaje": "Sin alertas pendientes"}

        for alerta in alertas_activas:
            paciente_id_str = str(alerta.get("paciente_id", ""))
            if not paciente_id_str:
                continue

            try:
                paciente = await coleccion_pacientes.find_one({"_id": ObjectId(paciente_id_str)})
            except Exception:
                paciente = await coleccion_pacientes.find_one({"_id": paciente_id_str})

            if not paciente:
                continue

            nombre_paciente = paciente.get("nombre_paciente", "El paciente")

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
                    object_ids.append(ObjectId(cid) if len(cid) == 24 else cid)
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
                    "lat":         str(alerta.get("latitud", 0)),
                    "lng":         str(alerta.get("longitud", 0)),
                },
            )

            await coleccion_alertas.update_one(
                {"_id": alerta["_id"]},
                {"$set": {"ultima_notif": ahora}},
            )

            logger.info("Alerta %s reenviada | FCM exitos=%d", alerta["_id"], resultado["exitos"])

        return {"mensaje": f"Se procesaron {len(alertas_activas)} alertas"}

    except Exception as ex:
        logger.error("Error en reenviar_alertas_activas: %s", ex)
        return {"error": str(ex)}
```

---

### 3. `Backend/models/model_alertas.py`

**Bug corregido:** `RespuestaAlerta` coincide con el documento real que guarda `service_alerta.py`.

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class RespuestaAlerta(BaseModel):
    id:                      str           = Field(...)
    paciente_id:             str           = Field(...)
    paciente_nombre:         Optional[str] = Field(None)
    zonasegura_id:           Optional[str] = Field(None)
    zona_nombre:             Optional[str] = Field(None)
    tipo:                    str           = Field(...)
    latitud:                 float         = Field(...)
    longitud:                float         = Field(...)
    timestamp:               datetime      = Field(...)
    estado:                  str           = Field(...)
    mensaje:                 str           = Field(...)
    cuidadores_notificados:  list[str]     = Field(default_factory=list)
    fcm_exitos:              int           = Field(0)
    fcm_fallos:              int           = Field(0)
    ultima_notif:            datetime      = Field(...)

    class Config:
        from_attributes = True


class AtenderAlerta(BaseModel):
    cuidador_id: str = Field(..., description="Cuidador que marca voy en camino")
```

---

### 4. `Backend/routes/ruta_alerta.py`

**Bug corregido:** Los tres endpoints ahora requieren JWT con `Depends(get_cuidador_actual)`.

```python
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from services.service_alerta import listar_alertas, obtener_alerta, actualizar_estado
from models.model_alertas import RespuestaAlerta
from security.dependencies import get_cuidador_actual

router = APIRouter(prefix="/alertas", tags=["alertas"])


def _serializar(alerta: dict) -> dict:
    alerta["_id"]        = str(alerta["_id"])
    alerta["paciente_id"] = str(alerta["paciente_id"])
    if alerta.get("zonasegura_id"):
        alerta["zonasegura_id"] = str(alerta["zonasegura_id"])
    alerta["cuidadores_notificados"] = [
        str(c) for c in alerta.get("cuidadores_notificados", [])
    ]
    return alerta


@router.get("/", response_model=list[RespuestaAlerta])
async def alertas_listadas(
    paciente_id: Optional[str] = None,
    _: dict = Depends(get_cuidador_actual),
):
    alertas = await listar_alertas(paciente_id)
    return [_serializar(a) for a in alertas]


@router.get("/{alerta_id}", response_model=RespuestaAlerta)
async def alertas_obtenidas(
    alerta_id: str,
    _: dict = Depends(get_cuidador_actual),
):
    alerta = await obtener_alerta(alerta_id)
    if not alerta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta no encontrada")
    return _serializar(alerta)


@router.patch("/{alerta_id}/resolver", response_model=RespuestaAlerta)
async def resolver_alerta(
    alerta_id: str,
    _: dict = Depends(get_cuidador_actual),
):
    alerta = await actualizar_estado(alerta_id, "resuelta")
    if not alerta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta no encontrada")
    return _serializar(alerta)
```

---

## FRONTEND

---

### 5. `Fronted/services/api.ts`

**Bugs corregidos:**
- Sin imports de `localDb` ni `mockDb`.
- `BASE_URL` desde variable de entorno.
- `zonaService` usa `centro.latitud/longitud` y `radio_metros`.
- Agregados `dispositivoService` y `grupoService`.

```typescript
import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 8000 })

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const cuidadorService = {
  registrar: (datos: { name: string; email: string; password: string; phone?: string }) =>
    api.post('/cuidadores/registrar', datos),
  login: (email: string, password: string) =>
    api.post('/cuidadores/verificar', { email, password }),
  perfil: () => api.get('/cuidadores/perfil'),
  actualizar: (datos: { name?: string; telefono?: string }) =>
    api.put('/cuidadores/actualizar', datos),
  logout: () => api.post('/cuidadores/logout').catch(() => {}),
  actualizarFcmToken: (token: string) =>
    api.patch('/cuidadores/fcm-token', { token }),
}

export const familiarService = {
  registrar: (datos: {
    name: string; email: string; password: string; phone?: string; codigo_grupo?: string
  }) => api.post('/familiares/registrar', datos),
  login: (email: string, password: string) =>
    api.post('/familiares/verificar', { email, password }),
  misGrupos: () => api.get('/familiares/grupos'),
}

export const pacienteService = {
  listar: () => api.get('/pacientes/'),
  registrar: (datos: {
    nombre_paciente: string; edad_paciente: number;
    enfermedad?: string; id_cuidador: string; id_dispositivo?: string
  }) => api.post('/pacientes/registrar', datos),
  obtener: (id: string) => api.get(`/pacientes/${id}`),
  actualizar: (id: string, datos: any) => api.put(`/pacientes/${id}`, datos),
  ultimaUbicacion: (id: string) => api.get(`/historial-ubicaciones/ultima/${id}`),
  ruta: (id: string) => api.get(`/historial-ubicaciones/ruta/${id}`),
}

export const zonaService = {
  listarPorPaciente: (pacienteId: string) =>
    api.get(`/zonas-seguras/paciente/${pacienteId}`),
  crear: (datos: {
    nombre: string; paciente_id: string;
    centro: { latitud: number; longitud: number }; radio_metros: number
  }) => api.post('/zonas-seguras/', datos),
  eliminar: (id: string) => api.delete(`/zonas-seguras/${id}`),
  toggle: (id: string) => api.patch(`/zonas-seguras/${id}/toggle`),
}

export const alertaService = {
  listar: (pacienteId?: string) => {
    const params = pacienteId ? { paciente_id: pacienteId } : {}
    return api.get('/alertas/', { params })
  },
  resolver: (id: string) => api.patch(`/alertas/${id}/resolver`),
}

export const dispositivoService = {
  disponibles: () => api.get('/dispositivos/disponibles'),
  vincular: (datos: { id_dispositivo: string; paciente_id: string }) =>
    api.post('/dispositivos/vincular', datos),
  desvincular: (id: string) => api.patch(`/dispositivos/desvincular/${id}`),
  porPaciente: (pacienteId: string) => api.get(`/dispositivos/paciente/${pacienteId}`),
}

export const grupoService = {
  listar: () => api.get('/grupos/'),
  crear: (datos: { nombre: string; paciente_ids?: string[] }) =>
    api.post('/grupos/registrar', datos),
  obtener: (id: string) => api.get(`/grupos/${id}`),
  eliminar: (id: string) => api.delete(`/grupos/${id}`),
  agregarMiembro: (id: string, cuidadorId: string) =>
    api.post(`/grupos/${id}/miembros`, { cuidador_id: cuidadorId }),
  unirseConCodigo: (codigo: string) => api.post('/grupos/unirse', { codigo }),
}

export default api
```

---

### 6. `Fronted/app/login.tsx`

**Bugs corregidos:**
- Sin fallback a `localLogin`.
- Intenta cuidador primero, luego familiar.
- Texto en español.

```typescript
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { cuidadorService, familiarService } from '@/services/api'
import { Colors } from '@/constants/Colors'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { login } = useAuth()
  const router    = useRouter()

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Por favor completa todos los campos')
      return
    }
    setLoading(true)
    setError('')

    let data: any = null
    let tipo: 'cuidador' | 'familiar' = 'cuidador'

    try {
      const res = await cuidadorService.login(email.trim().toLowerCase(), password)
      data = res.data
      tipo = 'cuidador'
    } catch {
      try {
        const res = await familiarService.login(email.trim().toLowerCase(), password)
        data = res.data
        tipo = 'familiar'
      } catch (familiarErr: any) {
        const msg =
          familiarErr.response?.data?.detail  ??
          familiarErr.response?.data?.mensaje ??
          familiarErr.response?.data?.error   ??
          'Credenciales inválidas. Verifica tu correo y contraseña.'
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
        setLoading(false)
        return
      }
    }

    try {
      const token    = data.token ?? data.access_token ?? data.jwt
      const cuidador = data.cuidador ?? data.familiar ?? { email: email.trim() }
      await login(token, cuidador, data.tipo ?? tipo)
      router.replace('/(app)/' as any)
    } catch {
      setError('Error inesperado al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="location" size={42} color={Colors.white} />
            </View>
            <Text style={styles.appName}>UbiLife</Text>
            <Text style={styles.tagline}>Rastreo GPS para cuidadores</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={15} color={Colors.error} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Ingresar</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/elegir-rol' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>
                ¿No tienes cuenta?{' '}
                <Text style={styles.registerHighlight}>Regístrate</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  kav:    { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  appName:  { fontSize: 38, fontWeight: '800', color: Colors.white, letterSpacing: 1.5 },
  tagline:  { fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 6 },
  card:     { backgroundColor: Colors.white, borderRadius: 24, padding: 28, elevation: 10 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 22 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 18,
    borderLeftWidth: 4, borderLeftColor: Colors.error,
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, lineHeight: 19 },
  field:  { marginBottom: 18 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
  input:  {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.background,
  },
  btn:         { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 6, elevation: 4 },
  btnDisabled: { opacity: 0.65 },
  btnText:     { color: Colors.white, fontSize: 16, fontWeight: '700' },
  registerLink: { alignItems: 'center', marginTop: 20 },
  registerText: { fontSize: 14, color: Colors.textSecondary },
  registerHighlight: { color: Colors.primary, fontWeight: '700' },
})
```

---

### 7. `Fronted/app/(app)/perfil.tsx`

**Bug corregido:** Guardar cambios llama al backend real. Logout llama al endpoint antes de limpiar contexto.

> El código completo de este archivo fue entregado previamente en `perfil.tsx`.
> Claude Code debe verificar que:
> - `handleGuardar` llama a `cuidadorService.actualizar()`.
> - `handleLogout` llama a `cuidadorService.logout()` antes de `logout()` del contexto.
> - No hay `setTimeout` simulando un guardado.

---

### 8. `Fronted/app/(app)/index.tsx`

**Bugs corregidos:**
- Usa `react-native-webview` + Leaflet + OpenStreetMap (sin API Key).
- Campos correctos: `nombre_paciente`, `id_paciente`, `ultima_ubicacion.latitud/longitud`, `centro.latitud/longitud`, `radio_metros`.
- Sin imports de `localDb`.

> El código completo fue entregado previamente en `index.tsx`.
> Claude Code debe verificar que:
> - No hay `PROVIDER_GOOGLE` ni `react-native-maps` como mapa principal.
> - Existe un `<WebView>` con `source={{ html: mapHtml }}`.
> - `buildMapHTML` usa `zona["centro"]["latitud"]` y `zona["radio_metros"]`.
> - `pac.nombre_paciente` y `pac.id_paciente` se usan correctamente.

---

### 9. `Fronted/app/(app)/vincular-dispositivo.tsx`

**Bug corregido:** Lista dispositivos reales de `DispositivosDisponibles`. Vincula contra el backend.

> El código completo fue entregado previamente en `vincular-dispositivo.tsx`.
> Claude Code debe verificar que:
> - Al montar llama a `dispositivoService.disponibles()`.
> - Al presionar "Vincular" llama a `dispositivoService.vincular({ id_dispositivo, paciente_id })`.
> - No usa `mockData` ni datos estáticos.

---

### 10. `Fronted/app/(app)/alertas.tsx`

**Bugs corregidos:**
- Estados en minúscula: `enviada`, `pendiente`, `resuelta`, `fallida`.
- Botón resolver visible cuando `item.estado === 'enviada'`.
- `paciente_nombre` viene del backend o se cruza con lista de pacientes.

> El código completo fue entregado previamente en `alertas.tsx`.
> Claude Code debe verificar que:
> - `ESTADO_COLOR` tiene las claves `enviada`, `pendiente`, `resuelta`, `fallida`.
> - La condición del botón resolver es `item.estado === 'enviada'`.
> - No hay referencias a `'ACTIVA'` ni `'RESUELTA'` en mayúsculas.

---

### 11. `Fronted/app/(app)/zonas-seguras.tsx`

**Bugs corregidos:**
- `zonaService.crear()` con `centro: { latitud, longitud }` y `radio_metros`.
- Lista muestra `item.radio_metros` y `pac.nombre_paciente`.
- `PROVIDER_DEFAULT` en vez de `PROVIDER_GOOGLE`.

> El código completo fue entregado previamente en `zonas-seguras.tsx`.
> Claude Code debe verificar que:
> - `zonaService.crear()` envía `centro: { latitud, longitud }` y `radio_metros`.
> - En la lista: `item.radio_metros`, `pac.nombre_paciente`, `p.id_paciente ?? p.id`.
> - No aparece `PROVIDER_GOOGLE`.

---

### 12. `Fronted/app/(app)/historial-ubicaciones.tsx`

**Bug corregido:** Historial cargado desde `pacienteService.ruta(id)`, no desde AsyncStorage local.

> El código completo fue entregado previamente en `historial-ubicaciones.tsx`.
> Claude Code debe verificar que:
> - `cargarDatos()` llama a `pacienteService.ruta(idActivo)`.
> - La polyline usa `u.coordenadas.latitud` y `u.coordenadas.longitud`.
> - No hay `AsyncStorage.getItem('@ubilife_historial_ubicaciones')`.

---

### 13. `Fronted/app/(app)/grupo-familiar.tsx`

**Bug corregido:** Toda la lógica conectada al backend. Sin AsyncStorage para persistencia.

> El código completo fue entregado previamente en `grupo-familiar.tsx`.
> Claude Code debe verificar que:
> - `cargarDatos()` llama a `grupoService.listar()`.
> - `handleCrearGrupo()` llama a `grupoService.crear()`.
> - `eliminarGrupo()` llama a `grupoService.eliminar(id)`.
> - No hay `AsyncStorage.setItem` ni `AsyncStorage.getItem` para persistir grupos.

---

## Pasos de verificación al finalizar

### Backend
```bash
cd Backend

# Verificar imports sin errores
python -c "from services.service_alerta import reenviar_alertas_activas; print('service_alerta OK')"
python -c "from routes.ruta_alerta import router; print('ruta_alerta OK')"
python -c "from models.model_alertas import RespuestaAlerta; print('model_alertas OK')"
python -c "from MQTT.subscriber import mqtt_subscriber_task; print('subscriber OK')"

# Arrancar el servidor
uvicorn app:app --host 0.0.0.0 --port 8000 &
sleep 4

# Verificar que alertas requiere JWT (debe devolver 401 o 403, no 200)
curl -s http://localhost:8000/alertas/ | python -c "
import sys, json
d = json.load(sys.stdin)
print('✅ JWT requerido correctamente') if 'detail' in d else print('❌ ENDPOINT PÚBLICO — falta JWT')
"

# Detener servidor
kill %1
```

### Frontend
```bash
cd Fronted

# Sin imports de localDb
grep -r "localDb\|mockDb" --include="*.ts" --include="*.tsx" . \
  && echo "❌ Aún hay imports de localDb" \
  || echo "✅ Sin imports de localDb"

# Archivos eliminados
[ ! -f "services/localDb.ts" ] && echo "✅ localDb.ts eliminado" || echo "❌ localDb.ts aún existe — eliminar"
[ ! -f "data/mockDb.json"    ] && echo "✅ mockDb.json eliminado" || echo "❌ mockDb.json aún existe — eliminar"

# Dependencias instaladas
grep "react-native-webview" package.json > /dev/null \
  && echo "✅ react-native-webview instalado" \
  || echo "❌ FALTA: npx expo install react-native-webview"

grep "react-native-sse" package.json > /dev/null \
  && echo "✅ react-native-sse instalado" \
  || echo "❌ FALTA: npx expo install react-native-sse"

# Variable de entorno
[ -f ".env" ] && grep "EXPO_PUBLIC_API_URL" .env > /dev/null \
  && echo "✅ .env con EXPO_PUBLIC_API_URL" \
  || echo "❌ FALTA: crear .env con EXPO_PUBLIC_API_URL=http://10.0.2.2:8000"

# TypeScript sin errores
npx tsc --noEmit && echo "✅ TypeScript OK" || echo "❌ Errores de TypeScript — revisar"
```

---

## Archivos a eliminar (si existen)

```bash
rm -f Fronted/services/localDb.ts
rm -f Fronted/data/mockDb.json
```

---

## Utilidades a migrar desde el frontend de Andrés

### `Fronted/utils/notificaciones.ts`

Si no existe, créalo con el siguiente contenido.
**Corrección aplicada:** campo `token` en vez de `fcm_token` al hacer PATCH.

```typescript
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'

const API_URL = process.env.EXPO_PUBLIC_API_URL
const IS_EXPO_GO = Constants.appOwnership === 'expo'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registrarToken(): Promise<void> {
  if (IS_EXPO_GO) {
    console.log('[Notificaciones] Expo Go detectado — usa development build para push')
    return
  }
  if (!Device.isDevice) return

  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      const { status: nuevo } = await Notifications.requestPermissionsAsync()
      if (nuevo !== 'granted') return
    }

    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })
    if (!pushToken.data) return

    const tokenJWT = await AsyncStorage.getItem('token')
    if (!tokenJWT) return

    // CORRECCIÓN: campo "token" (no "fcm_token")
    await axios.patch(
      `${API_URL}/cuidadores/fcm-token`,
      { token: pushToken.data },
      { headers: { Authorization: `Bearer ${tokenJWT}` } }
    )
  } catch (error) {
    console.warn('[Notificaciones] Error registrando token:', error)
  }
}

export function configurarListeners(
  onAlerta: (data: {
    tipo: string; alerta_id: string; paciente_id: string; lat: string; lng: string
  }) => void
): () => void {
  if (IS_EXPO_GO) {
    console.log('[Notificaciones] Listeners omitidos en Expo Go')
    return () => {}
  }

  const subs: Notifications.Subscription[] = []

  subs.push(
    Notifications.addNotificationReceivedListener((notif) => {
      const data = notif.request.content.data as any
      if (data?.paciente_id) onAlerta(data)
    })
  )

  subs.push(
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      if (data?.paciente_id) onAlerta(data)
    })
  )

  return () => subs.forEach((s) => s.remove())
}
```

Luego en `Fronted/app/login.tsx`, después del login exitoso, agregar:
```typescript
import { registrarToken } from '@/utils/notificaciones'
// ...
await login(token, cuidador, tipo)
registrarToken().catch(() => {}) // fire and forget
router.replace('/(app)/' as any)
```

Y en `Fronted/app/_layout.tsx`, agregar dentro del componente raíz:
```typescript
import { configurarListeners } from '@/utils/notificaciones'
// ...
useEffect(() => {
  const limpiar = configurarListeners((data) => {
    console.log('Alerta recibida:', data)
    // aquí puedes navegar a la pantalla de alertas
  })
  return limpiar
}, [])
```

---

### `Fronted/hooks/useSSEUbicacion.ts`

Si no existe, créalo con el siguiente contenido:

```typescript
import { useEffect, useRef, useState } from 'react'
import EventSource from 'react-native-sse'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL

interface UbicacionPaciente {
  latitude:  number
  longitude: number
  timestamp: string
}

export const useSSEUbicacion = (pacienteId: string | null) => {
  const [ubicacion, setUbicacion] = useState<UbicacionPaciente | null>(null)
  const [conectado, setConectado] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!pacienteId) return
    let cancelado = false

    const conectar = async () => {
      esRef.current?.close()
      const token = await AsyncStorage.getItem('token')
      if (!token || cancelado) return

      const es = new EventSource(
        `${API_URL}/pacientes/${pacienteId}/ubicacion/stream`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      es.addEventListener('open', () => {
        if (!cancelado) setConectado(true)
      })

      es.addEventListener('message', (e: any) => {
        if (cancelado || !e.data) return
        try {
          const datos = JSON.parse(e.data)
          setUbicacion({
            latitude:  datos.latitud  ?? datos.lat,
            longitude: datos.longitud ?? datos.lng,
            timestamp: datos.timestamp,
          })
        } catch (_) {}
      })

      es.addEventListener('error', () => {
        if (cancelado) return
        setConectado(false)
        esRef.current?.close()
        setTimeout(conectar, 5000)
      })

      esRef.current = es
    }

    conectar()
    return () => {
      cancelado = true
      esRef.current?.close()
    }
  }, [pacienteId])

  return { ubicacion, conectado }
}
```

---

## Reporte final esperado

```
## Reporte de verificación UbiLife

### Backend
| Archivo                        | Estado  | Detalle                  |
|-------------------------------|---------|--------------------------|
| MQTT/subscriber.py            | ✅/⚠️/❌ |                          |
| services/service_alerta.py    | ✅/⚠️/❌ |                          |
| models/model_alertas.py       | ✅/⚠️/❌ |                          |
| routes/ruta_alerta.py         | ✅/⚠️/❌ |                          |

### Frontend
| Archivo                              | Estado  | Detalle                  |
|-------------------------------------|---------|--------------------------|
| services/api.ts                     | ✅/⚠️/❌ |                          |
| app/login.tsx                       | ✅/⚠️/❌ |                          |
| app/(app)/perfil.tsx                | ✅/⚠️/❌ |                          |
| app/(app)/index.tsx                 | ✅/⚠️/❌ |                          |
| app/(app)/vincular-dispositivo.tsx  | ✅/⚠️/❌ |                          |
| app/(app)/alertas.tsx               | ✅/⚠️/❌ |                          |
| app/(app)/zonas-seguras.tsx         | ✅/⚠️/❌ |                          |
| app/(app)/historial-ubicaciones.tsx | ✅/⚠️/❌ |                          |
| app/(app)/grupo-familiar.tsx        | ✅/⚠️/❌ |                          |

### Limpieza y dependencias
| Tarea                              | Estado  |
|-----------------------------------|---------|
| localDb.ts eliminado              | ✅/❌    |
| mockDb.json eliminado             | ✅/❌    |
| react-native-webview instalado    | ✅/❌    |
| react-native-sse instalado        | ✅/❌    |
| .env con EXPO_PUBLIC_API_URL      | ✅/❌    |
| utils/notificaciones.ts migrado   | ✅/❌    |
| hooks/useSSEUbicacion.ts migrado  | ✅/❌    |

### Errores que requieren atención manual
(lista aquí cualquier cosa que no pudiste corregir automáticamente)
```
