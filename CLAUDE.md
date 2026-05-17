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

### Docker (local MongoDB alternative)

`Backend/docker-compose.yml` starts a local MongoDB + Mongo Express instead of using Atlas:

```bash
cd Backend
docker compose up -d
# MongoDB on port 27017, Mongo Express UI on http://localhost:8081
```

Set `MONGO_URI=mongodb://localhost:27017` in `.env` when using this.

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
SENTRY_DSN=...   # optional; omit to disable Sentry
ENVIRONMENT=production   # optional; hides /docs and /redoc when set
```

### Seeding demo data

```bash
cd Backend
node insertar_datos_demo.js   # requires mongosh; targets localhost:27017 by default
```

### Docker backup / restore

```bash
bash docker/exportar.sh    # dumps MongoDB to docker/dump/
bash docker/restaurar.sh   # restores from docker/dump/
```

### Quick import check

```bash
cd Backend && source env/bin/activate
python -c "from services.service_alerta import reenviar_alertas_activas; print('OK')"
python -c "from routes.ruta_alerta import router; print('OK')"
python -c "from MQTT.subscriber import mqtt_subscriber_task; print('OK')"
```

### Architecture

The app boots in `app.py`, which registers all routers and starts two background async tasks: `mqtt_subscriber_task` (receives GPS from HiveMQ) and `tarea_alertas` (re-sends active alerts every 5 min).

Each domain follows a three-layer pattern:

| Layer | Location | Naming |
|---|---|---|
| Pydantic models | `models/model_*.py` | `Base → Crear → Respuesta → Actualizar` |
| Business logic | `services/service_*.py` | Returns `{"error": "msg"}` on failure |
| HTTP router | `routes/ruta_*.py` | Checks for `"error"` key, raises HTTPException |

**Naming mismatch:** `routes/ruta_cliente.py` handles the `/cuidadores` prefix — the filename uses "cliente" but the domain, collection, and prefix are all "cuidador". Do not create a separate `ruta_cuidador.py`.

**MongoDB collections:** `Cuidadores`, `Familiares`, `Pacientes`, `Dispositivos`, `DispositivosDisponibles`, `ZonasSeguras`, `Grupos`, `Alertas`, `Historial`, `TokensRevocados`

**Modo Viaje:** When a cuidador or familiar activates travel mode, `service_modo_viaje.py` writes `modo_viaje_activo`, `modo_viaje_tipo` (`"caminata"` or `"vehiculo"`), `modo_viaje_inicio`, `modo_viaje_fin` (UTC datetime or `None` for indefinite), and `modo_viaje_activado_por` directly onto the `Pacientes` document. The helper `_auto_expirar_modo_viaje(paciente)` checks whether `modo_viaje_fin` has passed and clears the fields if so; call it before acting on `modo_viaje_activo` when freshness matters. While mode is active, `service_alerta.py` should suppress zone-exit alerts (check `modo_viaje_activo` before firing). Router is `/modo-viaje`; both cuidador and familiar endpoints share the same service functions.

**MQTT flow:** ESP32 publishes JSON `{"lat": float, "lng": float}` to `ubilife/dispositivo/<id>/gps` → `MQTT/subscriber.py` parses the payload → if device not in `Dispositivos`, upserts to `DispositivosDisponibles` (field: `dispositivo_detectado` timestamp) and returns → otherwise saves to `Historial` → evaluates geofences via `service_alerta.evaluar_zonas_seguras` → if outside zone, fires Expo Push notification and records in `Alertas` → publishes SSE event to `bus_eventos` (in `utils/eventos.py`).

**Auth:** JWT issued on `/cuidadores/verificar` and `/familiares/verificar`. Revoked tokens are stored in `TokensRevocados` with a MongoDB TTL index (set at startup) so they auto-expire. JWT payload fields: `email` and `jti`. Two auth dependencies in `security/dependencies.py`:
- `get_cuidador_actual` — for cuidador-only routes
- `get_familiar_actual` — for familiar-only routes

**FastAPI route ordering:** Always register static path segments before parameterized ones within the same router. Example: `GET /familiar/` must be registered **before** `GET /{alerta_id}` or FastAPI will match `"familiar"` as the `alerta_id` parameter. This applies to any router where a literal segment and a path param share the same position.

**Input sanitization:** `utils/sanitizer.py` — `sanitize_string(value, max_length)` and `sanitize_dict(data, max_length)` (HTML-escapes strings). Use at route boundaries for user-supplied text.

**Push notifications:** Uses Expo Push API (not Firebase directly). `FCM/client.py` sends HTTP requests to `https://exp.host/--/api/v2/push/send`. Tokens stored as `fcm_token` on each `Cuidador` document; invalid tokens auto-cleaned after a `DeviceNotRegistered` error.

