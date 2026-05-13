# Reporte de Errores y Correcciones — Frontend UbiLife

> **Fecha:** 12 de mayo de 2026
> **Proyecto:** UbiLife Frontend (Expo SDK 54)
> **Archivos afectados:** `app.json`, `package.json`, `app/_layout.tsx`, `app/(app)/historial-ubicaciones.tsx`, `app/(app)/elegir-rol.tsx`, `services/api.ts`, `services/localDb.ts`, `data/mockDb.json`, `components/DrawerContent.tsx`

---

## 1. Error: Bundling failed — `react-native-maps` incompatible con web

### Descripción del error

```
Metro error: Importing native-only module "react-native/Libraries/Utilities/codegenNativeCommands" on web
from: node_modules\react-native-maps\lib\MapMarkerNativeComponent.js

Import stack:
  node_modules\react-native-maps\lib\MapMarkerNativeComponent.js
    → import "react-native/Libraries/Utilities/codegenNativeCommands"
      ^ Importing react-native internals is not supported on web.

  node_modules\react-native-maps\lib\MapMarker.js
    → import "./MapMarkerNativeComponent"

  node_modules\react-native-maps\lib\index.js
    → import "./MapMarker"

  app\(app)\zonas-seguras.tsx
    → import "react-native-maps"

  app (require.context)
```

**Error en pantalla:** Pantalla azul con mensaje de bundling fallido.

### ¿Por qué ocurrió?

1. El proyecto tenía soporte para **web** habilitado (`react-dom`, `react-native-web`, configuración `"web"` en `app.json`, plugin `"expo-web-browser"`)
2. Tres pantallas importaban `react-native-maps` directamente en el nivel superior del archivo:
   - `app/(app)/index.tsx` (línea 3)
   - `app/(app)/zonas-seguras.tsx` (línea 7)
   - `app/(app)/historial-ubicaciones.tsx` (línea 4)
3. `react-native-maps` es un módulo **nativo-only**: solo funciona en iOS y Android, nunca en web
4. Cuando Expo intentaba resolver y bundlear para web, Metro encontraba el import de código nativo y fallaba

**Causa raíz:** Se configuró soporte web pero se usaron librerías nativas incompatibles con esa plataforma.

### Alternativas consideredas

| Alternativa | Descripción | Problema |
|------------|-------------|----------|
| **A. Condicionar imports con `Platform.select()`** | Usar `Platform.OS === 'web'` para mostrar un mensaje fallback en web y cargar mapas solo en nativo | El proyecto seguiría intentando bundlear para web, innecesario si no se va a usar |
| **B. Crear componentes wrapper para mapas** | Crear un componente abstracto que detecte la plataforma y renderice el mapa nativo o un placeholder | Solución elegante pero innecesaria dado que no se necesita web |
| **C. Eliminar soporte web por completo** | Quitar todas las dependencias web (`react-dom`, `react-native-web`), la configuración en `app.json` y scripts de web | Solución más limpia, directa y sin efectos secundarios |

### Solución elegida: **Alternativa C — Eliminar soporte web**

**Justificación:**
- El proyecto **nunca fue diseñado para web** — es una app móvil de rastreo GPS con mapas nativos
- Eliminar web reduce dependencias innecesarias, tamaño del bundle y complejidad
- Resuelve el problema de raíz sin trabajo extra
- Las pantallas con mapas no necesitan cambios de código

**Archivos modificados:**

- **`app.json`:** Eliminada sección `"web"` (líneas 25-28), eliminado plugin `"expo-web-browser"`
- **`package.json`:** Eliminados `react-dom`, `react-native-web`, `expo-web-browser`, y script `"web"`

---

## 2. Error: Bundling failed — `babel-preset-expo` faltante

### Descripción del error

```
iOS Bundling failed 551ms
ERROR  Error: Cannot find module 'babel-preset-expo'
Require stack:
- C:\Users\vegag\OneDrive\Documentos\GitHub\Proyecto_Grado\Fronted\node_modules\@babel\core\lib\config\files\plugins.js
  ...
Make sure that all the Babel plugins and presets you are using
are defined as dependencies or devDependencies in your package.json
file.
```

### ¿Por qué ocurrió?

Al limpiar `node_modules` y reinstalar las dependencias durante la corrección del error #1, `babel-preset-expo` no estaba declarado en `package.json`. Este preset era transitive dependency de Expo y se perdió en la limpieza. Sin él, Babel no puede compilar el código JSX/TSX.

### Solución elegida

Se añadió `babel-preset-expo` manualmente a `devDependencies` con la versión `~54.0.0` compatible con Expo SDK 54.

**Archivo modificado:**
- **`package.json`:** Añadido `"babel-preset-expo": "~54.0.0"` en `devDependencies`

---

## 3. Error: Versiones incompatibles de paquetes Expo

### Descripción del warning

