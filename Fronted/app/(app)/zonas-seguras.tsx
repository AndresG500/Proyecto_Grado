import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Circle, Marker, MapPressEvent, Region, UrlTile } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { zonaService, pacienteService, familiarService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const { height: SCREEN_H } = Dimensions.get('window')

const SANTA_MARTA: Region = {
  latitude: 11.2404, longitude: -74.211,
  latitudeDelta: 0.04, longitudeDelta: 0.04,
}

type Coord = { latitud: number; longitud: number }

export default function ZonasSeguras() {
  const router  = useRouter()
  const mapRef  = useRef<MapView>(null)
  const { tipoUsuario } = useAuth()
  const esFamiliar = tipoUsuario === 'familiar'

  const [zonas,     setZonas]     = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  // Creación
  const [creando,   setCreando]   = useState(false)
  const [nombre,    setNombre]    = useState('')
  const [radio,     setRadio]     = useState('150')
  const [pacSelId,  setPacSelId]  = useState('')
  const [centro,    setCentro]    = useState<Coord | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [toggling,  setToggling]  = useState<string | null>(null)

  const cargar = async () => {
    try {
      if (esFamiliar) {
        const [resPac, resZonas] = await Promise.all([
          familiarService.misPacientes(),
          zonaService.listarFamiliar(),
        ])
        const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
        setPacientes(pacs)
        const validas = (Array.isArray(resZonas.data) ? resZonas.data : []).filter((z: any) => !!z.id)
        setZonas(validas)
      } else {
        const resPac = await pacienteService.listar()
        const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
        setPacientes(pacs)
        if (pacs.length > 0) setPacSelId(pacs[0].id_paciente ?? pacs[0].id)

        const resultados = await Promise.all(
          pacs.map((p) =>
            zonaService.listarPorPaciente(p.id_paciente ?? p.id).catch(() => ({ data: [] }))
          )
        )
        const todas = resultados.flatMap((rz) =>
          (Array.isArray(rz.data) ? rz.data : []).filter((z: any) => !!z.id)
        )
        setZonas(todas)
      }
    } catch {
      setZonas([])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate
    setCentro({ latitud: latitude, longitud: longitude })
  }

  const handleCrear = async () => {
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Escribe un nombre para la zona.'); return }
    if (!centro)        { Alert.alert('Falta el centro', 'Toca el mapa para elegir el centro de la zona.'); return }
    const radioNum = parseInt(radio)
    if (isNaN(radioNum) || radioNum < 50 || radioNum > 500) {
      Alert.alert('Radio inválido', 'El radio debe estar entre 50 y 500 metros.'); return
    }
    setGuardando(true)
    try {
      await zonaService.crear({ nombre: nombre.trim(), paciente_id: pacSelId, centro, radio_metros: radioNum })
      setCreando(false); setNombre(''); setRadio('150'); setCentro(null)
      await cargar()
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo crear la zona.')
    } finally { setGuardando(false) }
  }

  const handleEliminar = (id: string) => {
    Alert.alert('Eliminar zona', '¿Seguro que quieres eliminar esta zona segura?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await zonaService.eliminar(id)
            setZonas((z) => z.filter((x) => x.id !== id))
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail ?? 'No se pudo eliminar la zona.')
          }
        }},
    ])
  }

  const handleToggle = async (id: string, activa: boolean) => {
    if (toggling) return
    setToggling(id)
    try {
      await zonaService.toggle(id, !activa)
      setZonas((z) => z.map((x) => x.id === id ? { ...x, activa: !x.activa } : x))
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'No se pudo actualizar la zona.')
    } finally {
      setToggling(null)
    }
  }

  // ── Vista de creación con mapa ─────────────────────────────────────────
  if (creando) {
    const radioNum = parseInt(radio) || 150
    return (
      <View style={{ flex: 1 }}>
        {/* Mapa interactivo */}
        <MapView
          ref={mapRef}
          style={styles.mapCrear}
          initialRegion={SANTA_MARTA}
          onPress={handleMapPress}
          showsUserLocation
          rotateEnabled={false}
          toolbarEnabled={false}
          mapType="none"
        >
          <UrlTile
            urlTemplate={`https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${process.env.EXPO_PUBLIC_STADIA_API_KEY}`}
            maximumZ={19}
          />
          {centro && (
            <>
              <Marker coordinate={{ latitude: centro.latitud, longitude: centro.longitud }}>
                <View style={styles.markerWrap}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.white} />
                </View>
              </Marker>
              <Circle
                center={{ latitude: centro.latitud, longitude: centro.longitud }}
                radius={radioNum}
                fillColor="rgba(37,99,235,0.15)"
                strokeColor={Colors.primary}
                strokeWidth={2}
              />
            </>
          )}
        </MapView>

        {/* Instrucción flotante */}
        {!centro && (
          <View style={styles.hint}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.white} />
            <Text style={styles.hintText}>Toca el mapa para elegir el centro de la zona</Text>
          </View>
        )}

        {/* Panel inferior */}
        <SafeAreaView style={styles.panel} edges={['bottom']}>
          <View style={styles.panelHandle} />

          <Text style={styles.panelTitle}>Nueva zona segura</Text>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} placeholder="Ej: Casa, Parque"
                placeholderTextColor={Colors.textSecondary}
                value={nombre} onChangeText={setNombre} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Radio (m)</Text>
              <TextInput style={[styles.input, { width: 80, textAlign: 'center' }]}
                keyboardType="number-pad" placeholder="150"
                placeholderTextColor={Colors.textSecondary}
                value={radio} onChangeText={setRadio} />
            </View>
          </View>

          {pacientes.length > 1 && (
            <View style={styles.field}>
              <Text style={styles.label}>Paciente</Text>
              <View style={styles.pacRow}>
                {pacientes.map((p) => {
                  const pid = p.id_paciente ?? p.id
                  return (
                  <TouchableOpacity key={pid}
                    style={[styles.pacChip, pacSelId === pid && styles.pacChipActivo]}
                    onPress={() => setPacSelId(pid)} activeOpacity={0.8}>
                    <Text style={[styles.pacChipText, pacSelId === pid && styles.pacChipTextActivo]}
                      numberOfLines={1}>{p.nombre_paciente}</Text>
                  </TouchableOpacity>
                )})}
              </View>
            </View>
          )}

          {centro && (
            <View style={styles.coordBox}>
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.coordText}>
                {centro.latitud.toFixed(5)}, {centro.longitud.toFixed(5)}
              </Text>
              <TouchableOpacity onPress={() => setCentro(null)} style={{ marginLeft: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.panelBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreando(false); setCentro(null) }} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.crearBtn, (!centro || guardando) && styles.crearBtnDisabled]}
              onPress={handleCrear} disabled={!centro || guardando} activeOpacity={0.85}>
              {guardando
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.crearText}>Guardar zona</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  // ── Vista de lista ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zonas seguras</Text>
        {!esFamiliar && (
          <TouchableOpacity onPress={() => setCreando(true)} style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={26} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primaryLight} /></View>
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={styles.list}>
          {zonas.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="shield-outline" size={56} color={Colors.primaryLight} />
              <Text style={styles.emptyText}>
                {esFamiliar ? 'No hay zonas seguras registradas' : 'No hay zonas seguras\nToca + para crear una'}
              </Text>
            </View>
          ) : zonas.map((item) => {
            const pac = pacientes.find((p) => (p.id_paciente ?? p.id) === item.paciente_id)
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.zonaIcon, !item.activa && styles.zonaIconOff]}>
                    <Ionicons name="shield-checkmark" size={22}
                      color={item.activa ? Colors.primary : Colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.zonaNombre}>{item.nombre}</Text>
                    <Text style={styles.zonaMeta}>{pac?.nombre_paciente ?? '—'} · {item.radio_metros}m</Text>
                  </View>
                </View>
                {!esFamiliar && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => handleToggle(item.id, item.activa)}
                      activeOpacity={0.7}
                      style={[styles.actionBtn, toggling === item.id && { opacity: 0.4 }]}
                      disabled={toggling !== null}
                    >
                      {toggling === item.id
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Ionicons name={item.activa ? 'toggle' : 'toggle-outline'} size={28}
                            color={item.activa ? Colors.primary : Colors.textSecondary} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminar(item.id)} activeOpacity={0.7} style={styles.actionBtn}>
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.white },
  addBtn:      { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyText: { fontSize: 15, color: Colors.primaryLight, textAlign: 'center', lineHeight: 22 },
  list:   { padding: 16, gap: 12, flexGrow: 1 },
  card:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 12, elevation: 3 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { padding: 6 },
  zonaIcon:    { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center' },
  zonaIconOff: { backgroundColor: Colors.surface },
  zonaNombre:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  zonaMeta:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Creación con mapa
  mapCrear: { flex: 1, height: SCREEN_H * 0.52 },
  hint:     { position: 'absolute', top: 52, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  hintText: { color: Colors.white, fontSize: 13, fontWeight: '500' },
  markerWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white, elevation: 4 },

  panel: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12, elevation: 16 },
  panelHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  panelTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  row:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  field:  { marginBottom: 14 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input:  { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: Colors.text, backgroundColor: Colors.background },
  pacRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pacChip:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  pacChipActivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  pacChipText:       { fontSize: 13, color: Colors.textSecondary },
  pacChipTextActivo: { color: Colors.primary, fontWeight: '700' },
  coordBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryBg, borderRadius: 10, padding: 10, marginBottom: 14, gap: 6 },
  coordText:{ flex: 1, fontSize: 12, color: Colors.primary, fontWeight: '600' },
  panelBtns:  { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn:  { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  crearBtn:   { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  crearBtnDisabled: { opacity: 0.45 },
  crearText:  { color: Colors.white, fontWeight: '700', fontSize: 15 },
})
