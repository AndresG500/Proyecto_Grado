# Errores encontrados en pruebas — 15 de mayo 2026

Sesión de pruebas en dispositivo Android físico con Expo Go (SDK 53).

---

## 1. Error de `expo-notifications` al iniciar la app

**Síntoma:** Al abrir la app aparecía un error de módulo relacionado con `expo-notifications`. La app no cargaba correctamente.

**Causa:** `Notifications.setNotificationHandler(...)` se ejecutaba a nivel de módulo al importar `notificaciones.ts`. Expo Go SDK 53+ ya no soporta notificaciones push en tiempo de ejecución, y la llamada fallaba antes de que el componente montara.

**Archivos afectados:**
- `Fronted/services/notificaciones.ts`
- `Fronted/app/_layout.tsx`

**Solución:**
- Envolver `setNotificationHandler` en un bloque `if (!IS_EXPO_GO)` usando `Constants.appOwnership === 'expo'`
- Agregar `LogBox.ignoreLogs(['expo-notifications', ...])` en `_layout.tsx` para suprimir el warning residual

---

## 2. Warning "Each child in a list should have a unique key"

**Síntoma:** Consola mostraba advertencia de React sobre keys únicas en la pantalla de zonas seguras.

**Causa:** Al crear una zona exitosamente, el backend devuelve `{"mensaje": "Zona segura creada exitosamente"}` (no el documento creado). El frontend estaba haciendo `setZonas((z) => [...z, res.data])`, agregando ese diccionario al array. Ese objeto no tiene campo `id`, entonces React no podía generar una key válida.

**Archivos afectados:**
- `Fronted/app/(app)/zonas-seguras.tsx`

**Solución:**
- En `handleCrear`, reemplazar `setZonas((z) => [...z, res.data])` por `await cargar()` para recargar las zonas desde el backend
- En `cargar()`, agregar filtro `.filter((z: any) => !!z.id)` para descartar objetos sin `id` válido

---

## 3. `DELETE /zonas-seguras/eliminar/undefined`

**Síntoma:** Al intentar eliminar una zona, el backend recibía `DELETE /zonas-seguras/eliminar/undefined` y respondía 422.

**Causa:** La misma raíz que el error anterior — el objeto `{"mensaje": "..."}` sin `id` se había colado en el array de zonas. Al intentar eliminar, se leía `item.id` que era `undefined`.

**Archivos afectados:**
- `Fronted/app/(app)/zonas-seguras.tsx`

**Solución:** La misma del error 2 (filtro en `cargar()` + recargar después de crear). Requirió un reload completo de la app para limpiar el estado en memoria.

---

## 4. Usuario familiar cierra sesión automáticamente al navegar

**Síntoma:** Al iniciar sesión con una cuenta familiar y abrir ciertas pantallas (mapa, grupo familiar), la app cerraba sesión automáticamente sin que el usuario lo pidiera.

**Causa:** El interceptor de respuesta en `services/api.ts` escucha cualquier error 401 y llama al `_logoutHandler`. Las pantallas para cuidadores (`/pacientes/`, `/zonas-seguras/paciente/`, etc.) devuelven 401 cuando las llama un familiar porque esos endpoints usan `get_cuidador_actual`. El familiar recibía el 401, el interceptor lo interpretaba como sesión expirada y ejecutaba el logout.

**Archivos afectados:**
- `Fronted/app/(app)/index.tsx` (mapa)
- `Fronted/app/(app)/grupo-familiar.tsx`
- `Fronted/app/(app)/historial-ubicaciones.tsx`
- `Fronted/app/(app)/alertas.tsx`
- `Fronted/app/(app)/zonas-seguras.tsx`

**Solución:** Crear endpoints separados para familiares con autenticación propia (`get_familiar_actual`) y redirigir cada pantalla al endpoint correcto según `tipoUsuario`:

| Pantalla | Endpoint cuidador | Endpoint familiar |
|---|---|---|
| Grupo familiar | `GET /grupos/` | `GET /familiares/grupos` |
| Historial ubicaciones | `GET /historial-ubicaciones/ruta/{id}` | `GET /historial-ubicaciones/ruta-familiar/{id}` |
| Alertas | `GET /alertas/` | `GET /alertas/familiar/` |
| Zonas seguras | `GET /zonas-seguras/paciente/{id}` | `GET /zonas-seguras/familiar/` |

---

## 5. Familiar no podía ver el historial de ubicaciones

**Síntoma:** La pantalla de historial mostraba "Solo disponible para cuidadores" a usuarios familiares.

**Causa:** Primera corrección del error 4 fue incorrecta — se asumió que familiares no debían ver el historial.

