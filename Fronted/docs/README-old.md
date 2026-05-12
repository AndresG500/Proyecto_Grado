# UbiLife — Frontend

Aplicación móvil de rastreo GPS para cuidadores de pacientes con Alzheimer. Desarrollada con **Expo SDK 54** y **React Native 0.81**.

> **Nota:** Este proyecto está diseñado exclusivamente para **iOS y Android**. No soporta web.

---

## Requisitos

- Node.js 20+
- npm 10+
- Expo CLI (`npx expo`)
- Expo Account (para build en dispositivos reales)
- Android Studio (para emulador Android) o Xcode (para emulador iOS en Mac)

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd Fronted

# 2. Instalar dependencias
npm install

# 3. Iniciar el proyecto
npx expo start
```

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia Expo Dev Tools (bundler de desarrollo) |
| `npm run android` | Compila y ejecuta en emulador/dispositivo Android |
| `npm run ios` | Compila y ejecuta en emulador/dispositivo iOS (solo Mac) |
| `npm run lint` | Ejecuta ESLint para verificar código |
| `npm run reset-project` | Reinicia el proyecto Expo |

---

## Arquitectura del proyecto

```
Fronted/
├── app/                    # Rutas de Expo Router (file-based routing)
│   ├── _layout.tsx         # Layout raíz + AuthGuard
│   ├── login.tsx           # Pantalla de inicio de sesión
│   ├── elegir-rol.tsx      # Selección de rol (cuidador/familiar)
│   ├── register-cuidador.tsx
│   ├── register-familiar.tsx
│   ├── register.tsx
│   └── (app)/              # Grupo de rutas protegidas (requieren login)
│       ├── _layout.tsx     # Layout con Drawer
│       ├── index.tsx       # Mapa principal
│       ├── alertas.tsx
│       ├── zonas-seguras.tsx
│       ├── historial-ubicaciones.tsx
│       ├── grupo-familiar.tsx
│       ├── registro-paciente.tsx
│       ├── vincular-dispositivo.tsx
│       └── perfil.tsx
├── components/             # Componentes reutilizables
│   └── DrawerContent.tsx   # Menú lateral personalizado
├── constants/               # Constantes globales
│   └── Colors.ts           # Paleta de colores
├── context/                # Contextos de React
│   └── AuthContext.tsx     # Estado de autenticación
├── services/               # Capa de datos
│   ├── api.ts              # Cliente Axios + servicios
│   └── localDb.ts          # Base de datos local (AsyncStorage)
├── data/                   # Datos mock para desarrollo offline
│   └── mockDb.json
└── assets/                 # Imágenes, iconos, fonts
```

---

## Usuarios de prueba (datos mock)

| Tipo | Email | Contraseña |
|------|-------|------------|
| Cuidador | `demo@ubilife.com` | `demo1234` |
| Cuidador | `maria@test.com` | `password123` |
| Familiar | `juan@test.com` | `password123` |
| Familiar | `ana@test.com` | `password123` |

---

## Configuración de API

El proyecto intenta conectarse a un backend FastAPI en `http://10.0.2.2:8000` (Android emulator localhost). Si el backend no está disponible, usa automáticamente la base de datos local (`AsyncStorage`) como fallback.

### Cambiar la URL del backend

Editar en `services/api.ts`, línea 11:

```typescript
const BASE_URL = 'http://10.0.2.2:8000'  // Android emulator
const BASE_URL = 'http://localhost:8000'   // iOS simulator
const BASE_URL = 'http://<TU_IP>:8000'    // Dispositivo real (mismo WiFi)
```

---

## Navegación

- **Drawer (menú lateral):** Acceso a todas las pantallas de la app
- **Stack:** Navegación entre pantallas públicas (login, registro)
- **AuthGuard:** Componente que redirige a `/login` si no hay token

### Roles y permisos

| Rol | Pantallas disponibles |
|-----|----------------------|
| **Cuidador** | Mapa, Alertas, Zonas seguras, Historial, Grupo familiar, Registrar paciente, Vincular GPS, Perfil |
| **Familiar** | Mapa, Alertas, Zonas seguras, Historial, Grupo familiar, Perfil |

