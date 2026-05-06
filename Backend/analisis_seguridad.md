# Análisis de Seguridad y Bugs — Backend UbiLife

## Resumen Ejecutivo

| Nivel | Crítico | Alto | Medio | Bajo |
|-------|---------|------|-------|------|
| Total | 5 | 6 | 5 | 4 |

---

## CRITICO — Crashes en tiempo de ejecución

---

### 1. `app.py` — Dos funciones `lifespan` definidas (la primera nunca se ejecuta)

**Ubicación:** `app.py:29-51`

`app.py` define `lifespan` dos veces. Python usa la segunda definición, la que solo lanza la tarea de alertas pero **nunca inicializa ni cierra la base de datos**. La conexión a MongoDB queda sin inicializar vía lifespan, y `close_database()` nunca se llama al apagar el servidor.

```python
# Esta función es ignorada completamente
@asynccontextmanager
async def lifespan(app: FastAPI):
    get_database()
    yield
    await close_database()

# Esta sobreescribe la anterior — no hace DB init ni close
@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(tarea_alertas())
    yield
```

**Fix:** Fusionarlas en una sola función.

---

### 2. `service_dispositivo.py` — `anunciar_dispositivo` retorna `None` en el camino feliz

**Ubicación:** `service_dispositivo.py:155-167`

La función no tiene `return` explícito cuando todo va bien. La ruta en `ruta_dispositivo.py:93-95` hace:

```python
resultado = await service_dispositivo.anunciar_dispositivo(id_dispositivo)
if "error" in resultado:  # TypeError: 'NoneType' is not iterable → CRASH
```

**Fix:** Agregar `return {"mensaje": "Dispositivo anunciado exitosamente"}` al final de la función.

---

### 3. `ruta_grupo.py` — El endpoint `DELETE /{grupo_id}/cuidadores/{cuidador_id}` retorna 400 en caso de ÉXITO

**Ubicación:** `ruta_grupo.py:87-88`

```python
resultado = await eliminar_cuidador(grupo_id, cuidador_id)
if "error" in resultado:
    raise HTTPException(status_code=403, detail=resultado["error"])
if "mensaje" in resultado:                                # ← siempre se cumple en éxito
    raise HTTPException(status_code=400, detail=resultado["mensaje"])  # ← 400 en éxito
```

El mensaje de éxito `"Cuidador eliminado del grupo exitosamente"` también contiene la clave `"mensaje"`, por lo que el endpoint **siempre** responde 400, incluso cuando la operación fue exitosa.

**Fix:** Verificar el contenido del mensaje antes de lanzar la excepción, o restructurar la lógica para que el éxito no caiga en esa rama.

---

### 4. `service_grupo.py` — Shadowing de la variable `cuidador_id`

**Ubicación:** `service_grupo.py:84`

```python
async def eliminar_grupo(grupo_id: str, cuidador_id: str):  # parámetro del solicitante
    ...
    if str(grupo.get("cuidador_principal_id")) != cuidador_id:  # ← correcto aquí
        return {"error": "No tienes permiso..."}

    for cuidador_id in grupo["cuidador_ids"]:  # ← SOBREESCRIBE el parámetro
        await col_cuidadores.update_one(...)
```

Después del `for`, `cuidador_id` ya no es el del solicitante sino el último elemento de la lista. Si se añade código después del loop que use `cuidador_id` como validación, el bug se activará silenciosamente.

**Fix:** Renombrar la variable del loop, por ejemplo `for c_id in grupo["cuidador_ids"]:`.

---

### 5. `service_grupo.py` — `KeyError`/`TypeError` si el cuidador fue eliminado

**Ubicación:** `service_grupo.py:313-319`

```python
cuidador = await col_cuidadores.find_one({"_id": ObjectId(mas_cercano)})
return {
    "nombre": cuidador["name"],  # TypeError si cuidador es None
}
```

Si un cuidador fue borrado de la colección pero aún está en `grupo["cuidador_ids"]`, `find_one` retorna `None` y la siguiente línea crashea con `TypeError`.

**Fix:** Agregar validación `if not cuidador: continue` antes de acceder al documento.

---

## ALTO — Fallos de seguridad

---

### 6. JWT sin revocación — Logout no invalida el token

**Ubicación:** `ruta_cliente.py:43-45`

```python
@router.post("/logout")
async def logout(cuidador_actual = Depends(get_cuidador_actual)):
    return {"mensaje": "Sesión cerrada exitosamente"}
```

El token sigue siendo válido durante toda su vida útil (60 minutos) después del logout. Una cuenta eliminada con `borrar_cuidador` igualmente tiene una ventana de 60 minutos donde su token es aceptado.

**Fix:** Implementar una blacklist de tokens en Redis o en MongoDB; verificar la blacklist dentro de `get_cuidador_actual`.

---

### 7. `service_zonasegura.py` — Bypass de autorización en actualizar y eliminar zonas