**Archivos afectados:**
- `Fronted/app/(app)/historial-ubicaciones.tsx`
- `Backend/services/service_historial.py`
- `Backend/routes/ruta_historial.py`

**Solución:**
- Crear `obtener_historial_ubicaciones_familiar(paciente_id, familiar_id)` en el servicio, con verificación de membresía en `Grupos`
- Agregar endpoint `GET /historial-ubicaciones/ruta-familiar/{paciente_id}` protegido con `get_familiar_actual`
- En el frontend, usar `pacienteService.rutaFamiliar(id)` para familiares

---

## 6. Demora visible en la actualización de ubicación GPS en el mapa

**Síntoma:** La ubicación del dispositivo GPS tardaba en aparecer o actualizarse en el mapa, con una demora perceptible cada vez que se refrescaba.

**Causa:** El mapa usa `react-native-webview` + Leaflet cargado desde CDN. El HTML completo se regeneraba cada vez que llegaban datos nuevos (cada ~60 segundos), lo que obligaba a Leaflet a descargarse de nuevo desde CDN en cada ciclo.

**Archivos afectados:**
- `Fronted/app/(app)/index.tsx`

**Solución:** Usar una ref `mapaListo` para construir el HTML de Leaflet solo una vez. Las actualizaciones posteriores de marcadores se envían con `webViewRef.current?.injectJavaScript(js)` sin reconstruir el mapa:
```javascript
const mapaListo = useRef(false)
if (!mapaListo.current) {
  setMapHtml(buildMapHTML(...))
  mapaListo.current = true
} else {
  webViewRef.current?.injectJavaScript(`updateCuidador('${id}', ${lat}, ${lng}); true;`)
}
```

---

## 7. Errores "Uncaught (in promise)" por bloques `try-finally` sin `catch`

**Síntoma:** En la consola aparecían dos errores de promesas no capturadas al navegar como familiar a las pantallas de alertas y zonas seguras.

**Causa:** Las funciones `cargar()` en esas pantallas usaban `try-finally` sin `catch`. Cuando el request fallaba con 401, la excepción se propagaba como rechazo de promesa no manejado.

```javascript
// Antes (problemático)
const cargar = async () => {
  try {
    const res = await alertaService.listar() // lanza si 401
  } finally {
    setLoading(false)
  }
}
```

**Archivos afectados:**
- `Fronted/app/(app)/alertas.tsx`
- `Fronted/app/(app)/zonas-seguras.tsx`

**Solución:** Agregar bloque `catch` que setea el array vacío en lugar de dejar propagar el error:
```javascript
} catch {
  setAlertas([])
}
```

---

## 8. Orden de rutas en FastAPI causaba conflicto con `/{id}`

**Síntoma:** (Potencial — detectado durante el desarrollo) El endpoint `GET /alertas/familiar/` podría haber sido capturado por la ruta `GET /alertas/{alerta_id}` si se registraba después.

**Causa:** FastAPI evalúa rutas en orden de registro. Si `/{alerta_id}` se registra antes que `/familiar/`, FastAPI interpreta "familiar" como el valor del parámetro `alerta_id`.

**Archivos afectados:**
- `Backend/routes/ruta_alerta.py`
- `Backend/routes/ruta_zonasegura.py`

**Solución:** Registrar el endpoint `/familiar/` **antes** que cualquier ruta con parámetro en la misma posición del path.

---

---

## 9. Marcador duplicado del cuidador en el mapa principal

**Síntoma:** Había un cuidador en la base de datos pero aparecían dos marcadores verdes en el mapa.

**Causa:** El marcador propio del cuidador (posición GPS del teléfono) usaba `'yo'` como clave en el dict `cuidadorMarkers` de Leaflet. El backend devolvía el mismo cuidador con su ObjectId real. Al hacer `cargarDatos`, se creaba un segundo marcador con el ID real, quedando dos marcadores para la misma persona.

**Archivos afectados:**
- `Fronted/app/(app)/index.tsx`

**Solución:** Usar `cuidador?.id ?? 'yo'` (el mismo ID del backend) como clave para el marcador propio, de forma que Leaflet actualice el marcador existente en lugar de crear uno nuevo:
```javascript
const miId = cuidador?.id ?? 'yo'
const js = `updateCuidador('${miId}', ${latitude}, ${longitude}); true;`
```

---

## 10. Error "REPLACE action not handled by any navigator" al cerrar sesión

**Síntoma:** Al cerrar sesión desde el drawer o desde la pantalla de perfil, aparecía el mensaje: `The action 'REPLACE' with payload {"name":"login"}... was not handled by any navigator`.

