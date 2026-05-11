import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import MapView, { PROVIDER_GOOGLE, Marker, Circle, Region } from 'react-native-maps'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { pacienteService, zonaService } from '@/services/api'

const SANTA_MARTA: Region = {
  latitude:      11.2404,
  longitude:    -74.2110,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
}

export default function MapScreen() {
  const navigation = useNavigation()
  const mapRef     = useRef<MapView>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [zonas,     setZonas]     = useState<any[]>([])
  const [online,    setOnline]    = useState(true)
  const [loading,   setLoading]   = useState(true)

  const cargarDatos = useCallback(async () => {
    try {
      const resPac = await pacienteService.listar()
      const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
      setPacientes(pacs)

      const todasZonas: any[] = []
      for (const p of pacs) {
        try {
          const rz = await zonaService.listarPorPaciente(p.id)
          todasZonas.push(...(Array.isArray(rz.data) ? rz.data : []))
        } catch {}
      }
      setZonas(todasZonas)
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
    const intervalo = setInterval(cargarDatos, 30_000)
    return () => clearInterval(intervalo)
  }, [cargarDatos])

  const irAPaciente = (pac: any) => {
    if (!pac.ultima_ubicacion) return
    mapRef.current?.animateToRegion({
      latitude:      pac.ultima_ubicacion.lat,
      longitude:     pac.ultima_ubicacion.lng,
      latitudeDelta:  0.008,
      longitudeDelta: 0.008,
    }, 800)
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={SANTA_MARTA}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {zonas.map((zona) => (
          <Circle
            key={zona.id}
            center={{ latitude: zona.centro.lat, longitude: zona.centro.lng }}
            radius={zona.radio}
            fillColor={zona.activa ? 'rgba(37,99,235,0.12)' : 'rgba(100,100,100,0.1)'}
            strokeColor={zona.activa ? Colors.primary : '#888'}
            strokeWidth={2}
          />
        ))}

        {pacientes.map((pac) => {
          if (!pac.ultima_ubicacion) return null
          return (
            <Marker
              key={pac.id}
              coordinate={{ latitude: pac.ultima_ubicacion.lat, longitude: pac.ultima_ubicacion.lng }}
              title={pac.name}
              description={pac.diagnostico ?? ''}
              onPress={() => irAPaciente(pac)}
            >
              <View style={styles.markerWrap}>
                <Ionicons name="person" size={14} color={Colors.white} />
              </View>
            </Marker>
          )
        })}
      </MapView>

      {/* Botón menú */}
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        activeOpacity={0.85}
      >
        <Ionicons name="menu" size={24} color={Colors.primary} />
      </TouchableOpacity>

      {/* Badge estado conexión */}
      <View style={[styles.statusBadge, !online && styles.statusBadgeOffline]}>
        {loading
          ? <ActivityIndicator size="small" color={online ? Colors.success : Colors.warning} />
          : <View style={[styles.statusDot, !online && styles.statusDotOffline]} />}
        <Text style={[styles.statusText, !online && styles.statusTextOffline]}>
          {loading ? 'Cargando...' : online ? 'En línea' : 'Sin conexión'}
        </Text>
      </View>

      {/* Chips de pacientes abajo */}
      {pacientes.length > 0 && (
        <View style={styles.pacientesBar}>
          {pacientes.map((pac) => (
            <TouchableOpacity
              key={pac.id}
              style={styles.pacienteChip}
              onPress={() => irAPaciente(pac)}
              activeOpacity={0.8}
            >
              <View style={styles.chipDot} />
              <Text style={styles.chipText} numberOfLines={1}>{pac.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  menuBtn: {
    position: 'absolute', top: 52, left: 16,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },

  statusBadge: {
    position: 'absolute', top: 52, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  statusBadgeOffline: { backgroundColor: '#FFF8E1' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  statusDotOffline: { backgroundColor: Colors.warning },
  statusText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  statusTextOffline: { color: Colors.warning },

  markerWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
    elevation: 4,
  },

  pacientesBar: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  pacienteChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: 120 },
})
