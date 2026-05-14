# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UbiLife** is a real-time GPS tracking app for Alzheimer patients. Caregivers ("cuidadores") receive push alerts when patients leave defined safe zones ("zonas seguras"). Hardware is an ESP32-C6-Zero + BZ-251 GPS module that publishes to MQTT; the FastAPI backend subscribes, persists to MongoDB, evaluates geofences, and pushes alerts via Expo Push API.

---

## Repository Structure

```
Proyecto_Grado/
├── Backend/    # FastAPI + MongoDB
└── Fronted/    # React Native + Expo
```

---

## Backend

### Running

```bash
cd Backend
source env/bin/activate
uvicorn app:app --reload
```

API docs available at `http://localhost:8000/docs`.

### Required `.env` (Backend/)

```
MONGO_URI=mongodb+srv://...
SECRET_KEY=...
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
MQTT_HOST=...hivemq.cloud
MQTT_PORT=8883
MQTT_USER=...
MQTT_PASS=...
```

### Architecture

The app boots in `app.py`, which registers all routers and starts two background async tasks: `mqtt_subscriber_task` (receives GPS from HiveMQ) and `tarea_alertas` (re-sends active alerts every 5 min).

Each domain follows a three-layer pattern:

| Layer | Location | Naming |
|---|---|---|
| Pydantic models | `models/model_*.py` | `Base → Crear → Respuesta → Actualizar` |
| Business logic | `services/service_*.py` | Returns `{"error": "msg"}` on failure |
| HTTP router | `routes/ruta_*.py` | Checks for `"error"` key, raises HTTPException |

**MongoDB collections:** `Cuidadores`, `Familiares`, `Pacientes`, `Dispositivos`, `DispositivosDisponibles`, `ZonasSeguras`, `Grupos`, `Alertas`, `HistorialUbicaciones`, `TokensRevocados`

**MQTT flow:** ESP32 publishes JSON `{"lat": float, "lng": float}` to `ubilife/dispositivo/<id>/gps` → `MQTT/subscriber.py` parses the payload → if device not in `Dispositivos`, upserts to `DispositivosDisponibles` and returns → otherwise saves to `HistorialUbicaciones` → evaluates geofences via `service_alerta.evaluar_zonas_seguras` → if outside zone, fires Expo Push notification and records in `Alertas` → publishes SSE event to `bus_eventos` (in `utils/eventos.py`).

**Auth:** JWT issued on `/cuidadores/verificar` and `/familiares/verificar`. Revoked tokens are stored in `TokensRevocados` with a MongoDB TTL index (set at startup) so they auto-expire. Two auth dependencies in `security/dependencies.py`:
- `get_cuidador_actual` — for cuidador-only routes
- `get_familiar_actual` — for familiar-only routes

**Push notifications:** Uses Expo Push API (not Firebase directly). `FCM/client.py` sends HTTP requests to `https://exp.host/--/api/v2/push/send`. Tokens stored as `fcm_token` on each `Cuidador` document; invalid tokens auto-cleaned after a `DeviceNotRegistered` error.

**Rate limiting:** In-memory sliding-window middleware (30 req/60 s per IP) in `app.py`.

**Real-time location (SSE):** The backend exposes `GET /pacientes/{id}/ubicacion/stream`. The internal `EventBus` (`utils/eventos.py`) is a pub/sub over `asyncio.Queue`; MQTT messages publish to topic `ubicacion/<paciente_id>` and the SSE endpoint subscribes to it.

**Logging:** Use `Logger.add_to_log("info"|"warn"|"error", mensaje)` from `utils/Logger.py` in all backend services and tasks (not `print()` or `logging` directly, except in `service_alerta.py` which uses `logging`).

### Critical document field names

Wrong field names have caused multiple bugs — use these exactly:

**ZonasSeguras:** `centro: {latitud, longitud}`, `radio_metros` (not `radio`), `activa: bool` (not `estado: "activa"`), `paciente_id: str`

**Pacientes:** `nombre_paciente` (not `nombre`), `fuera_de_zona: bool`, `ultima_alerta_timestamp`

**Grupos:** `cuidador_ids: [str]` (not `cuidador_id`), `paciente_ids: [str]` (not `paciente_id`), `familiar_ids: [str]`, `codigo: str` (for joining)

**Alertas:** `estado` values are `"pendiente"`, `"enviada"`, `"resuelta"`, `"fallida"`. Document includes `paciente_nombre`, `zona_nombre`, `ultima_notif`.

**Dispositivos:** `id_dispositivo` (string identifier from ESP32), `paciente_id`, `ultima_conexion`

### Utility modules

There are **two** geo/utility directories — do not confuse them:
- `utilidades/geo.py` — `distancia_metros(lat1, lng1, lat2, lng2)` — used by `service_alerta.py`
- `utils/geo.py` — `calcular_distancia(lat1, lng1, lat2, lng2)` — standalone, currently unused by services
- `utilidades/mongo_utils.py` — `to_str_id(id)`, `to_object_id(id)` helpers

---

## Frontend

### Running

```bash
cd Fronted
npm install
npx expo start
```

- Android emulator: `npx expo run:android`
- Physical device: set `EXPO_PUBLIC_API_URL` to your machine's LAN IP
- Lint: `npx expo lint`
- TypeScript check: `npx tsc --noEmit`

### Required env (Fronted/.env)

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000   # Android emulator
# or http://<your-machine-ip>:8000 for physical device
```

### Architecture

Uses **Expo Router** (file-based routing):

- `app/_layout.tsx` — Root layout; wraps everything in `AuthProvider` and `AuthGuard` (redirects unauthenticated users to `/login`). Also sets up push notification listeners via `configurarListeners`.
- `app/(app)/_layout.tsx` — Drawer navigation for protected routes
- `app/(app)/` — Protected routes (drawer navigation). Entry is `index.tsx` (map + live location)
- Public routes: `login.tsx`, `register.tsx`, `register-cuidador.tsx`, `register-familiar.tsx`, `elegir-rol.tsx`

**State:** `context/AuthContext.tsx` holds `token`, `cuidador`, and `tipoUsuario` (`'cuidador' | 'familiar'`), persisted in `AsyncStorage`. The axios instance in `services/api.ts` registers a `_logoutHandler` that auto-calls `logout()` on any 401 response.

**API calls:** `services/api.ts` — a single `axios` instance with a request interceptor that attaches the Bearer token. Domain-grouped exports: `cuidadorService`, `familiarService`, `pacienteService`, `zonaService`, `alertaService`, `dispositivoService`, `grupoService`.

**Real-time location:** `hooks/useSSEUbicacion.ts` — connects to the SSE endpoint using `react-native-sse`, auto-reconnects on error after 5 s. SSE event data uses keys `lat`/`lng` (not `latitud`/`longitud`).

**Push notifications:** `utils/notificaciones.ts` — `registrarToken()` called after login (fire-and-forget), `configurarListeners(onAlerta)` called in root layout. Both functions are no-ops in Expo Go (require a development build for actual push delivery).

**Maps:** The main map (`index.tsx`) uses `react-native-webview` + Leaflet + OpenStreetMap (no API key required). Do not switch to `react-native-maps` with `PROVIDER_GOOGLE` for the main map.

---

## Code Conventions

- **All code in Spanish**: variable names, function names, route paths, MongoDB collection names, and field names.
- Services always return a plain `dict`; routes inspect the `"error"` key to decide the HTTP status code.
- Do not call `get_database()` at module import time inside services — always call it inside the function body (avoids startup ordering bugs).
- Frontend import alias: `@/` maps to the `Fronted/` root (e.g. `@/services/api`, `@/context/AuthContext`).