**Causa:** Tanto `DrawerContent.tsx` como `perfil.tsx` llamaban `router.replace('/login')` después de `await logout()`. El `AuthGuard` en `_layout.tsx` ya redirige automáticamente a `/login` cuando el token se vuelve null. Las dos navegaciones chocaban.

**Archivos afectados:**
- `Fronted/components/DrawerContent.tsx`
- `Fronted/app/(app)/perfil.tsx`

**Solución:** Eliminar el `router.replace('/login')` manual de ambos archivos. El `AuthGuard` maneja la redirección automáticamente.

---

## 11. Familiares no veían ubicaciones en el mapa ni en el grupo familiar

**Síntoma:** Al iniciar sesión como familiar, el mapa no mostraba ubicaciones de cuidadores ni de otros familiares. La pantalla de grupo familiar mostraba tarjetas vacías sin ubicaciones.

**Causa (múltiple):**
- No existía una colección `UbicacionesFamiliares` en MongoDB para guardar las posiciones de los familiares.
- `cargarDatos` en `index.tsx` solo obtenía ubicaciones de cuidadores para el rol cuidador.
- No había endpoints para guardar/consultar ubicaciones de familiares.
- El grupo familiar no tenía lógica para mostrar miembros con sus ubicaciones.

**Archivos afectados:**
- `Backend/models/model_grupo.py`
- `Backend/services/service_grupo.py`
- `Backend/routes/ruta_grupo.py`
- `Fronted/services/ubicacion.tsx`
- `Fronted/services/api.ts`
- `Fronted/app/(app)/index.tsx`

**Solución:**
- Crear modelo `UbicacionFamiliar` y colección `UbicacionesFamiliares` con upsert por `familiar_id`
- Agregar endpoints: `POST /{id}/ubicacion/familiar`, `GET /{id}/ubicaciones/familiar`, `GET /{id}/miembros`, `GET /{id}/miembros/familiar`
- En `index.tsx`, agregar tracking de ubicación para familiares (similar al de cuidadores) y cargar ubicaciones desde `obtenerUbicacionesGrupoFamiliar`
- Agregar función `obtener_miembros_grupo` que une Pacientes + Familiares + UbicacionesFamiliares

---

## 12. Zonas seguras no aparecían en el mapa principal

**Síntoma:** Las zonas seguras creadas se guardaban en MongoDB y aparecían en la pantalla de zonas, pero no se dibujaban como círculos en el mapa Leaflet. Además, el botón de toggle no actualizaba el mapa.

**Causa:** El HTML de Leaflet se construye una sola vez (`mapaListo` ref). Las zonas cargadas en recargas posteriores se pasaban a `buildMapHTML` pero el mapa ya existía y no se reconstruía. No había mecanismo para añadir/actualizar círculos de zona en el mapa existente.

**Archivos afectados:**
- `Fronted/app/(app)/index.tsx`

**Solución:**
- Agregar dict `zoneCircles = {}` en el HTML de Leaflet para rastrear círculos por ID
- Agregar función `addOrUpdateZone(id, lat, lng, radio, activa)` en Leaflet que actualiza el círculo existente o crea uno nuevo
- En recargas subsiguientes, inyectar `addOrUpdateZone(...)` para cada zona en lugar de ignorarlas
- Agregar `useFocusEffect` para que al volver de la pantalla de zonas seguras el mapa se refresque inmediatamente

---

## 13. Overlay del historial mostraba "1 puntos registrados"

**Síntoma:** La tarjeta de información sobre el mapa en historial de ubicaciones decía "1 puntos registrados" en lugar de información útil.

**Causa:** El overlay mostraba solo el contador de puntos sin formato contextual.

**Archivos afectados:**
- `Fronted/app/(app)/historial-ubicaciones.tsx`

**Solución:** Rediseñar el overlay para mostrar:
- Nombre del paciente seleccionado
- Últimas coordenadas exactas (lat/lng del último punto)
- Timestamp formateado en español (`toLocaleString('es-CO', {...})`)
- Contador de puntos con contexto: `"N puntos · últimos 7 días"`

---

## 14. Pantalla de grupo familiar no mostraba miembros ni ubicaciones

**Síntoma:** La pantalla de grupo familiar mostraba información básica del grupo pero no mostraba tarjetas de pacientes ni familiares. Los familiares veían el código de invitación igual que los cuidadores.

**Causa:** No había componentes para mostrar miembros del grupo. La pantalla usaba un diseño genérico que no distinguía entre cuidadores y familiares.

**Archivos afectados:**
- `Fronted/app/(app)/grupo-familiar.tsx`
- `Fronted/services/api.ts`
- `Backend/services/service_grupo.py`
- `Backend/routes/ruta_grupo.py`

