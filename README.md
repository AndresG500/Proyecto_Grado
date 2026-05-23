# UbiLife

Sistema de rastreo GPS en tiempo real para pacientes con Alzheimer. Los cuidadores reciben alertas push cuando el paciente sale de una zona segura definida. El hardware es un **ESP32-C6-Zero + módulo GPS BZ-251** que publica coordenadas por MQTT; el backend las procesa y evalúa geovallas.

---

## Roles de usuario

| Rol | Descripción |
|---|---|
| **Cuidador** | Registra pacientes, define zonas seguras, recibe alertas, puede activar Modo Viaje |
| **Familiar** | Acceso de solo lectura al grupo; puede ver alertas, historial y zonas; también puede activar Modo Viaje |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.14, FastAPI, Motor (MongoDB async), aiomqtt |
| Base de datos | MongoDB Atlas (`UbiLife`) |
| Broker MQTT | HiveMQ Cloud (TLS 8883) |
| Push notifications | Expo Push API |
| Frontend | React Native 0.81, Expo SDK 54, Expo Router |
| Mapas | Leaflet + OpenStreetMap (via WebView, sin API key) |
| Hardware | ESP32-C6-Zero + GPS BZ-251 |

---

## Requisitos previos

**Backend**
- Python 3.11+
- Cuenta en MongoDB Atlas
- Broker HiveMQ Cloud (o compatible)

**Frontend**
- Node.js 20+
- Expo CLI (`npx expo`)
- Android Studio (emulador) o dispositivo Android físico

---

## Configuración del entorno

### Backend — `Backend/.env`

```env
MONGO_URI=mongodb+srv://...
SECRET_KEY=clave_secreta_larga
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
MQTT_HOST=xxxx.hivemq.cloud
MQTT_PORT=8883
MQTT_USER=...
MQTT_PASS=...
# Opcionales:
SENTRY_DSN=...
ENVIRONMENT=production        # oculta /docs y /redoc
TRUST_PROXY=1                 # leer X-Forwarded-For detrás de un proxy
ALLOWED_ORIGINS=https://...   # CORS; por defecto permite *
```

### Frontend — `Fronted/.env`

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000   # emulador Android
# o http://<IP-del-PC>:8000 para dispositivo físico en la misma red
# o http://<IP-Tailscale>:8000 para redes distintas
```

---

## Cómo ejecutar

### Backend

```bash
cd Backend
source env/bin/activate
uvicorn app:app --host 0.0.0.0 --reload
```

Documentación interactiva disponible en `http://localhost:8000/docs` (solo cuando `ENVIRONMENT` no está en `production`).

### Poblar la base de datos (desarrollo)

```bash
cd Backend && source env/bin/activate
python seed_db.py
```

Crea un documento coherente por colección con IDs pre-enlazados.

| Usuario | Email | Contraseña | Rol |
|---|---|---|---|
| María García | `maria.garcia@ubilife.test` | `Seed1234!` | Cuidador |
| Carlos García | `carlos.garcia@ubilife.test` | `Seed1234!` | Familiar |

### Frontend

```bash
cd Fronted
npm install
npx expo start
```

Para dispositivo físico: `npx expo run:android`  
Para build standalone (APK): `eas build --profile preview --platform android`

---

## Arquitectura del backend

El arranque (`app.py`) registra todos los routers e inicia tres tareas en background:

- **`mqtt_subscriber_task`** — recibe GPS del ESP32 vía HiveMQ, guarda en `Historial`, evalúa geovallas y emite eventos SSE.
- **`tarea_alertas`** — reenvía alertas activas cada 5 minutos.
- **`tarea_watchdog_gps`** — cada 30 s detecta dispositivos sin señal y dispara alertas `"senal_perdida"`.

Cada dominio sigue el patrón: `models/model_*.py` → `services/service_*.py` → `routes/ruta_*.py`.

### Tipos de alerta

| Tipo | Condición |
|---|---|
| `salida_zona_segura` | Paciente sale de una zona activa |
| `alerta_periodica` | Paciente sigue fuera tras 300 s |
| `anomalia_velocidad` | Velocidad GPS supera 50 km/h |
| `senal_perdida` | Dispositivo sin señal por ≥ 60 s |

### Modo Viaje

Permite suprimir alertas durante desplazamientos conocidos. Tipos: `"caminata"` (suprime solo salida de zona) y `"vehiculo"` (suprime todas las alertas). Lo pueden activar tanto el cuidador como el familiar.

---

## Hardware — ESP32-C6-Zero

El firmware (`Backend/esp32.ino`) conecta al broker MQTT por WiFi y publica cada lectura GPS en el topic:

```
ubilife/dispositivo/<id_dispositivo>/gps
```

Payload: `{"lat": float, "lng": float}`

---

## Flujo MQTT → alerta push

```
ESP32 → HiveMQ → subscriber.py → Historial (MongoDB)
                                → evaluar_zonas_seguras()
                                     └─ fuera de zona → Alertas (MongoDB)
                                                       → Expo Push API → celular cuidador
                                → SSE bus → frontend (mapa en tiempo real)
```

---

## Licencia

Proyecto académico — Universidad.