**Ubicación:** `service_zonasegura.py:123-127` y `160-164`

```python
if zona.get("cuidador_id"):
    cuidador = await db["Cuidadores"].find_one({"email": cuidador_email})
    if cuidador and str(zona["cuidador_id"]) != str(cuidador["_id"]):
        return {"error": "No tienes permiso..."}
    # Si cuidador es None → la condición "if cuidador" falla y SE PROCEDE igualmente
```

La lógica es `if cuidador AND mismatch → denegar`. Si el cuidador no se encuentra, la condición es `False` y la actualización/eliminación **se ejecuta sin verificar permisos**.

**Fix:** Cambiar la lógica a `if not cuidador: return {"error": ...}` como paso previo a la verificación de ownership.

---

### 8. `ruta_grupo.py` — Cualquier cuidador autenticado puede modificar cualquier grupo

**Ubicación:** `ruta_grupo.py:64-103`

Los endpoints `POST /{grupo_id}/cuidadores` y `POST /{grupo_id}/pacientes` no verifican si el solicitante es el `cuidador_principal` del grupo antes de agregar miembros. Cualquier cuidador autenticado puede añadir o intentar remover integrantes de un grupo que no le pertenece.

**Fix:** En los servicios `agregar_cuidador` y `agregar_paciente`, verificar que el solicitante sea el `cuidador_principal_id` del grupo antes de proceder.

---

### 9. `service_cuidador.py` — Login ignora el campo `is_active`

**Ubicación:** `service_cuidador.py:103-125`

```python
cuidador = await coleccion.find_one({"email": email})
# ... verifica contraseña
token = crear_token({"sub": cuidador["email"]})  # ← no verifica is_active
```

Una cuenta desactivada (`is_active: False`) puede seguir autenticándose y recibir tokens válidos.

**Fix:** Agregar `if not cuidador.get("is_active"): return {"mensaje": "Credenciales inválidas"}` antes de generar el token.

---

### 10. Endpoints públicos sin autenticación exponen o modifican datos de pacientes

**Ubicación:** `ruta_historial.py:12`, `ruta_dispositivo.py:91`, `ruta_grupo.py:108-130`

Los siguientes endpoints no requieren JWT:
- `POST /historial-ubicaciones/registrar` — Cualquiera puede insertar coordenadas GPS falsas para cualquier `paciente_id`.
- `POST /dispositivos/anunciar` — Cualquiera puede registrar dispositivos como disponibles.
- `GET /grupos/{grupo_id}/ubicaciones` — Expone ubicaciones reales de pacientes y cuidadores.
- `GET /grupos/{grupo_id}/cuidador-cercano` — Expone nombre y distancia de cuidadores.

**Fix:** Evaluar cuáles deben permanecer públicos (dispositivos IoT) y proteger con API key o JWT los que expongan datos de usuarios.

---

### 11. `ruta_dispositivo.py` — IDs sensibles enviados como query parameters en un POST

**Ubicación:** `ruta_dispositivo.py:77-86`

```python
@router.post("/vincular")
async def vincular_dispositivo(
    id_dispositivo: str,   # FastAPI lo toma como query param
    paciente_id: str,      # FastAPI lo toma como query param
    ...
```

Los IDs quedan expuestos en la URL (`/vincular?id_dispositivo=...&paciente_id=...`), que es registrada en logs de servidor y proxies.

**Fix:** Crear un modelo Pydantic con ambos campos y recibirlo como body del request.

---

## MEDIO — Bugs lógicos e inconsistencias

---

### 12. `service_cuidador.py` — Inconsistencia de campos entre la base de datos y los modelos Pydantic

**Ubicación:** `service_cuidador.py:27-35`, `models/model_cuidador.py:30-37`

El servicio guarda `"is_active"` y `"created_at"` en MongoDB, pero el modelo `RespuestaCuidador` define los campos como `activo` y `fecha_creacion`. Si se intenta usar el modelo para parsear documentos de la DB, los campos tendrán su valor por defecto en vez del valor real.

---

### 13. `service_grupo.py` — No verifica ownership de los pacientes al crear un grupo

**Ubicación:** `service_grupo.py:30-34`

Al crear un grupo se verifican que los `paciente_ids` existan, pero no que pertenezcan al cuidador solicitante. Cualquier cuidador puede crear un grupo incluyendo pacientes de otro cuidador.

---

### 14. ObjectId inválido retorna HTTP 500 en lugar de 400

**Ubicación:** Todos los servicios que usan `ObjectId(id)`

Un `paciente_id` con formato inválido (ej. `"abc"`) dispara `bson.errors.InvalidId`, capturada por el `except Exception` y mapeada como HTTP 500. Debería ser un 400 o 422 ya que el error es del cliente.

**Fix:** Agregar un helper que valide el formato antes de construir el `ObjectId`, y retornar `{"error": "ID inválido"}` con el código apropiado.

---

### 15. `rate_limit_store` en `app.py` — Memory leak gradual