```
The following packages should be updated for best compatibility with the installed expo version:
  expo-clipboard@55.0.13 - expected version: ~8.0.8
  expo-location@55.1.9 - expected version: ~19.0.8
  Your project may not work correctly until you install the expected versions of the packages.
```

### ¿Por qué ocurrió?

Los paquetes `expo-clipboard` y `expo-location` fueron instalados con versiones que pertenecen a **Expo SDK 55**, pero el proyecto usa **Expo SDK 54**. Cada SDK Expo tiene sus propias versiones específicas de paquetes.

### Alternativas consideredas

| Alternativa | Descripción |
|------------|-------------|
| **A. Ignorar los warnings** | No hacer nada y esperar que funcione | Riesgo de comportamiento impredecible |
| **B. Actualizar a Expo SDK 55** | Mover todo el proyecto a la última versión | Requiere cambios en cadena en todas las dependencias, puede romper APIs |
| **C. Bajar las versiones de los paquetes a lo que Expo 54 espera** | Cambiar las versiones a las que Expo SDK 54 incluye por defecto | Solución segura y sin riesgo |

### Solución elegida: **Alternativa C**

**Justificación:**
- Solución sin riesgo, no cambia el comportamiento de la app
- Garantiza compatibilidad total con Expo SDK 54
- Los warnings de versión desaparecieron tras reinstalar

**Archivos modificados:**

- **`package.json`:**
  - `expo-clipboard`: `^55.0.13` → `~8.0.8`
  - `expo-location`: `^55.1.9` → `~19.0.8`

---

## 4. Bug: Loop infinito de re-renders en `historial-ubicaciones.tsx`

### Descripción del bug

```tsx
const cargarDatos = useCallback(async () => {
  try {
    const resPac = await pacienteService.listar()
    const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
    setPacientes(pacs)
    if (pacs.length > 0 && !selectedPaciente) {
      setSelectedPaciente(pacs[0].id_paciente || pacs[0].id)
    }
    const raw = await AsyncStorage.getItem(KEYS.historial_ubicaciones)
    const hist: Ubicacion[] = JSON.parse(raw || '[]')
    setUbicaciones(hist)
  } catch (err) {
    console.error('Error cargando datos:', err)
  } finally {
    setLoading(false)
  }
}, [selectedPaciente]) // ← selectedPaciente como dependencia

useEffect(() => {
  cargarDatos()
}, [cargarDatos])
```

El `useEffect` dependía de `cargarDatos`, que a su vez tenía `selectedPaciente` en sus dependencias. Al actualizarse `selectedPaciente`, se re-ejecutaba `cargarDatos`, que actualizaba `selectedPaciente`, creando un **loop infinito de re-renders**.

### ¿Por qué ocurrió?

Error de lógica en las dependencias de React Hooks. `useCallback` capturaba `selectedPaciente` pero este es un valor que cambia desde dentro del mismo callback, creando una dependencia circular.

### Alternativas consideredas

| Alternativa | Descripción |
|------------|-------------|
| **A. Quitar `selectedPaciente` de las dependencias** | Mantener `useCallback` pero sin la dependencia | ESLint seguía reportando warning de todas formas |
| **B. Eliminar `useCallback` por completo** | Convertir `cargarDatos` en función plana dentro del componente | Solución simple, funciona correctamente para ejecución al montar |
| **C. Mover `selectedPaciente` a ref** | Usar `useRef` para evitar dependencias en el callback | Overkill para este caso de uso |

### Solución elegida: **Alternativa B**

**Justificación:**
- La función `cargarDatos` solo necesita ejecutarse **al montar** el componente
- `useCallback` no aporta beneficio aquí — no se pasa como prop ni se memoiza
- El código es más simple y legible
- Se agregó `eslint-disable-next-line` para indicar explícitamente que el `[]` vacío es intencional

**Archivo modificado:**
- `app/(app)/historial-ubicaciones.tsx`:
  - Eliminada importación de `useCallback`
  - Convertida función a plana
  - useEffect con array vacío + disable comment

---

## 5. Bug: Login de familiar llamaba a función incorrecta

### Descripción del bug

En `services/api.ts`, `familiarService.login` estaba llamando a `localLogin` (de cuidador) en vez de `localLoginFamiliar`.

```typescript
// Antes (incorrecto)
const result = await localLogin(email, password)
if (!result) throw { ... }
return { data: result }

// Después (correcto)
const result = await localLoginFamiliar(email, password)
if (!result) throw { ... }
return { data: result }
```

### ¿Por qué ocurrió?

Error de copia durante el desarrollo. Ambas funciones de login son similares y probablemente se copió la estructura de `cuidadorService.login` sin cambiar el nombre de la función llamada. La función `localLoginFamiliar` ya estaba importada correctamente en `localDb.ts` pero nunca se usaba.

### Solución

Corrección directa del nombre de la función llamada.

**Archivo modificado:**
- `services/api.ts:64-70`

---

## 6. Bug: Inconsistencia de campos en datos mock

### Descripción

