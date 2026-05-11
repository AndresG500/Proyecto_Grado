import AsyncStorage from '@react-native-async-storage/async-storage'
import mockData from '@/data/mockDb.json'

const KEYS = {
  cuidadores:    '@ubilife_cuidadores',
  pacientes:     '@ubilife_pacientes',
  alertas:       '@ubilife_alertas',
  zonas:         '@ubilife_zonas',
  seeded:        '@ubilife_seeded',
}

async function seed() {
  const done = await AsyncStorage.getItem(KEYS.seeded)
  if (done) return
  await AsyncStorage.setItem(KEYS.cuidadores, JSON.stringify(mockData.cuidadores))
  await AsyncStorage.setItem(KEYS.pacientes,  JSON.stringify(mockData.pacientes))
  await AsyncStorage.setItem(KEYS.alertas,    JSON.stringify(mockData.alertas))
  await AsyncStorage.setItem(KEYS.zonas,      JSON.stringify(mockData.zonas_seguras))
  await AsyncStorage.setItem(KEYS.seeded, '1')
}

async function getCuidadores(): Promise<any[]> {
  await seed()
  const raw = await AsyncStorage.getItem(KEYS.cuidadores)
  return JSON.parse(raw || '[]')
}

async function saveCuidadores(lista: any[]) {
  await AsyncStorage.setItem(KEYS.cuidadores, JSON.stringify(lista))
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function localLogin(email: string, password: string) {
  const lista = await getCuidadores()
  const user  = lista.find(
    (c) => c.email === email.toLowerCase() && c.password === password,
  )
  if (!user) return null
  const payload = JSON.stringify({ email: user.email, exp: Date.now() + 86_400_000 })
  const token   = btoa(unescape(encodeURIComponent(payload)))
  return {
    token,
    cuidador: { name: user.name, email: user.email, phone: user.phone ?? '' },
  }
}

export async function localRegister(datos: {
  name: string; email: string; password: string; phone?: string
}) {
  const lista = await getCuidadores()
  if (lista.find((c) => c.email === datos.email.toLowerCase())) {
    throw new Error('Este correo ya ha sido registrado')
  }
  const nuevo = {
    id:          `local_${Date.now()}`,
    name:        datos.name,
    email:       datos.email.toLowerCase(),
    password:    datos.password,
    phone:       datos.phone ?? '',
    patient_ids: [],
    is_active:   true,
  }
  lista.push(nuevo)
  await saveCuidadores(lista)
  return { mensaje: 'Cuidador registrado exitosamente' }
}

// ── Pacientes ─────────────────────────────────────────────────────────────

export async function localListarPacientes() {
  await seed()
  const raw = await AsyncStorage.getItem(KEYS.pacientes)
  return JSON.parse(raw || '[]')
}

export async function localRegistrarPaciente(datos: {
  name: string; edad: number; diagnostico?: string
}) {
  const lista = JSON.parse(
    (await AsyncStorage.getItem(KEYS.pacientes)) || '[]',
  )
  const nuevo = { id: `pac_${Date.now()}`, ...datos, ultima_ubicacion: null, dispositivo_id: null }
  lista.push(nuevo)
  await AsyncStorage.setItem(KEYS.pacientes, JSON.stringify(lista))
  return nuevo
}

// ── Alertas ───────────────────────────────────────────────────────────────

export async function localListarAlertas() {
  await seed()
  const raw = await AsyncStorage.getItem(KEYS.alertas)
  return JSON.parse(raw || '[]')
}

export async function localResolverAlerta(id: string) {
  const lista: any[] = JSON.parse((await AsyncStorage.getItem(KEYS.alertas)) || '[]')
  const idx = lista.findIndex((a) => a.id === id)
  if (idx !== -1) lista[idx].estado = 'RESUELTA'
  await AsyncStorage.setItem(KEYS.alertas, JSON.stringify(lista))
}

// ── Zonas seguras ─────────────────────────────────────────────────────────

export async function localListarZonas(pacienteId?: string) {
  await seed()
  const raw   = await AsyncStorage.getItem(KEYS.zonas)
  const zonas = JSON.parse(raw || '[]')
  return pacienteId ? zonas.filter((z: any) => z.paciente_id === pacienteId) : zonas
}

export async function localCrearZona(datos: {
  nombre: string; paciente_id: string; centro: { lat: number; lng: number }; radio: number
}) {
  const lista = await localListarZonas()
  const nueva = { id: `zona_${Date.now()}`, activa: true, ...datos }
  lista.push(nueva)
  await AsyncStorage.setItem(KEYS.zonas, JSON.stringify(lista))
  return nueva
}

export async function localEliminarZona(id: string) {
  const lista = (await localListarZonas()).filter((z: any) => z.id !== id)
  await AsyncStorage.setItem(KEYS.zonas, JSON.stringify(lista))
}

export async function localToggleZona(id: string) {
  const lista: any[] = await localListarZonas()
  const idx = lista.findIndex((z) => z.id === id)
  if (idx !== -1) lista[idx].activa = !lista[idx].activa
  await AsyncStorage.setItem(KEYS.zonas, JSON.stringify(lista))
}
