import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Polyline, Region, UrlTile } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { pacienteService } from '@/services/api'

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
  const mapRef = useRef<MapView>(null)
  const [loading,           setLoading]           = useState(true)
  const [pacientes,         setPacientes]         = useState<any[]>([])
  const [ubicaciones,       setUbicaciones]       = useState<Ubicacion[]>([])
  const [selectedPaciente,  setSelectedPaciente]  = useState<string | null>(null)

  const cargarRuta = useCallback(async (pacienteId: string) => {
    try {
      const res  = await pacienteService.ruta(pacienteId)
      const hist = Array.isArray(res.data) ? res.data : []
      setUbicaciones(hist)
    } catch {
      setUbicaciones([])
    }
  }, [])

  const cargarDatos = useCallback(async () => {
    try {
      const resPac = await pacienteService.listar()
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
  }, [cargarRuta])

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
            urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
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

        {ubicaciones.length > 0 && (
          <View style={styles.countOverlay}>
            <Text style={styles.countText}>{ubicaciones.length} puntos registrados</Text>
          </View>
        )}
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
  countOverlay: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, elevation: 4,
  },
  countText: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: Colors.background,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})
