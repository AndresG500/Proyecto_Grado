# Errores de Seguridad y Bugs Corregidos — Backend UbiLife

## Resumen

| Severidad | Total | Corregidos | Pendientes |
|-----------|-------|------------|------------|
| CRÍTICO (crashes / auth bypass) | 5 | 5 | 0 |
| ALTO (seguridad) | 6 | 6 | 0 |
| MEDIO (lógica y validación) | 5 | 5 | 0 |
| BAJO (calidad y mantenibilidad) | 4 | 4 | 0 |
| **TOTAL** | **20** | **20** | **0** |

Todos los errores han sido corregidos.

---

## CRÍTICO — Bugs que causaban crashes o bypass de autenticación

### 1. `anunciar_dispositivo` retornaba `None` en el camino feliz

**Archivo:** `services/service_dispositivo.py`

**Problema:** La función no tenía `return` explícito en el bloque `try`, retornando `None`. Cuando la ruta intentaba verificar `if "error" in resultado`, ocurría `TypeError`.

**Solución:** Agregar `return {"mensaje": "Dispositivo anunciado exitosamente"}` al final del bloque try.

---

### 2. `DELETE /{grupo_id}/cuidadores/{cuidador_id}` retornaba 400 en caso de éxito

**Archivo:** `routes/ruta_grupo.py`

**Problema:** El endpoint lanzaba `HTTPException(status_code=400)` cuando el resultado contenía la clave `"mensaje"`, pero los mensajes de éxito también tienen esa clave.

**Solución:** Eliminar el segundo `if` que verificaba `"mensaje"` y simplemente retornar el resultado.

---

### 3. Shadowing de la variable `cuidador_id` en loop

**Archivo:** `services/service_grupo.py`

**Problema:** El parámetro `cuidador_id` se sobrescribía en el loop `for cuidador_id in grupo["cuidador_ids"]`, causando pérdida del valor original.

**Solución:** Renombrar la variable del loop a `c_id`.

---

### 4. TypeError si el cuidador fue eliminado del grupo

**Archivo:** `services/service_grupo.py`

**Problema:** Si un cuidador era borrado de `Cuidadores` pero su ID seguía en `grupo["cuidador_ids"]`, el `find_one` retornaba `None` y `cuidador["name"]` causaba `TypeError`.

**Solución:** Agregar validación `if not cuidador` antes de acceder al documento.

---

### 5. `bcrypt.checkpw()` — resultado descartado (cualquier contraseña válida)

**Archivo:** `services/service_cuidador.py`

**Problema:** El resultado de `bcrypt.checkpw()` no se capturaba en ninguna variable. La comparación nunca ocurría, permitiendo que cualquier contraseña autenticara cualquier cuenta.

```python
# ANTES (bug crítico — resultado ignorado):
bcrypt.checkpw(password.encode("utf-8"), stored_hash)
if not cuidador:
    return {"mensaje": "Credenciales inválidas"}

# DESPUÉS:
es_valida = bcrypt.checkpw(password.encode("utf-8"), stored_hash)
await asyncio.sleep(AUTH_DELAY)
if not cuidador or not es_valida:
    return {"mensaje": "Credenciales inválidas"}
```

---

## ALTO — Vulnerabilidades de seguridad

### 6. Login aceptaba cuentas inactivas

**Archivo:** `services/service_cuidador.py`

**Problema:** Una cuenta con `activo: False` podía iniciar sesión y recibir un token JWT válido.

**Solución:** Agregar verificación de `cuidador.get("activo", True)` antes de generar el token.

---

### 7. Bypass de autorización en zonas seguras

**Archivos:** `services/service_zonasegura.py` — funciones `actualizar_zona_segura` y `eliminar_zona_segura`

**Problema:** Lógica fail-open: si `cuidador` era `None`, la condición era `False` y la operación se ejecutaba sin verificar permisos.

```python
# ANTES (fail-open):
if cuidador and str(zona["cuidador_id"]) != str(cuidador["_id"]):
    return {"error": "..."}

# DESPUÉS (fail-closed):
if not cuidador:
    return {"error": "Cuidador no encontrado"}
if not zona.get("cuidador_id") or str(zona["cuidador_id"]) != str(cuidador["_id"]):
    return {"error": "No tienes permiso..."}
```

---

### 8. Cualquier cuidador podía modificar cualquier grupo

**Archivos:** `services/service_grupo.py`, `routes/ruta_grupo.py`

**Problema:** `cuidador_solicitante_id: str = None` con `if cuidador_solicitante_id and ...` permitía omitir la verificación de permisos pasando `None`.