**Solución:** Rediseño completo al estilo Life360:
- Componente `PacienteCard` (ícono azul): nombre, enfermedad, última ubicación
- Componente `FamiliarCard` (ícono morado): nombre, última ubicación, etiqueta "(Tú)"
- Código de invitación solo visible para cuidadores
- Botón eliminar grupo solo para cuidadores
- Datos de miembros obtenidos desde `GET /grupos/{id}/miembros` o `GET /grupos/{id}/miembros/familiar`

---

## 15. Tarjetas de familiar y paciente mostraban "Sin ubicación reciente" siempre

**Síntoma:** En la pantalla de grupo familiar, las tarjetas de paciente y familiar siempre mostraban "Sin ubicación reciente" aunque el familiar tuviera el GPS activo.

**Causa:** La ubicación del familiar solo se enviaba al backend cuando tenía el **mapa principal** abierto (`index.tsx`). Si el familiar iba directamente a la pantalla de grupo familiar sin pasar por el mapa, `UbicacionesFamiliares` estaba vacío.

**Archivos afectados:**
- `Fronted/app/(app)/grupo-familiar.tsx`

**Solución:** En `cargarDatos` de grupo-familiar, antes de cargar los miembros:
1. Solicitar permisos de GPS
2. Obtener ubicación actual con `Location.getCurrentPositionAsync`
3. Enviar a todos los grupos con `enviarUbicacionFamiliar`
4. Luego cargar miembros (ya incluyen la ubicación recién enviada)

También se agregó `useFocusEffect` y `RefreshControl` (pull-to-refresh).

---

## 16. AxiosError al activar/desactivar zona segura

**Síntoma:** Al desactivar y luego reactivar una zona segura, aparecía un crash con call stack de `AxiosError` que cubría toda la pantalla.

**Causa:** `handleToggle` y `handleEliminar` en `zonas-seguras.tsx` no tenían `try/catch`. Cualquier error HTTP (403, timeout, 429) se propagaba como excepción no capturada, y React Native la mostraba como overlay de error. Tampoco había protección contra doble-tap.

**Archivos afectados:**
- `Fronted/app/(app)/zonas-seguras.tsx`

**Solución:**
- Agregar `try/catch` en `handleToggle` y `handleEliminar` con `Alert.alert` en el catch
- Agregar estado `toggling` (ID de la zona en proceso) para deshabilitar el botón durante la request y mostrar spinner
- Prevenir doble-tap con `if (toggling) return` al inicio de `handleToggle`

---

## 17. Error 429 Too Many Requests en login del familiar

**Síntoma:** Al intentar iniciar sesión como familiar después de varios intentos fallidos, el backend respondía `429 Too Many Requests` y la app mostraba "Too many requests. Try again later."

**Causa:** El rate limiter estaba configurado en **30 requests por 60 segundos por IP**. Durante pruebas, los intentos de login fallidos + las requests automáticas del mapa (4-6 por ciclo cada 60s) + la navegación entre pantallas agotaban el cupo en segundos.

**Archivos afectados:**
- `Backend/app.py`

**Solución:** Aumentar `RATE_LIMIT` de 30 a **120 requests/60s**. Sigue siendo protección efectiva contra abuso pero no bloquea el uso normal durante desarrollo y pruebas.

---

## 18. expo-notifications: error de módulo en Expo Go SDK 53

**Síntoma:** Al iniciar la app en Expo Go, aparecía en consola:
```
ERROR expo-notifications: Android Push notifications (remote notifications) functionality 
provided by expo-notifications was removed from Expo Go with the release of SDK 53.
```
Con call stack apuntando a la línea 1 de `notificaciones.ts`.

**Causa:** El `import * as Notifications from 'expo-notifications'` estático al inicio del módulo ejecuta el código de inicialización de expo-notifications inmediatamente, incluso en Expo Go donde el módulo ya no tiene soporte. En la sesión anterior se guardó `setNotificationHandler` con un guard `if (!IS_EXPO_GO)`, pero el import mismo seguía disparando el error.

**Archivos afectados:**
- `Fronted/services/notificaciones.ts`

**Solución:** Reemplazar el import estático por un `require` condicional que solo ejecuta en non-Expo-Go:
```typescript
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const Notifications = IS_EXPO_GO ? null : require('expo-notifications');
```
Todas las referencias al módulo usan `Notifications?.method()` o verifican `if (!Notifications)`.

---

## 19. Mapa mostraba "Sin conexión" al navegar entre pantallas

