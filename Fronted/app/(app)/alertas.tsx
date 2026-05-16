import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { alertaService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const ESTADO_COLOR: Record<string, string> = {
  enviada:  Colors.error,
  pendiente: Colors.warning,
  resuelta: Colors.success,
  fallida:  Colors.textSecondary,
}

export default function AlertasScreen() {
  const router = useRouter()
  const { tipoUsuario } = useAuth()
  const esFamiliar = tipoUsuario === 'familiar'

  const [alertas,  setAlertas]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [resolviendo, setResolviendo] = useState<string | null>(null)

  const cargar = async () => {
    try {
      const res = esFamiliar ? await alertaService.listarFamiliar() : await alertaService.listar()
      const lista = Array.isArray(res.data) ? res.data : []
      setAlertas(lista.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
    } catch {
      setAlertas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleResolver = async (id: string) => {
    setResolviendo(id)
    try {
      await alertaService.resolver(id)
      setAlertas((prev) => prev.map((a) => a.id === id ? { ...a, estado: 'resuelta' } : a))
    } finally {
      setResolviendo(null)
    }
  }

  const formatFecha = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de alertas</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primaryLight} /></View>
      ) : (
        <FlatList
          data={alertas}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={56} color={Colors.primaryLight} />
              <Text style={styles.emptyText}>No hay alertas registradas</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.estadoBadge, { backgroundColor: ESTADO_COLOR[item.estado] + '22' }]}>
                <View style={[styles.estadoDot, { backgroundColor: ESTADO_COLOR[item.estado] }]} />
                <Text style={[styles.estadoText, { color: ESTADO_COLOR[item.estado] }]}>{item.estado}</Text>
              </View>

              <Text style={styles.pacienteNombre}>{item.paciente_nombre}</Text>
              <Text style={styles.tipo}>{item.tipo?.replace(/_/g, ' ')}</Text>

              <View style={styles.meta}>
                <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.metaText}>{formatFecha(item.timestamp)}</Text>
                {item.zona_nombre && (
                  <>
                    <Ionicons name="location-outline" size={13} color={Colors.textSecondary} style={{ marginLeft: 10 }} />
                    <Text style={styles.metaText}>{item.zona_nombre}</Text>
                  </>
                )}
              </View>

              {item.estado === 'enviada' && !esFamiliar && (
                <TouchableOpacity
                  style={[styles.resolverBtn, resolviendo === item.id && styles.resolverBtnLoading]}
                  onPress={() => handleResolver(item.id)}
                  disabled={!!resolviendo}
                  activeOpacity={0.85}
                >
                  {resolviendo === item.id
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={styles.resolverBtnText}>Marcar como resuelta</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyText: { fontSize: 16, color: Colors.primaryLight, textAlign: 'center' },
  list:   { padding: 16, gap: 12 },
  card:   { backgroundColor: Colors.white, borderRadius: 18, padding: 18, elevation: 3 },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10, gap: 6 },
  estadoDot:   { width: 7, height: 7, borderRadius: 4 },
  estadoText:  { fontSize: 12, fontWeight: '700' },
  pacienteNombre: { fontSize: 16, fontWeight: '700', color: Colors.text },
  tipo:         { fontSize: 13, color: Colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  meta:         { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  metaText:     { fontSize: 12, color: Colors.textSecondary },
  resolverBtn:  { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  resolverBtnLoading: { opacity: 0.7 },
  resolverBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
})