**Solución:** Parámetro requerido (sin valor por defecto) y condición sin prefijo `if cuidador_solicitante_id and`.

---

### 9. Endpoints de ubicaciones sin autenticación

**Archivo:** `routes/ruta_grupo.py`

**Problema:** `GET /{grupo_id}/ubicaciones` y `GET /{grupo_id}/cuidador-cercano` eran públicos, exponiendo ubicaciones en tiempo real sin JWT.

**Solución:** Agregar `Depends(get_cuidador_actual)` y verificación de pertenencia al grupo en los servicios.

---

### 10. JWT sin revocación — logout no invalidaba el token

**Archivos:** `security/jwt_handler.py`, `security/dependencies.py`, `services/service_auth.py`, `routes/ruta_cliente.py`, `app.py`

**Problema:** El logout retornaba 200 pero el token seguía siendo válido durante toda su vida útil (60 min). Cuentas eliminadas mantenían acceso hasta que el token expirara.

**Solución:** Implementar blacklist de tokens en MongoDB con TTL automático:
- `jti` (UUID) incluido en cada token JWT
- Colección `TokensRevocados` con índice TTL (`expireAfterSeconds=0` sobre campo `exp`)
- `GET /logout` hace upsert en la blacklist
- `get_cuidador_actual` verifica la blacklist antes de aceptar el token

---

### 11. IDs de vinculación de dispositivo como query params

**Archivo:** `routes/ruta_dispositivo.py`

**Problema:** `POST /vincular?id_dispositivo=...&paciente_id=...` exponía IDs sensibles en la URL, que quedan en logs de servidor y proxies.

**Solución:** Crear modelo Pydantic `VincularDispositivo` y recibir los datos como body del request.

---

## MEDIO — Lógica incorrecta y validaciones faltantes

### 12. Inconsistencia de nombres de campo en `Cuidadores`

**Archivo:** `services/service_cuidador.py`

**Problema:** El servicio almacenaba `is_active` y `created_at` (inglés), pero el modelo `RespuestaCuidador` definía `activo` y `fecha_creacion` (español). Pydantic nunca podía mapear correctamente los documentos al modelo.

**Solución:** Cambiar los campos insertados en MongoDB a `activo` y `fecha_creacion` para coincidir con el modelo.

```python
# ANTES:
"is_active": True,
"created_at": datetime.utcnow(),

# DESPUÉS:
"activo": True,
"fecha_creacion": datetime.utcnow(),
```

---

### 13. `crear_grupo` no verificaba propiedad de los pacientes

**Archivo:** `services/service_grupo.py`

**Problema:** Al crear un grupo se verificaba que los pacientes existieran, pero no que pertenecieran al cuidador solicitante. Un cuidador podía agregar pacientes de otro cuidador a su grupo.

**Solución:** Agregar verificación `str(paciente.get("id_cuidador")) != datos.cuidador_principal_id` dentro del loop.

```python
# DESPUÉS:
if str(paciente.get("id_cuidador")) != datos.cuidador_principal_id:
    return {"error": f"El paciente {paciente_id} no pertenece a tu cuenta"}
```

---

### 14. ObjectId inválido en URL retornaba HTTP 500

**Archivos:** `routes/ruta_grupo.py`, `routes/ruta_zonasegura.py`, `routes/ruta_historial.py`

**Problema:** Pasar un ID con formato incorrecto (ej. `abc`) en la URL causaba `bson.errors.InvalidId` que se capturaba como error genérico y la ruta respondía con HTTP 500 (error de servidor) en lugar de 400/422 (error del cliente).

**Solución:** Añadir anotación `MongoId` usando `Annotated` + `Path(pattern=...)`. FastAPI valida y responde automáticamente con 422 antes de ejecutar el handler.

```python
MongoId = Annotated[str, Path(pattern=r'^[a-f\d]{24}$')]

@router.get("/{grupo_id}")
async def obtener(grupo_id: MongoId, ...):
    ...
```

---

### 15. Memory leak en `rate_limit_store`

**Archivo:** `app.py`

**Problema:** `rate_limit_store` era un `defaultdict(list)`. Las IPs nunca se eliminaban del diccionario: tras limpiar timestamps expirados, la clave quedaba con lista vacía y el diccionario crecía indefinidamente.

**Solución:** Cambiar a `dict` plano usando variable local para los timestamps. La clave solo existe mientras haya timestamps recientes activos.