---

## Librerías principales

| Librería | Versión | Uso |
|----------|---------|-----|
| `expo` | ~54.0.34 | Framework base |
| `expo-router` | ~6.0.23 | File-based routing |
| `react-native` | 0.81.5 | UI framework |
| `react-native-maps` | 1.20.1 | Mapas con Google Maps |
| `@react-navigation` | ^7.x | Navegación |
| `react-native-reanimated` | ~4.1.1 | Animaciones |
| `react-native-gesture-handler` | ~2.28.0 | Gestos y drawer |
| `axios` | ^1.16.0 | Cliente HTTP |
| `@react-native-async-storage` | 2.2.0 | Almacenamiento local |
| `expo-clipboard` | ~8.0.8 | Portapapeles |
| `expo-location` | ~19.0.8 | Ubicación GPS |

---

## Errores resueltos

### Bundling fallido por `react-native-maps` en web

**Problema:** El proyecto intentaba bundlear para web, pero `react-native-maps` es incompatible con web.

**Solución:** Se eliminó el soporte web del proyecto (`react-dom`, `react-native-web`, configuración en `app.json`).

### Versiones incompatibles de paquetes

**Problema:** `expo-clipboard` y `expo-location` tenían versiones de SDK 55, pero el proyecto usa SDK 54.

**Solución:** Se ajustaron las versiones a las esperadas por Expo SDK 54.

### Loop infinito de re-renders

**Problema:** En `historial-ubicaciones.tsx`, un `useCallback` con `selectedPaciente` en dependencias causaba un loop infinito.

**Solución:** Se eliminó `useCallback` y se usó una función plana con `useEffect` de montaje único.

### Login familiar llamaba función incorrecta

**Problema:** `familiarService.login` llamaba a `localLogin` en vez de `localLoginFamiliar`.

**Solución:** Se corrigió el nombre de la función en `services/api.ts`.

### Inconsistencia de campos en datos mock

**Problema:** `mockDb.json` usaba nombres de campos inconsistentes (`name` vs `nombre_paciente`, etc.).

**Solución:** Se actualizó el schema para incluir todas las variaciones de nombres.

### Warnings de ESLint

- Se corrigieron dependencias faltantes en `useEffect`
- Se eliminó interfaz `NavItem` no utilizada en `DrawerContent.tsx`

---

## Pendientes y mejoras futuras

### Funcionalidades pendientes

1. **Módulo de monitoreo de batería del cuidador**
   - Notificar al grupo familiar cuando la batería baje a 20%, 15%, 10%, 5%
   - Detectar cuando el cuidador se desconecta (mediante heartbeat en backend)
   - Indicador visual de estado online/offline del cuidador

2. **Notificaciones push**
   - Implementar `expo-notifications` para alertas en tiempo real
   - Notificaciones cuando el paciente sale de una zona segura

3. **Perfil del paciente**
   - Pantalla para editar datos del paciente
   - Historial médico

4. **Modo offline mejorado**
   - Sincronización de datos cuando se recupere conexión
   - Cola de ubicaciones pendientes por enviar

### Mejoras de código

- Agregar `expo-location` para obtener ubicación real del cuidador
- Implementar TypeScript en todos los archivos con tipos específicos
- Agregar tests unitarios con Jest
- Implementar variable de entorno para `BASE_URL` con `.env`

---

## Notas técnicas

### React Native 0.81 + Expo SDK 54

Este proyecto usa la **New Architecture** de React Native (`newArchEnabled: true` en `app.json`), lo que habilita:
- Renderizado nativo mejorado
- Mejor rendimiento en animaciones
- Soporte para React Compiler (experiment)

### API de ubicación (Pendiente)

`expo-location` está instalado pero no se importa ni usa actualmente en ninguna pantalla. Debería integrarse para:
- Centrar el mapa en la ubicación real del cuidador
- Obtener coordenadas para las zonas seguras

---

## Licencia

Proyecto académico — Universidad.
