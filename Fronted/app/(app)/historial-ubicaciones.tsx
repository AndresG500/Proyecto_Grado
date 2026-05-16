import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Polyline, Region, UrlTile } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { pacienteService, familiarService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const SANTA_MARTA: Region = {
  latitude:      11.2404,
  longitude:    -74.2110,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
}

interface Ubicacion {
  id: string
  paciente_id: string
  coordenadas: { latitud: number; longitud: number }
  timestamp: string
}

export default function HistorialUbicacionesScreen() {
  const router = useRouter()
  const { tipoUsuario } = useAuth()
  const mapRef = useRef<MapView>(null)
  const [loading,           setLoading]           = useState(true)
  const [pacientes,         setPacientes]         = useState<any[]>([])
  const [ubicaciones,       setUbicaciones]       = useState<Ubicacion[]>([])
  const [selectedPaciente,  setSelectedPaciente]  = useState<string | null>(null)

  const cargarRuta = useCallback(async (pacienteId: string) => {
    try {
      const res  = tipoUsuario === 'familiar'
        ? await pacienteService.rutaFamiliar(pacienteId)
        : await pacienteService.ruta(pacienteId)
      const hist = Array.isArray(res.data) ? res.data : []
      setUbicaciones(hist)
    } catch {
      setUbicaciones([])
    }
  }, [tipoUsuario])

  const cargarDatos = useCallback(async () => {
    try {
      const resPac = tipoUsuario === 'familiar'
        ? await familiarService.misPacientes()
        : await pacienteService.listar()
      const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
      setPacientes(pacs)

      if (pacs.length > 0) {
        const id = pacs[0].id_paciente ?? pacs[0].id
        setSelectedPaciente(id)
        await cargarRuta(id)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [cargarRuta, tipoUsuario])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => {
    if (selectedPaciente) cargarRuta(selectedPaciente)
  }, [selectedPaciente, cargarRuta])

  const routeCoordinates = ubicaciones
    .slice(0, 100)
    .map(u => ({ latitude: u.coordenadas.latitud, longitude: u.coordenadas.longitud }))

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de ubicaciones</Text>
      </View>

      {pacientes.length > 1 && (
        <View style={styles.pacientesRow}>
          <FlatList
            horizontal
            data={pacientes}
            keyExtractor={(p) => p.id_paciente ?? p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => {
              const id      = item.id_paciente ?? item.id
              const nombre  = item.nombre_paciente
              const selected = selectedPaciente === id
              return (
                <TouchableOpacity
                  style={[styles.pacChip, selected && styles.pacChipSelected]}
                  onPress={() => setSelectedPaciente(id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pacChipText, selected && styles.pacChipTextSelected]}>
                    {nombre}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={SANTA_MARTA}
          showsUserLocation
          mapType="none"
        >
          <UrlTile
            urlTemplate={`https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${process.env.EXPO_PUBLIC_STADIA_API_KEY}`}
            maximumZ={19}
          />
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
          )}
        </MapView>

        {ubicaciones.length > 0 && (() => {
          const pac     = pacientes.find(p => (p.id_paciente ?? p.id) === selectedPaciente)
          const ultimo  = ubicaciones[ubicaciones.length - 1]
          const lat     = ultimo?.coordenadas?.latitud
          const lng     = ultimo?.coordenadas?.longitud
          const ts      = ultimo?.timestamp ? new Date(ultimo.timestamp) : null
          const tsStr   = ts
            ? ts.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : null
          return (
            <View style={styles.infoOverlay}>
              <View style={styles.infoRow}>
                <Ionicons name="person-circle" size={18} color={Colors.primary} />
                <Text style={styles.infoNombre} numberOfLines={1}>
                  {pac?.nombre_paciente ?? '—'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={14} color={Colors.textSecondary} />
                <Text style={styles.infoCoordenadas}>
                  {lat?.toFixed(5) ?? '—'}, {lng?.toFixed(5) ?? '—'}
                </Text>
              </View>
              {tsStr && (
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.infoTs}>{tsStr}</Text>
                </View>
              )}
              <Text style={styles.infoPuntos}>{ubicaciones.length} puntos · últimos 7 días</Text>
            </View>
          )
        })()}
      </View>

      {ubicaciones.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>Sin historial</Text>
          <Text style={styles.emptyDesc}>
            Las ubicaciones aparecerán aquí cuando el dispositivo GPS envíe datos.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 14,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pacientesRow: { backgroundColor: Colors.background, paddingVertical: 12 },
  pacChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  pacChipSelected:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pacChipText:         { fontSize: 13, color: Colors.text, fontWeight: '500' },
  pacChipTextSelected: { color: Colors.white },
  mapContainer: { flex: 1 },
  map:          { flex: 1 },
  infoOverlay: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: Colors.white,
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
    elevation: 6, gap: 5,
  },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoNombre:     { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  infoCoordenadas:{ fontSize: 12, color: Colors.textSecondary, fontFamily: 'monospace' },
  infoTs:         { fontSize: 12, color: Colors.textSecondary },
  infoPuntos:     { fontSize: 11, color: Colors.primaryLight, marginTop: 2 },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: Colors.background,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})