`mockDb.json` usaba nombres de campos inconsistentes con lo que `localDb.ts` y las pantallas esperaban:

| Campo en mockDb.json | Campo esperado por código |
|---------------------|-------------------------|
| `id` (paciente) | `id`, `id_paciente` (ambos eran buscados) |
| `name` (paciente) | `name`, `nombre_paciente` (ambos eran buscados) |
| `diagnostico` | `diagnostico`, `enfermedad` (ambos eran buscados) |
| `edad` | `edad`, `edad_paciente` |
| Ausente | `id_cuidador`, `id_dispositivo` |

### ¿Por qué ocurrió?

Los datos mock se fueron creando progresivamente sin mantener un schema unificado. Diferentes pantallas accedían a `pac.name`, `pac.nombre_paciente`, `pac.diagnostico` o `pac.enfermedad` sin coherencia, causando que algunos campos llegaran `undefined`.

### Solución

Se actualizó `mockDb.json` para incluir **todas** las variaciones de nombres de campos, garantizando que cualquier pantalla pueda acceder a los datos sin error.

**Archivo modificado:**
- `data/mockDb.json` — todos los registros de `pacientes` ahora incluyen ambas formas de cada campo

---

## 7. Bug: Warnings de lint (ESLint)

### Errores encontrados

```
app/(app)/historial-ubicaciones.tsx
  warning  React Hook useCallback has a missing dependency: 'selectedPaciente'
  warning  React Hook useEffect has a missing dependency: 'cargarDatos'

app/_layout.tsx
  warning  React Hook useEffect has a missing dependency: 'router'

components/DrawerContent.tsx
  warning  'NavItem' is defined but never used
```

### Soluciones

| Archivo | Corrección |
|---------|-----------|
| `historial-ubicaciones.tsx` | Convertida función a plana y agregado `eslint-disable-next-line` (ver bug #4) |
| `app/_layout.tsx` | Añadido `router` a las dependencias del `useEffect` |
| `DrawerContent.tsx` | Eliminada interfaz `NavItem` que no se usaba |

---

## 8. Bugs menores de texto

### Archivos corregidos

| Archivo | Antes | Después |
|---------|-------|---------|
| `elegir-rol.tsx:34` | `"Cuid a pacientes con Alzheimer..."` | `"Cuida pacientes con Alzheimer..."` |
| `elegir-rol.tsx:59` | `"Already have an account? Sign in"` | `"¿Ya tienes cuenta? Inicia sesión"` |

---

## 9. Limpieza de dependencias no utilizadas

### Paquetes eliminados

| Paquete | Razón de eliminación |
|---------|---------------------|
| `react-dom` | Nativo de web, eliminado soporte web |
| `react-native-web` | Nativo de web, eliminado soporte web |
| `expo-web-browser` | Plugin de web, no se importa en ningún archivo |
| `expo-haptics` | No se importa en ningún archivo del frontend |
| `expo-image` | No se importa en ningún archivo del frontend |
| `expo-symbols` | No se usa en ningún archivo |

### Paquetes restaurados

| Paquete | Razón |
|---------|-------|
| `babel-preset-expo` | Dependencia crítica de Expo, se perdió en limpieza de node_modules |

---

## Resumen de archivos modificados

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `app.json` | Eliminada sección `"web"`, eliminado plugin `expo-web-browser` |
| 2 | `package.json` | Eliminados paquetes web y no usados, corregidas versiones, añadido `babel-preset-expo` |
| 3 | `app/_layout.tsx` | Añadido `router` a dependencias del useEffect |
| 4 | `app/(app)/historial-ubicaciones.tsx` | Eliminada `useCallback`, corregido loop infinito |
| 5 | `app/(app)/elegir-rol.tsx` | Corregidos textos al español |
| 6 | `services/api.ts` | Corregido `familiarService.login` para llamar a `localLoginFamiliar` |
| 7 | `services/localDb.ts` | Sin cambios (función `localLoginFamiliar` ya existía) |
| 8 | `data/mockDb.json` | Unificados todos los campos de pacientes |
| 9 | `components/DrawerContent.tsx` | Eliminada interfaz `NavItem` no utilizada |
| 10 | `docs/REPORTE-ERRORES.md` | Este documento |

---

## Resultado final

- **0 errores, 0 warnings** en `expo lint`
- **Metro bundler** inicia sin errores en iOS y Android
- Proyecto limpio, organizado y listo para ejecutar en dispositivos

---

## Pendientes recomendados

1. **Módulo de batería del cuidador** — Notificar niveles y detectar desconexión mediante heartbeat en backend
2. **Integrar `expo-location`** — Actualmente instalado pero no se usa en ninguna pantalla
3. **Variable de entorno para `BASE_URL`** — Usar `.env` en lugar de hardcodear la URL
4. **Typescript estricto** — Definir interfaces específicas para cada modelo de datos
5. **Tests unitarios** — Agregar Jest para cubrir servicios y componentes críticos