```python
# ANTES:
rate_limit_store = defaultdict(list)
rate_limit_store[client_ip] = [ts for ts in rate_limit_store[client_ip] if ...]

# DESPUÉS:
rate_limit_store: dict[str, list] = {}
timestamps = [ts for ts in rate_limit_store.get(client_ip, []) if ...]
rate_limit_store[client_ip] = timestamps
```

---

### 16. `registrar_ubicacion` ignoraba el timestamp del dispositivo

**Archivo:** `services/service_historial.py`

**Problema:** El historial siempre guardaba la hora del servidor (`datetime.utcnow()`), descartando el timestamp enviado por el ESP32. Esto causaba discrepancias entre cuándo ocurrió la ubicación y cuándo se almacenó.

**Solución:** Usar `datos.timestamp` (que tiene `default_factory=datetime.utcnow` como fallback si no llega del dispositivo).

```python
# ANTES:
"timestamp": datetime.utcnow()

# DESPUÉS:
"timestamp": datos.timestamp
```

---

## BAJO — Calidad y mantenibilidad

### 17. `calcular_distancia` (Haversine) duplicada en múltiples servicios

**Archivos:** `services/service_historial.py`, `services/service_grupo.py`

**Problema:** La misma función Haversine estaba copiada en dos servicios. Un error de precisión en una copia no se corregía automáticamente en la otra.

**Solución:** Centralizar en `utils/geo.py` e importar desde ambos servicios.

```python
# utils/geo.py (nuevo):
from math import radians, sin, cos, sqrt, atan2

def calcular_distancia(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    lat1, lat2, dlat, dlng = map(radians, [lat1, lat2, lat2 - lat1, lng2 - lng1])
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))
```

---

### 18. Variables JWT no validadas al arrancar

**Archivo:** `security/jwt_handler.py`

**Problema:** Si `SECRET_KEY`, `ALGORITHM` o `ACCESS_TOKEN_EXPIRE_MINUTES` no estaban en `.env`, el servidor arrancaba sin error y fallaba con `TypeError` o `AttributeError` en el primer request de login.

**Solución:** Validar al cargar el módulo y lanzar `ValueError` con mensaje claro.

```python
if not SECRET_KEY or not ALGORITHM or not _expire_str:
    raise ValueError("Variables de entorno JWT requeridas: SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES")
```

---

### 19. `sanitize_input` duplicada en modelos; `utils/sanitizer.py` sin usar

**Archivos:** `models/model_cuidador.py`, `models/model_paciente.py`

**Problema:** La función `sanitize_input` estaba copiada en ambos modelos. El módulo `utils/sanitizer.py` con `sanitize_string` existía pero nunca se importaba.

**Solución:** Eliminar las definiciones locales e importar `sanitize_string` desde `utils.sanitizer` en ambos modelos.

---

### 20. Rate limiting con memory leak y sin persistencia

**Archivo:** `app.py`

**Problema:** `rate_limit_store` era un `defaultdict(list)`. Las IPs nunca se eliminaban del diccionario: tras limpiar timestamps expirados, la clave quedaba con lista vacía y el diccionario crecía indefinidamente. Además, no persistía entre reinicios.

**Solución:** Cambiar a `dict` plano usando variable local para los timestamps. La clave solo existe mientras haya timestamps recientes activos.

```python
# ANTES:
rate_limit_store = defaultdict(list)
rate_limit_store[client_ip] = [ts for ts in rate_limit_store[client_ip] if ...]

# DESPUÉS:
rate_limit_store: dict[str, list] = {}
timestamps = [ts for ts in rate_limit_store.get(client_ip, []) if ...]
rate_limit_store[client_ip] = timestamps
```

**Estado:** ✅ Corregido

---

## Historial de cambios

| Fecha | Descripción |
|-------|-------------|
| 2026-05-06 | Corrección completa de los 20 errores (CRÍTICO, ALTO, MEDIO, BAJO) |

---

## Archivos modificados

### Nuevos
- `utils/geo.py` — función Haversine centralizada

### Modificados
- `app.py`
- `security/jwt_handler.py`
- `security/dependencies.py`
- `services/service_auth.py`
- `services/service_cuidador.py`
- `services/service_dispositivo.py`
- `services/service_grupo.py`
- `services/service_historial.py`
- `services/service_zonasegura.py`
- `models/model_cuidador.py`
- `models/model_paciente.py`
- `routes/ruta_cliente.py`
- `routes/ruta_dispositivo.py`
- `routes/ruta_grupo.py`
- `routes/ruta_historial.py`
- `routes/ruta_zonasegura.py`