**Ubicación:** `app.py:19`

```python
rate_limit_store = defaultdict(list)
```

Las claves (IPs) nunca se eliminan del diccionario. Los timestamps dentro de cada lista sí se purgan en cada request, pero la clave permanece incluso cuando la lista queda vacía. Con muchas IPs únicas el diccionario crece indefinidamente en memoria.

---

### 16. `service_historial.py` — `registrar_ubicacion` guarda el timestamp del servidor, no del dispositivo

**Ubicación:** `service_historial.py:55-59`

```python
await col_historial.insert_one({
    ...
    "timestamp": datetime.utcnow()  # ← ignora datos.timestamp del modelo
})
```

El modelo `HistorialUbicacionBase` incluye el campo `timestamp` que envía el dispositivo, pero el servicio lo descarta y usa la hora del servidor. Si hay latencia de red o el dispositivo envía datos en batch, los registros quedan con timestamps incorrectos.

---

## BAJO

---

### 17. `calcular_distancia` duplicada en tres archivos

**Ubicación:** `service_historial.py:12`, `service_grupo.py:9`, `service_zonasegura.py:10`

La fórmula Haversine está implementada tres veces con pequeñas diferencias de estilo. Si se corrige un bug en una copia, las otras quedan desactualizadas.

**Fix:** Moverla a `utils/geo.py` e importarla desde los tres servicios.

---

### 18. `jwt_handler.py` — Variables de entorno sin validación al iniciar

**Ubicación:** `security/jwt_handler.py:8-10`

```python
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
```

Si alguna variable falta en `.env`, `SECRET_KEY` será `None` (tokens se firman con `None`) o se lanza un `TypeError` en el `int()`. El servidor puede arrancar sin errores visibles pero con JWT completamente roto.

**Fix:** Validar al inicio con `if not SECRET_KEY: raise ValueError(...)`.

---

### 19. `model_paciente.py` — `sanitize_input` definida localmente y duplicada

**Ubicación:** `models/model_cuidador.py:7-11`, `models/model_paciente.py:17-21`

La función `sanitize_input` está definida en ambos archivos de modelos con código idéntico. Ya existe `utils/sanitizer.py` con funciones de sanitización más completas que no se usan.

**Fix:** Eliminar las definiciones locales e importar desde `utils/sanitizer.py`.

---

### 20. Rate limiting no persiste entre reinicios del servidor

**Ubicación:** `app.py:19`

El `rate_limit_store` es un dict en memoria. Cada reinicio del proceso lo borra, permitiendo eludir el rate limit reiniciando el servidor o en despliegues con múltiples workers.

**Fix:** Para producción, migrar a Redis con `slowapi` o similar.

---

## Resumen de Prioridades

| # | Prioridad | Problema | Archivo |
|---|-----------|----------|---------|
| 1 | CRITICO | Doble `lifespan`, DB no se inicializa/cierra | `app.py` |
| 2 | CRITICO | `anunciar_dispositivo` retorna `None` → crash | `service_dispositivo.py` |
| 3 | CRITICO | `DELETE /cuidadores/{id}` retorna 400 en éxito | `ruta_grupo.py` |
| 4 | CRITICO | Shadowing de `cuidador_id` en loop | `service_grupo.py` |
| 5 | CRITICO | `TypeError` si cuidador fue borrado del grupo | `service_grupo.py` |
| 6 | ALTO | JWT sin revocación, logout no invalida token | `ruta_cliente.py` |
| 7 | ALTO | Bypass de autorización en zonas seguras | `service_zonasegura.py` |
| 8 | ALTO | Cualquier cuidador puede modificar cualquier grupo | `ruta_grupo.py` |
| 9 | ALTO | Login no verifica `is_active` | `service_cuidador.py` |
| 10 | ALTO | Endpoints públicos exponen ubicaciones de pacientes | `ruta_historial.py`, `ruta_grupo.py` |
| 11 | ALTO | IDs como query params en POST | `ruta_dispositivo.py` |
| 12 | MEDIO | Inconsistencia `is_active`/`activo`, `created_at`/`fecha_creacion` | `service_cuidador.py` |
| 13 | MEDIO | Sin verificación de ownership en `paciente_ids` al crear grupo | `service_grupo.py` |
| 14 | MEDIO | ObjectId inválido da HTTP 500 en vez de 400 | Todos los servicios |
| 15 | MEDIO | Memory leak en `rate_limit_store` | `app.py` |
| 16 | MEDIO | Timestamp del dispositivo ignorado en historial | `service_historial.py` |
| 17 | BAJO | `calcular_distancia` triplicada | 3 archivos de servicios |
| 18 | BAJO | Variables de entorno JWT sin validación al arrancar | `jwt_handler.py` |
| 19 | BAJO | `sanitize_input` duplicada, `utils/sanitizer.py` ignorado | modelos |
| 20 | BAJO | Rate limiting no persiste entre reinicios | `app.py` |
