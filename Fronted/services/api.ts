import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000'

const api = axios.create({ baseURL: BASE_URL, timeout: 8000 })

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let _logoutHandler: (() => Promise<void>) | null = null

export function registrarLogout(fn: () => Promise<void>) {
  _logoutHandler = fn
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && _logoutHandler) {
      await _logoutHandler()
    }
    return Promise.reject(error)
  }
)

// ── Cuidador ───────────────────────────────────────────────────────────────

export const cuidadorService = {
  registrar: (datos: { name: string; email: string; password: string; phone?: string }) =>
    api.post('/cuidadores/registrar', datos),

  login: (email: string, password: string) =>
    api.post('/cuidadores/verificar', { email, password }),

  perfil: () => api.get('/cuidadores/perfil'),

  actualizar: (datos: { name?: string; phone?: string }) =>
    api.put('/cuidadores/actualizar', datos),

  logout: () => api.post('/cuidadores/logout').catch(() => {}),

  actualizarFcmToken: (token: string) =>
    api.patch('/cuidadores/fcm-token', { token }),
}

// ── Familiares ─────────────────────────────────────────────────────────────

export const familiarService = {
  registrar: (datos: {
    name: string
    email: string
    password: string
    phone?: string
    codigo_grupo?: string
  }) => api.post('/familiares/registrar', datos),

  login: (email: string, password: string) =>
    api.post('/familiares/verificar', { email, password }),

  misGrupos: () => api.get('/familiares/grupos'),

  misPacientes: () => api.get('/familiares/pacientes'),
}

// ── Pacientes ──────────────────────────────────────────────────────────────

export const pacienteService = {
  listar: () => api.get('/pacientes/'),

  registrar: (datos: {
    nombre_paciente: string
    edad_paciente: number
    enfermedad?: string
    id_cuidador: string
    id_dispositivo?: string
  }) => api.post('/pacientes/registrar', datos),

  obtener: (id: string) => api.get(`/pacientes/${id}`),

  actualizar: (id: string, datos: any) => api.put(`/pacientes/${id}`, datos),

  ultimaUbicacion: (id: string) => api.get(`/historial-ubicaciones/ultima/${id}`),

  ruta: (id: string) => api.get(`/historial-ubicaciones/ruta/${id}`),

  rutaFamiliar: (id: string) => api.get(`/historial-ubicaciones/ruta-familiar/${id}`),
}

// ── Zonas seguras ──────────────────────────────────────────────────────────

export const zonaService = {
  listarPorPaciente: (pacienteId: string) =>
    api.get(`/zonas-seguras/paciente/${pacienteId}`),

  crear: (datos: {
    nombre: string
    paciente_id: string
    centro: { latitud: number; longitud: number }
    radio_metros: number
  }) => api.post('/zonas-seguras/crear', datos),

  eliminar: (id: string) => api.delete(`/zonas-seguras/eliminar/${id}`),

  toggle: (id: string, activa: boolean) =>
    api.patch(`/zonas-seguras/actualizar/${id}`, { activa }),

  listarFamiliar: () => api.get('/zonas-seguras/familiar/'),
}

// ── Alertas ────────────────────────────────────────────────────────────────

export const alertaService = {
  listar: (pacienteId?: string) => {
    const params = pacienteId ? { paciente_id: pacienteId } : {}
    return api.get('/alertas/', { params })
  },

  resolver: (id: string) => api.patch(`/alertas/${id}/resolver`),

  listarFamiliar: () => api.get('/alertas/familiar/'),
}

// ── Dispositivos ───────────────────────────────────────────────────────────

export const dispositivoService = {
  disponibles: () => api.get('/dispositivos/disponibles'),

  vincular: (datos: { id_dispositivo: string; paciente_id: string }) =>
    api.post('/dispositivos/vincular', datos),

  desvincular: (id: string) => api.patch(`/dispositivos/desvincular/${id}`),

  porPaciente: (pacienteId: string) => api.get(`/dispositivos/paciente/${pacienteId}`),
}

// ── Grupos ─────────────────────────────────────────────────────────────────

export const grupoService = {
  listar: () => api.get('/grupos/'),

  crear: (datos: { nombre: string; paciente_ids?: string[] }) =>
    api.post('/grupos/registrar', datos),

  obtener: (id: string) => api.get(`/grupos/${id}`),

  eliminar: (id: string) => api.delete(`/grupos/${id}`),

  agregarMiembro: (id: string, cuidadorId: string) =>
    api.post(`/grupos/${id}/cuidadores`, { cuidador_id: cuidadorId }),

  unirseConCodigo: (codigo: string) =>
    api.post('/grupos/unirse', { codigo }),

  miembros: (id: string) => api.get(`/grupos/${id}/miembros`),

  miembrosFamiliar: (id: string) => api.get(`/grupos/${id}/miembros/familiar`),
}

export default api