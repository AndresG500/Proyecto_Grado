import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Cambia esta IP por la IP local de la máquina donde corre el backend
const BASE_URL = 'http://10.0.2.2:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
})

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const cuidadorService = {
  registrar: (datos: { name: string; email: string; password: string; phone?: string }) =>
    api.post('/cuidadores/registrar', datos),
  login:  (email: string, password: string) =>
    api.post('/cuidadores/verificar', { email, password }),
  perfil: () => api.get('/cuidadores/perfil'),
  logout: () => api.post('/cuidadores/logout'),
}

export const pacienteService = {
  listar:          ()          => api.get('/pacientes/'),
  obtener:         (id: string) => api.get(`/pacientes/${id}`),
  ultimaUbicacion: (id: string) => api.get(`/historial-ubicaciones/ultima/${id}`),
  ruta:            (id: string) => api.get(`/historial-ubicaciones/ruta/${id}`),
}

export const zonaService = {
  listarPorPaciente: (pacienteId: string) =>
    api.get(`/zonas-seguras/paciente/${pacienteId}`),
}

export const alertaService = {
  listar: () => api.get('/alertas/'),
}

export default api
