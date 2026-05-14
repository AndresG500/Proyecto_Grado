# AGENTS.md

Quick reference for agents working on this repo.

## Running the apps

**Backend:**
```bash
cd Backend
source env/bin/activate
uvicorn app:app --reload
```

**Frontend:**
```bash
cd Fronted
npm install
npx expo start
npx expo run:android  # Android emulator
npx expo lint        # Lint
```

## Required setup

- **Backend**: Create `Backend/.env` with `MONGO_URI`, `SECRET_KEY`, `MQTT_HOST`, `MQTT_USER`, `MQTT_PASS`
- **Frontend**: Create `Fronted/.env` with `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` (Android emulator)

## Critical conventions

- **All code in Spanish** — variable names, function names, route paths, MongoDB field names
- **Services return plain dicts** — use `{"error": "msg"}` for failures; routes check for `"error"` key
- **Never call get_database() at module import time** — always call inside function body (avoids startup ordering bugs)

## Architecture basics

- Backend entrypoint: `app.py` (registers routers, starts MQTT and alert background tasks)
- Frontend uses Expo Router: `app/_layout.tsx` (auth guard), `app/(app)/` (protected routes)
- MongoDB collections: `Cuidadores`, `Pacientes`, `Dispositivos`, `ZonasSeguras`, `Alertas`, `HistorialUbicaciones`
- MQTT topic pattern: `ubilife/dispositivo/<id>/gps`

## See also

- Full details in `CLAUDE.md`
- API docs at `http://localhost:8000/docs` when backend running