import AsyncStorage from '@react-native-async-storage/async-storage'
import mockData from '@/data/mockDb.json'

const KEYS = {
  cuidadores:    '@ubilife_cuidadores',
  familiares:    '@ubilife_familiares',
  grupos:        '@ubilife_grupos',
  pacientes:     '@ubilife_pacientes',
  alertas:       '@ubilife_alertas',
  zonas:         '@ubilife_zonas',
  seeded:        '@ubilife_seeded',
}

async function seed() {
  const done = await AsyncStorage.getItem(KEYS.seeded)
  if (done) return
  await AsyncStorage.setItem(KEYS.cuidadores, JSON.stringify(mockData.cuidadores))
  await AsyncStorage.setItem(KEYS.familiares, JSON.stringify(mockData.familiares || []))
  await AsyncStorage.setItem(KEYS.grupos,      JSON.stringify(mockData.grupos || []))
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
  // Forzar seed para asegurar datos cargados
  await AsyncStorage.setItem(KEYS.seeded, '')
  await seed()
  
  console.log('Intentando login con:', email, password)
  
  const cuidadoresRaw = await AsyncStorage.getItem(KEYS.cuidadores)
  console.log('Cuidadores en storage:', cuidadoresRaw)
  const cuidadores = JSON.parse(cuidadoresRaw || '[]')
  console.log('Buscando cuidador:', email.toLowerCase())
  const cuidador = cuidadores.find(
    (c: any) => c.email?.toLowerCase() === email.toLowerCase() && c.password === password,
  )
  console.log('Cuidador encontrado:', cuidador)
  
  if (cuidador) {
    const payload = JSON.stringify({ email: cuidador.email, exp: Date.now() + 86_400_000 })
    const token = btoa(unescape(encodeURIComponent(payload)))
    return {
      token,
      cuidador: { id: cuidador.id, name: cuidador.name, email: cuidador.email, phone: cuidador.phone ?? '' },
      tipo: 'cuidador',
    }
  }

  const familiaresRaw = await AsyncStorage.getItem(KEYS.familiares)
  console.log('Familiares en storage:', familiaresRaw)
  const familiares = JSON.parse(familiaresRaw || '[]')
  const familiar = familiares.find(
    (f: any) => f.email?.toLowerCase() === email.toLowerCase() && f.password === password,
  )
  console.log('Familiar encontrado:', familiar)
  
  if (familiar) {
    const payload = JSON.stringify({ email: familiar.email, exp: Date.now() + 86_400_000 })
    const token = btoa(unescape(encodeURIComponent(payload)))
    return {
      token,
      cuidador: { id: familiar.id, name: familiar.name, email: familiar.email, phone: familiar.phone ?? '' },
      familiar: { id: familiar.id, name: familiar.name, email: familiar.email, phone: familiar.phone, grupo_id: familiar.grupo_id },
      tipo: 'familiar',
    }
  }

  console.log('No se encontró usuario')
  return null
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
  nombre_paciente: string; edad_paciente: number; enfermedad?: string; id_cuidador: string; id_dispositivo?: string
}) {
  const lista = JSON.parse(
    (await AsyncStorage.getItem(KEYS.pacientes)) || '[]',
  )
  const nuevo = { 
    id: `pac_${Date.now()}`, 
    id_paciente: `pac_${Date.now()}`,
    nombre_paciente: datos.nombre_paciente,
    edad_paciente: datos.edad_paciente,
    enfermedad: datos.enfermedad || null,
    id_cuidador: datos.id_cuidador,
    id_dispositivo: datos.id_dispositivo || null,
    ultima_ubicacion: null,
    activo: true
  }
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

// ── Familiares ───────────────────────────────────────────────────────────

async function getFamiliares(): Promise<any[]> {
  await seed()
  const raw = await AsyncStorage.getItem(KEYS.familiares)
  return JSON.parse(raw || '[]')
}

async function saveFamiliares(lista: any[]) {
  await AsyncStorage.setItem(KEYS.familiares, JSON.stringify(lista))
}

export async function localRegisterFamiliar(datos: {
  name: string; email: string; password: string; phone?: string; codigo_grupo?: string
}) {
  const lista = await getFamiliares()
  if (lista.find((f: any) => f.email === datos.email.toLowerCase())) {
    throw new Error('Este correo ya ha sido registrado')
  }
  
  const gruposRaw = await AsyncStorage.getItem(KEYS.grupos)
  const grupos = JSON.parse(gruposRaw || '[]')
  let grupoId = null
  
  if (datos.codigo_grupo) {
    const grupo = grupos.find((g: any) => g.codigo === datos.codigo_grupo)
    if (grupo) {
      grupoId = grupo.id
      if (!grupo.miembros) grupo.miembros = []
      grupo.miembros.push(datos.email)
      await AsyncStorage.setItem(KEYS.grupos, JSON.stringify(grupos))
    }
  }

  if (!grupoId) {
    const nuevoGrupo = {
      id: `grupo_${Date.now()}`,
      codigo: `FAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      nombre: 'Mi Familia',
      created_at: new Date().toISOString(),
      cuidador_id: null,
      miembros: [datos.email],
    }
    grupos.push(nuevoGrupo)
    await AsyncStorage.setItem(KEYS.grupos, JSON.stringify(grupos))
    grupoId = nuevoGrupo.id
  }

  const nuevo = {
    id: `fam_${Date.now()}`,
    name: datos.name,
    email: datos.email.toLowerCase(),
    password: datos.password,
    phone: datos.phone ?? '',
    grupo_id: grupoId,
    is_active: true,
  }
  lista.push(nuevo)
  await saveFamiliares(lista)
  return { mensaje: 'Familiar registrado exitosamente' }
}

export async function localLoginFamiliar(email: string, password: string) {
  const lista = await getFamiliares()
  const user = lista.find(
    (f: any) => f.email === email.toLowerCase() && f.password === password,
  )
  if (!user) return null
  const payload = JSON.stringify({ email: user.email, exp: Date.now() + 86_400_000 })
  const token = btoa(unescape(encodeURIComponent(payload)))
  return {
    token,
    familiar: { id: user.id, name: user.name, email: user.email, phone: user.phone, grupo_id: user.grupo_id },
  }
}

export async function localListarGrupos() {
  const raw = await AsyncStorage.getItem(KEYS.grupos)
  return JSON.parse(raw || '[]')
}

export async function localCrearGrupo(nombre: string, cuidadorId: string) {
  const grupos = await localListarGrupos()
  const nuevo = {
    id: `grupo_${Date.now()}`,
    codigo: `FAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    nombre,
    cuidador_id: cuidadorId,
    pacientes: [],
    created_at: new Date().toISOString(),
  }
  grupos.push(nuevo)
  await AsyncStorage.setItem(KEYS.grupos, JSON.stringify(grupos))
  return nuevo
}
