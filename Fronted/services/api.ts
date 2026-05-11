import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  localLogin, localRegister,
  localListarPacientes, localRegistrarPaciente,
  localListarAlertas, localResolverAlerta,
  localListarZonas, localCrearZona, localEliminarZona, localToggleZona,
} from './localDb'

const BASE_URL = 'http://10.0.2.2:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 5000 })

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const esErrorDeRed = (err: any) =>
  !err.response || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK'

// ── Cuidador ──────────────────────────────────────────────────────────────

export const cuidadorService = {
  registrar: async (datos: { name: string; email: string; password: string; phone?: string }) => {
    try {
      return await api.post('/cuidadores/registrar', datos)
    } catch (err: any) {
      if (esErrorDeRed(err)) return { data: await localRegister(datos) }
      throw err
    }
  },

  login: async (email: string, password: string) => {
    try {
      return await api.post('/cuidadores/verificar', { email, password })
    } catch (err: any) {
      if (esErrorDeRed(err)) {
        const result = await localLogin(email, password)
        if (!result) throw { response: { data: { detail: 'Credenciales inválidas. Intenta de nuevo.' } } }
        return { data: result }
      }
      throw err
    }
  },

  perfil: () => api.get('/cuidadores/perfil'),
  logout: () => api.post('/cuidadores/logout').catch(() => {}),
}

// ── Pacientes ─────────────────────────────────────────────────────────────

export const pacienteService = {
  listar: async () => {
    try {
      return await api.get('/pacientes/')
    } catch (err: any) {
      if (esErrorDeRed(err)) return { data: await localListarPacientes() }
      throw err
    }
  },

  registrar: async (datos: { name: string; edad: number; diagnostico?: string }) => {
    try {
      return await api.post('/pacientes/', datos)
    } catch (err: any) {
      if (esErrorDeRed(err)) return { data: await localRegistrarPaciente(datos) }
      throw err
    }
  },

  obtener:         (id: string) => api.get(`/pacientes/${id}`),
  ultimaUbicacion: (id: string) => api.get(`/historial-ubicaciones/ultima/${id}`),
  ruta:            (id: string) => api.get(`/historial-ubicaciones/ruta/${id}`),
}

// ── Zonas seguras ─────────────────────────────────────────────────────────

export const zonaService = {
  listarPorPaciente: async (pacienteId: string) => {
    try {
      return await api.get(`/zonas-seguras/paciente/${pacienteId}`)
    } catch (err: any) {
      if (esErrorDeRed(err)) return { data: await localListarZonas(pacienteId) }
      throw err
    }
  },

  crear: async (datos: { nombre: string; paciente_id: string; centro: { lat: number; lng: number }; radio: number }) => {
    try {
      return await api.post('/zonas-seguras/', datos)
    } catch (err: any) {
      if (esErrorDeRed(err)) return { data: await localCrearZona(datos) }
      throw err
    }
  },

  eliminar: async (id: string) => {
    try {
      return await api.delete(`/zonas-seguras/${id}`)
    } catch (err: any) {
      if (esErrorDeRed(err)) { await localEliminarZona(id); return { data: { mensaje: 'Zona eliminada' } } }
      throw err
    }
  },

  toggle: async (id: string) => {
    try {
      return await api.patch(`/zonas-seguras/${id}/toggle`)
    } catch (err: any) {
      if (esErrorDeRed(err)) { await localToggleZona(id); return { data: { mensaje: 'Zona actualizada' } } }
      throw err
    }
  },
}

// ── Alertas ───────────────────────────────────────────────────────────────

export const alertaService = {
  listar: async () => {
    try {
      return await api.get('/alertas/')
    } catch (err: any) {
      if (esErrorDeRed(err)) return { data: await localListarAlertas() }
      throw err
    }
  },

  resolver: async (id: string) => {
    try {
      return await api.patch(`/alertas/${id}/resolver`)
    } catch (err: any) {
      if (esErrorDeRed(err)) { await localResolverAlerta(id); return { data: { mensaje: 'Alerta resuelta' } } }
      throw err
    }
  },
}

export default api
