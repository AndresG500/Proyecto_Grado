import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import mockData from '@/data/mockDb.json'

export default function VincularDispositivoScreen() {
  const router = useRouter()
  const [buscando,     setBuscando]     = useState(true)
  const [dispositivos, setDispositivos] = useState<any[]>([])
  const [vinculando,   setVinculando]   = useState<string | null>(null)
  const [vinculado,    setVinculado]    = useState(false)

  useEffect(() => {
    // Simula búsqueda BLE/WiFi de dispositivos disponibles
    const t = setTimeout(() => {
      setDispositivos(mockData.dispositivos)
      setBuscando(false)
    }, 2500)
    return () => clearTimeout(t)
  }, [])

  const handleVincular = async (disp: any) => {
    setVinculando(disp.id)
    await new Promise((r) => setTimeout(r, 1500))
    setVinculando(null)
    setVinculado(true)
  }

  if (vinculado) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={52} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>¡Dispositivo vinculado!</Text>
          <Text style={styles.successSub}>El dispositivo GPS quedó asociado al paciente correctamente.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(app)/' as any)} activeOpacity={0.85}>
            <Text style={styles.btnText}>Ir al mapa</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Vincular dispositivo</Text>
      </View>

      <View style={styles.body}>
        {buscando ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primaryLight} />
            <Text style={styles.buscandoText}>Buscando dispositivos GPS...</Text>
            <Text style={styles.buscandoSub}>Asegúrate de que el ESP32 esté encendido y cerca.</Text>
          </View>
        ) : dispositivos.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="wifi-outline" size={64} color={Colors.primaryLight} />
            <Text style={styles.buscandoText}>No se encontraron dispositivos</Text>
            <TouchableOpacity style={styles.btn} onPress={() => { setBuscando(true); setTimeout(() => { setDispositivos(mockData.dispositivos); setBuscando(false) }, 2000) }} activeOpacity={0.85}>
              <Text style={styles.btnText}>Buscar de nuevo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.listTitle}>Dispositivos encontrados</Text>
            <FlatList
              data={dispositivos}
              keyExtractor={(d) => d.id}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <View style={styles.dispCard}>
                  <View style={styles.dispIcon}>
                    <Ionicons name="hardware-chip-outline" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.dispInfo}>
                    <Text style={styles.dispNombre}>{item.nombre}</Text>
                    <Text style={styles.dispMac}>{item.mac}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.vincBtn, vinculando === item.id && styles.vincBtnLoading]}
                    onPress={() => handleVincular(item)}
                    disabled={!!vinculando}
                    activeOpacity={0.85}
                  >
                    {vinculando === item.id
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Text style={styles.vincBtnText}>Vincular</Text>}
                  </TouchableOpacity>
                </View>
              )}
            />
          </>
        )}
      </View>

      <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(app)/' as any)} activeOpacity={0.7}>
        <Text style={styles.skipText}>Omitir por ahora</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.primary },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  body:    { flex: 1, backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  buscandoText: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  buscandoSub:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  listTitle:    { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  dispCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 12, elevation: 3 },
  dispIcon:  { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center' },
  dispInfo:  { flex: 1 },
  dispNombre:{ fontSize: 15, fontWeight: '700', color: Colors.text },
  dispMac:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  vincBtn:   { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  vincBtnLoading: { opacity: 0.7 },
  vincBtnText:    { color: Colors.white, fontWeight: '700', fontSize: 13 },
  btn:       { backgroundColor: Colors.white, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  btnText:   { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  skipBtn:   { alignItems: 'center', paddingVertical: 20 },
  skipText:  { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  successTitle:{ fontSize: 26, fontWeight: '800', color: Colors.white },
  successSub:  { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 21 },
})