**Rate limiting:** In-memory sliding-window middleware (120 req/60 s per IP) in `app.py`.

**Real-time location (SSE):** The backend exposes `GET /pacientes/{id}/ubicacion/stream`. The internal `EventBus` (`utils/eventos.py`) is a pub/sub over `asyncio.Queue`; MQTT messages publish to topic `ubicacion/<paciente_id>` and the SSE endpoint subscribes to it.

**Logging:** Use `Logger.add_to_log("info"|"warn"|"error", mensaje)` from `utils/Logger.py` in all backend services and tasks (not `print()` or `logging` directly, except in `service_alerta.py` which uses `logging`).

**Create/delete response shape:** Several services return `{"mensaje": "..."}` on success rather than the created document. For example, `service_zonasegura.py` returns `{"mensaje": "Zona segura creada exitosamente"}` after `insert_one`. Frontend must call a full reload after these operations — never append `res.data` to local state. Always filter reloaded arrays with `.filter(item => !!item.id)` to discard stale message objects.

### Critical document field names

Wrong field names have caused multiple bugs — use these exactly:

**ZonasSeguras:** `centro: {latitud, longitud}`, `radio_metros` (not `radio`), `activa: bool` (not `estado: "activa"`), `paciente_id: str`

**Pacientes:** `nombre_paciente` (not `nombre`), `edad_paciente`, `cedula`, `eps`, `enfermedad`, `familiar_nombre`, `familiar_telefono`, `fuera_de_zona: bool`, `ultima_alerta_timestamp`, `id_paciente` (response alias for `_id`). Modo viaje fields: `modo_viaje_activo: bool`, `modo_viaje_tipo`, `modo_viaje_inicio`, `modo_viaje_fin`, `modo_viaje_activado_por`.

**Grupos:** `cuidador_ids: [str]` (not `cuidador_id`), `paciente_ids: [str]` (not `paciente_id`), `familiar_ids: [str]`, `codigo: str` (for joining)

**Alertas:** `estado` values are `"pendiente"`, `"enviada"`, `"resuelta"`, `"fallida"`. Document includes `paciente_nombre`, `zona_nombre`, `ultima_notif`. Alert cooldown: 300 s between repeated push notifications for the same patient (`COOLDOWN_ALERTA_SEGUNDOS`).

**Dispositivos:** `id_dispositivo` (string identifier from ESP32), `paciente_id`, `ultima_conexion`

**Historial:** Collection name is `Historial` (not `HistorialUbicaciones`). Locations are filtered: skips a new point if it is less than 10 m from the previous one (`DISTANCIA_MINIMA_METROS = 10`). History queries return the last 7 days (`DIAS_HISTORIAL = 7`).

**DispositivosDisponibles:** `id_dispositivo`, `dispositivo_detectado` (timestamp of last MQTT ping, refreshed on each message).

### Utility modules

There are **two** geo/utility directories — do not confuse them:
- `utilidades/geo.py` — `distancia_metros(lat1, lng1, lat2, lng2)` — used by `service_alerta.py`
- `utils/geo.py` — `calcular_distancia(lat1, lng1, lat2, lng2)` — used by `service_historial.py` for the 10 m movement filter
- `utilidades/mongo_utils.py` — `to_str_id(id)`, `to_object_id(id)`, `ensure_str(id)`, `find_by_id_str(col, id)`, `update_by_id_str(col, id, update)` helpers

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
- `app/(app)/` — Protected drawer screens: `index` (map + live location), `alertas`, `zonas-seguras`, `historial-ubicaciones`, `grupo-familiar`, `pacientes` (patient list + edit, cuidador-only edit actions), `registro-paciente`, `vincular-dispositivo`, `perfil`
- Public routes: `login.tsx`, `register.tsx`, `register-cuidador.tsx`, `register-familiar.tsx`, `elegir-rol.tsx`

**State:** `context/AuthContext.tsx` holds `token`, `cuidador`, and `tipoUsuario` (`'cuidador' | 'familiar'`), persisted in `AsyncStorage`. On every cold start `init()` validates the stored token against the backend (`/cuidadores/perfil` or `/familiares/grupos`); if the request fails the token is cleared and the user is sent to login. The axios instance in `services/api.ts` registers a `_logoutHandler` that auto-calls `logout()` on any 401 response.

