import * as Location from 'expo-location'
import api from './api'

export const solicitarPermisos = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

export const iniciarSeguimiento = async (
  onUbicacion: (coords: { latitude: number; longitude: number }) => void
): Promise<Location.LocationSubscription> => {
  const permiso = await solicitarPermisos()
  if (!permiso) throw new Error('Permiso de ubicación denegado')

  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
    },
    (loc) => {
      onUbicacion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      })
    }
  )
}

export const enviarUbicacionCuidador = async (
  grupoId: string,
  latitude: number,
  longitude: number
): Promise<void> => {
  try {
    await api.post(`/grupos/${grupoId}/ubicacion`, {
      latitud:  latitude,
      longitud: longitude,
    })
  } catch {
    // silencioso — no interrumpir el tracker por errores de red
  }
}

export interface UbicacionCuidador {
  cuidador_id: string
  latitud: number
  longitud: number
  timestamp?: string
}

export const obtenerUbicacionesGrupo = async (
  grupoId: string
): Promise<{ cuidadores: UbicacionCuidador[]; pacientes: any[] }> => {
  try {
    const res = await api.get(`/grupos/${grupoId}/ubicaciones`)
    return res.data ?? { cuidadores: [], pacientes: [] }
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 404) {
      console.warn('[ubicacion] obtenerUbicacionesGrupo error:', status, err?.response?.data)
    }
    return { cuidadores: [], pacientes: [] }
  }
}