**Síntoma:** Estando en la sesión del cuidador, al navegar a la pantalla de "Registrar paciente", el badge del mapa cambiaba de "En línea" a "Sin conexión".

**Causa:** Consecuencia del error 17 (rate limiter). El intervalo de 60 segundos en `index.tsx` disparaba `cargarDatos` mientras el rate limit estaba agotado. Las requests devolvían 429, Axios lanzaba excepción, y el bloque `catch { setOnline(false) }` interpretaba el 429 como pérdida de conectividad.

**Archivos afectados:**
- `Backend/app.py` (misma solución que error 17)

**Solución:** Al aumentar el rate limit a 120, el intervalo ya no agota el cupo y las requests del mapa no fallan.

---

## 20. Zonas seguras no visibles para familiares en el mapa principal

**Síntoma:** Los familiares podían ver la lista de zonas en la pantalla "Zonas seguras", pero al abrir el mapa principal no se dibujaban los círculos de las zonas.

**Causa:** En `cargarDatos` de `index.tsx`, la carga de zonas estaba dentro de `if (tipoUsuario !== 'familiar')`. Para familiares, `todasZonas` siempre era `[]` y el mapa se construía sin círculos.

**Archivos afectados:**
- `Fronted/app/(app)/index.tsx`

**Solución:** Agregar rama `else` para familiares que carga zonas con `zonaService.listarFamiliar()`:
```javascript
if (tipoUsuario === 'familiar') {
    const rz = await zonaService.listarFamiliar()
    todasZonas.push(...(Array.isArray(rz.data) ? rz.data : []))
} else {
    // carga por paciente (comportamiento anterior del cuidador)
}
```

---

## Resumen de archivos modificados

### Backend
| Archivo | Cambio | Errores |
|---|---|---|
| `app.py` | Rate limit 30 → 120 req/60s | #17, #19 |
| `routes/ruta_alerta.py` | Endpoint `GET /familiar/` con `get_familiar_actual` | #4 |
| `routes/ruta_zonasegura.py` | Endpoint `GET /familiar/` con `get_familiar_actual`; ordenamiento de rutas | #4, #8 |
| `routes/ruta_historial.py` | Endpoint `GET /ruta-familiar/{id}` con `get_familiar_actual` | #5 |
| `routes/ruta_grupo.py` | Endpoints `miembros`, `miembros/familiar`, `ubicacion/familiar`, `ubicaciones/familiar` | #11, #14 |
| `services/service_alerta.py` | `listar_alertas_familiar(familiar_id)` | #4 |
| `services/service_zonasegura.py` | `obtener_zonas_familiar(familiar_id)` | #4 |
| `services/service_historial.py` | `obtener_historial_ubicaciones_familiar(paciente_id, familiar_id)` | #5 |
| `services/service_grupo.py` | `guardar_ubicacion_familiar`, `obtener_ubicaciones_grupo_familiar`, `obtener_miembros_grupo` | #11, #14 |
| `models/model_grupo.py` | Modelo `UbicacionFamiliar` | #11 |

### Frontend
| Archivo | Cambio | Errores |
|---|---|---|
| `services/api.ts` | `rutaFamiliar`, `listarFamiliar`, `grupoService.miembros/miembrosFamiliar` | #4, #14 |
| `services/notificaciones.ts` | `require` condicional en lugar de import estático | #1, #18 |
| `services/ubicacion.tsx` | `enviarUbicacionFamiliar`, `obtenerUbicacionesGrupoFamiliar` | #11 |
| `app/_layout.tsx` | `LogBox.ignoreLogs` para suprimir warning de notificaciones | #1 |
| `app/(app)/index.tsx` | `mapaListo` ref; `zoneCircles`/`addOrUpdateZone`; tracking familiar; zonas para familiar; `useFocusEffect` | #6, #9, #12, #20 |
| `app/(app)/alertas.tsx` | Branch por `tipoUsuario`; catch en `cargar()`; ocultar botón resolver | #4, #7 |
| `app/(app)/zonas-seguras.tsx` | Branch por `tipoUsuario`; catch con try/catch en toggle/eliminar; estado `toggling` | #2, #3, #4, #7, #16 |
| `app/(app)/historial-ubicaciones.tsx` | Branch por `tipoUsuario`; overlay rediseñado con nombre y coordenadas | #5, #13 |
| `app/(app)/grupo-familiar.tsx` | Rediseño completo: `PacienteCard`/`FamiliarCard`; location tracking; `useFocusEffect`; pull-to-refresh | #14, #15 |
| `components/DrawerContent.tsx` | Eliminar `router.replace('/login')` manual | #10 |
| `app/(app)/perfil.tsx` | Eliminar `router.replace('/login')` manual | #10 |
