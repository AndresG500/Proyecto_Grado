# Análisis de Errores - UbiLife Frontend (Expo)

## 1. Contexto del Proyecto

El proyecto es una aplicación de rastreo GPS para cuidadores, desarrollada con:
- **Framework:** Expo SDK 54 con Expo Router
- **Navigación:** Drawer + Stack navigation
- **Mapas:** react-native-maps
- **Estado:** React Context (AuthContext)
- **Backend:** API REST simulada + base de datos local (AsyncStorage)

---

## 2. Error Original Reportado

El usuario reportaba que la app no se abría correctamente al usar el código QR de Expo o en la versión web.

### Síntomas observables:
- La aplicación no iniciaba correctamente
- Posibles errores en consola o pantalla en blanco

---

## 3. Análisis de Errores Identificados

### 3.1 Error de TypeScript Crítico

**Ubicación:** `app/_layout.tsx:15`

```typescript
if (token  && !inApp) router.replace('/(app)/' as any)
```

**Problema:** El tipo de ruta `"/(app)/"` no es compatible con el sistema de rutas strongly-typed de Expo Router. El uso de `as any` es un workaround que indica un problema de tipado.

**Tipo de ruta esperado:** Las rutas definidas en el sistema de archivos deben coincidir con rutas declaradas.

---

### 3.2 Error de Proveedor de Mapas (CRÍTICO)

**Ubicación:**
- `app/(app)/index.tsx:67`
- `app/(app)/zonas-seguras.tsx:104`

```typescript
provider={PROVIDER_GOOGLE}
```

**Problema:** En entornos web, el provider `PROVIDER_GOOGLE` requiere una API key válida de Google Maps Cloud. Sin esta clave, el mapa no se renderiza en web.

**Alternativas evaluadas:**
1. Usar el provider por defecto (undefined) - Funciona en web pero con limitaciones
2. Implementar Google Maps con API key - Requiere configuración adicional
3. Usar un proveedor alternativo como Mapbox - Requiere cambios mayores

---

### 3.3 Advertencia de React Hooks

**Ubicación:** `app/_layout.tsx:16`

```typescript
useEffect(() => {
  if (loading) return
  const inApp = segments[0] === '(app)'
  if (!token && inApp)  router.replace('/login')
  if (token  && !inApp) router.replace('/(app)/')
}, [token, loading, segments])  // Falta 'router'
```

**Problema:** La dependencia `router` no está incluida, lo cual puede causar stale closures.

---

### 3.4 Rutas con Cast `as any` en Múltiples Archivos

Se encontraron múltiples usos de `as any` para evitar errores de tipo:

| Archivo | Línea | Uso |
|---------|-------|-----|
| `app/login.tsx` | 34 | `router.replace('/(app)/' as any)` |
| `app/login.tsx` | 120 | `router.push('/register' as any)` |
| `app/register.tsx` | 81 | `router.replace('/login' as any)` |
| `app/(app)/perfil.tsx` | 30 | `router.replace('/login' as any)` |
| `app/(app)/vincular-dispositivo.tsx` | 41, 106 | Similar |

**Problema:** Indica rutas no registradas en el sistema de tipos de Expo Router.

---

### 3.5 URL de API Hardcodeada

**Ubicación:** `services/api.ts:10`

```typescript
const BASE_URL = 'http://10.0.2.2:8000'
```

**Problema:** Esta URL funciona solo en emuladores Android. Para web y iOS, se necesita una URL diferente.

---

## 4. Alternativas de Solución Evaluadas

### Para el Error de Mapas en Web:

| Alternativa | Ventajas | Desventajas |
|-------------|----------|-------------|
| **A) Quitar provider (Elegida)** | Funciona inmediatamente, sin API key | Mapa limitado (solo estándar) |
| B) Agregar Google Maps API | Funcionalidad completa | Requiere cuenta Google, configuración, costos potenciales |
| C) Usar Mapbox | Alternativa popular | Requires cambio de librería, configuración |
| D) Mostrar mensaje condicional | UX clara | Necesita lógica adicional |

### Para Rutas de Navegación:

| Alternativa | Ventajas | Desventajas |
|-------------|----------|-------------|
| **A) Usar Stack específico (Elegida)** | Compatible con typed routes | Requiere conocer estructura |
| B) Mantener `as any` | Funciona ahora | No type-safe, técnico debt |
| C) Configurar rutas adicionales | Completo | Configuración compleja |

---

## 5. Solución Implementada

### 5.1 Corrección del Error de Tipado en `_layout.tsx`

**Cambio en línea 15:**
```typescript
// Antes (con error):
if (token  && !inApp) router.replace('/(app)/' as any)

// Después (corregido):
if (token  && !inApp) router.replace('/(app)')
```

La ruta correcta en Expo Router es `/(app)` (sin la barra final), que corresponde al archivo `app/(app)/index.tsx`.

### 5.2 Corrección del Proveedor de Mapas

**Cambio en `index.tsx` y `zonas-seguras.tsx`:**
```typescript
// Antes:
provider={PROVIDER_GOOGLE}

// Después:
provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
```

Esta corrección permite que el mapa funcione en web usando el provider por defecto (Apple Maps en Safari, OpenStreetMap en algunos navegadores) sin necesidad de API key.

### 5.3 Limpieza de Rutas con `as any`

Se reemplazaron los casts `as any` con rutas válidas según la estructura de Expo Router:
- `/login` → ruta correcta al archivo `app/login.tsx`
- `/register` → ruta correcta al archivo `app/register.tsx`
- `/(app)` → ruta correcta al index del grupo de rutas

### 5.4 Mejora de la Advertencia de useEffect

**Cambio en `_layout.tsx`:**
```typescript
// Include 'router' in dependencies
useEffect(() => {
  // ...existing code
}, [token, loading, segments, router])
```

---

## 6. Recomendaciones Futuras

1. **Configurar variables de entorno** para la URL base de la API
2. **Implementar Google Maps** con API key para funcionalidad completa
3. **Configurar diferentes URLs** según plataforma (web, Android, iOS)
4. **Agregar manejo de errores** más robusto para la carga del mapa
5. **Considerar migración** a un sistema de mapas más compatible con web si es necesario

---

## 7. Conclusión

El error principal que impedía ejecutar la app en web era el **provider de Google Maps sin API key**. Adicionalmente, existían errores de tipo en las rutas de navegación. Las correcciones implementadas permiten que la app funcione en web de forma básica, con la recomendación de configurar una API key de Google Maps para funcionalidad completa.