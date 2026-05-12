import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '@/constants/Colors'
import { pacienteService } from '@/services/api'

const SANTA_MARTA: Region = {
  latitude:      11.2404,
  longitude:    -74.2110,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
}

const KEYS = {
  historial_ubicaciones: '@ubilife_historial_ubicaciones',
}

interface Ubicacion {
  id: string
  patient_id: string
  patient_name: string
  latitude: number
  longitude: number
  timestamp: string
}

export default function HistorialUbicacionesScreen() {
  const router = useRouter()
  const mapRef = useRef<MapView>(null)
  const [loading, setLoading] = useState(true)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [selectedPaciente, setSelectedPaciente] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    try {
      const resPac = await pacienteService.listar()
      const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
      setPacientes(pacs)
      if (pacs.length > 0 && !selectedPaciente) {
        setSelectedPaciente(pacs[0].id_paciente || pacs[0].id)
      }

      const raw = await AsyncStorage.getItem(KEYS.historial_ubicaciones)
      const hist: Ubicacion[] = JSON.parse(raw || '[]')
      setUbicaciones(hist)
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedPaciente])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const ubicacionesFiltradas = selectedPaciente
    ? ubicaciones.filter(u => u.patient_id === selectedPaciente)
    : ubicaciones

  const routeCoordinates = ubicacionesFiltradas
    .slice(0, 50)
    .map(u => ({ latitude: u.latitude, longitude: u.longitude }))

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
            keyExtractor={(p) => p.id_paciente || p.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => {
              const id = item.id_paciente || item.id
              const nombre = item.nombre_paciente || item.name
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
          provider={PROVIDER_GOOGLE}
          initialRegion={SANTA_MARTA}
          showsUserLocation
        >
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
          )}
        </MapView>

        {ubicacionesFiltradas.length > 0 && (
          <View style={styles.noDataOverlay}>
            <Text style={styles.noDataText}>
              {ubicacionesFiltradas.length} ubicaciones registradas
            </Text>
          </View>
        )}
      </View>

      {ubicacionesFiltradas.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>Sin historial</Text>
          <Text style={styles.emptyDesc}>
            Las ubicaciones del paciente aparecerán aquí cuando el dispositivo GPS envíe datos.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 16, 
    paddingBottom: 12,
    gap: 14 
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  pacientesRow: {
    backgroundColor: Colors.background,
    paddingVertical: 12,
  },
  pacChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pacChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pacChipText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  pacChipTextSelected: { color: Colors.white },

  mapContainer: { flex: 1 },
  map: { flex: 1 },
  noDataOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
  },
  noDataText: { fontSize: 14, color: Colors.text, fontWeight: '600' },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})