**API calls:** `services/api.ts` — a single `axios` instance with a request interceptor that attaches the Bearer token. Domain-grouped exports: `cuidadorService`, `familiarService`, `pacienteService`, `zonaService`, `alertaService`, `dispositivoService`, `grupoService`, `modoViajeService`. `familiarService.misPacientes()` calls `GET /familiares/pacientes` (the patient list for familiares); `pacienteService.listar()` is the cuidador equivalent.

**Higher-level service helpers:** `services/pacientes.tsx` wraps `pacienteService` with typed `Paciente` interfaces and error-safe functions (`listarPacientes`, `obtenerPaciente`, `tienePacientes`, etc.). Use these in screens instead of calling `pacienteService` directly when you need typed results.

**Cuidador location tracking:** `services/ubicacion.tsx` — `solicitarPermisos()`, `iniciarSeguimiento(onUbicacion)` (device GPS watch), `enviarUbicacionCuidador(grupoId, lat, lng)` (POST to `/grupos/{id}/ubicacion`), and `obtenerUbicacionesGrupo(grupoId)` (GET `/grupos/{id}/ubicaciones`). Returns `{ cuidadores, pacientes }`. Silently swallows network errors so it doesn't interrupt tracking.

**Real-time location:** `hooks/useSSEUbicacion.ts` — connects to the SSE endpoint using `react-native-sse`, auto-reconnects on error after 5 s. SSE event data uses keys `lat`/`lng` (not `latitud`/`longitud`).

**Push notifications:** The real implementation lives in `services/notificaciones.ts`; `utils/notificaciones.ts` is a re-export shim — always import from `@/services/notificaciones` or `@/utils/notificaciones` (they resolve to the same code). `registrarToken()` is called after login (fire-and-forget), `configurarListeners(onAlerta)` is called in root layout. Both are no-ops in Expo Go (require a development build for actual push delivery). `Notifications.setNotificationHandler` must be guarded by `if (!IS_EXPO_GO)` (Expo Go SDK 53+ crashes otherwise).

**Maps:** The main map (`index.tsx`) uses `react-native-webview` + Leaflet + OpenStreetMap (no API key required). Do not switch to `react-native-maps` with `PROVIDER_GOOGLE` for the main map. Marker updates use a `mapaListo` ref: the full Leaflet HTML is built once, and subsequent GPS updates are injected with `webViewRef.current?.injectJavaScript(js)` to avoid re-downloading Leaflet from CDN on every tick.

**cuidador vs familiar branching:** Every protected screen checks `tipoUsuario` from `AuthContext` and calls the appropriate endpoint. The 401 interceptor in `api.ts` calls `logout()` on any 401, so a cuidador-only endpoint called by a familiar triggers automatic logout — always use the correct endpoint for each role. Pattern:

| Screen | Cuidador endpoint | Familiar endpoint |
|---|---|---|
| `grupo-familiar` | `GET /grupos/` | `GET /familiares/grupos` |
| `historial-ubicaciones` | `GET /historial-ubicaciones/ruta/{id}` | `GET /historial-ubicaciones/ruta-familiar/{id}` |
| `alertas` | `GET /alertas/` | `GET /alertas/familiar/` |
| `zonas-seguras` | `GET /zonas-seguras/paciente/{id}` | `GET /zonas-seguras/familiar/` |
| `pacientes` | `GET /pacientes/` | `GET /familiares/pacientes` |
| modo viaje activate | `POST /modo-viaje/activar` | `POST /modo-viaje/familiar/activar` |
| modo viaje deactivate | `POST /modo-viaje/desactivar/{id}` | `POST /modo-viaje/familiar/desactivar/{id}` |
| modo viaje status | `GET /modo-viaje/{id}` | `GET /modo-viaje/familiar/{id}` |

---

## Code Conventions

- **All code in Spanish**: variable names, function names, route paths, MongoDB collection names, and field names.
- Services always return a plain `dict`; routes inspect the `"error"` key to decide the HTTP status code.
- Do not call `get_database()` at module import time inside services — always call it inside the function body (avoids startup ordering bugs).
- Frontend import alias: `@/` maps to the `Fronted/` root (e.g. `@/services/api`, `@/context/AuthContext`).
