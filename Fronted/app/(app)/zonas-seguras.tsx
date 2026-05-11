import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { zonaService, pacienteService } from '@/services/api'

export default function ZonasSeguras() {
  const router = useRouter()
  const [zonas,     setZonas]     = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [nombre,    setNombre]    = useState('')
  const [radio,     setRadio]     = useState('150')
  const [pacSelId,  setPacSelId]  = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    try {
      const [resPac] = await Promise.all([pacienteService.listar()])
      const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
      setPacientes(pacs)
      if (pacs.length > 0 && !pacSelId) setPacSelId(pacs[0].id)

      const todas: any[] = []
      for (const p of pacs) {
        const rz = await zonaService.listarPorPaciente(p.id)
        todas.push(...(Array.isArray(rz.data) ? rz.data : []))
      }
      setZonas(todas)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleCrear = async () => {
    if (!nombre.trim()) return
    const radioNum = parseInt(radio)
    if (isNaN(radioNum) || radioNum < 50 || radioNum > 500) {
      Alert.alert('Radio inválido', 'El radio debe estar entre 50 y 500 metros.')
      return
    }
    setGuardando(true)
    try {
      const pac = pacientes.find((p) => p.id === pacSelId)
      const centro = pac?.ultima_ubicacion ?? { lat: 11.2404, lng: -74.211 }
      const res = await zonaService.crear({ nombre: nombre.trim(), paciente_id: pacSelId, centro, radio: radioNum })
      setZonas((z) => [...z, res.data])
      setModal(false); setNombre(''); setRadio('150')
    } finally { setGuardando(false) }
  }

  const handleEliminar = (id: string) => {
    Alert.alert('Eliminar zona', '¿Seguro que quieres eliminar esta zona segura?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          await zonaService.eliminar(id)
          setZonas((z) => z.filter((x) => x.id !== id))
        }},
    ])
  }

  const handleToggle = async (id: string) => {
    await zonaService.toggle(id)
    setZonas((z) => z.map((x) => x.id === id ? { ...x, activa: !x.activa } : x))
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zonas seguras</Text>
        <TouchableOpacity onPress={() => setModal(true)} style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primaryLight} /></View>
      ) : (
        <FlatList
          data={zonas}
          keyExtractor={(z) => z.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="shield-outline" size={56} color={Colors.primaryLight} />
              <Text style={styles.emptyText}>No hay zonas seguras{'\n'}Toca + para crear una</Text>
            </View>
          }
          renderItem={({ item }) => {
            const pac = pacientes.find((p) => p.id === item.paciente_id)
            return (
              <View style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.zonaIcon, !item.activa && styles.zonaIconOff]}>
                    <Ionicons name="shield-checkmark" size={22} color={item.activa ? Colors.primary : Colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.zonaNombre}>{item.nombre}</Text>
                    <Text style={styles.zonaMeta}>{pac?.name ?? '—'} · {item.radio}m</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleToggle(item.id)} activeOpacity={0.7} style={styles.actionBtn}>
                    <Ionicons name={item.activa ? 'toggle' : 'toggle-outline'} size={28} color={item.activa ? Colors.primary : Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleEliminar(item.id)} activeOpacity={0.7} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
        />
      )}

      {/* Modal crear zona */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva zona segura</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} placeholder="Ej: Casa, Parque"
                placeholderTextColor={Colors.textSecondary} value={nombre} onChangeText={setNombre} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Radio (metros, 50–500)</Text>
              <TextInput style={styles.input} keyboardType="number-pad"
                placeholder="150" placeholderTextColor={Colors.textSecondary} value={radio} onChangeText={setRadio} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Paciente</Text>
              {pacientes.map((p) => (
                <TouchableOpacity key={p.id} style={[styles.pacOpcion, pacSelId === p.id && styles.pacOpcionActiva]}
                  onPress={() => setPacSelId(p.id)} activeOpacity={0.8}>
                  <Text style={[styles.pacOpcionText, pacSelId === p.id && styles.pacOpcionTextActiva]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hint}>El centro de la zona se establecerá en la última ubicación conocida del paciente.</Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)} activeOpacity={0.8}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.crearBtn, guardando && styles.crearBtnLoading]}
                onPress={handleCrear} disabled={guardando} activeOpacity={0.85}>
                {guardando ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.crearText}>Crear zona</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backBtn:{ padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.white },
  addBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyText: { fontSize: 15, color: Colors.primaryLight, textAlign: 'center', lineHeight: 22 },
  list:   { padding: 16, gap: 12 },
  card:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 12, elevation: 3 },
  cardLeft:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
  zonaIcon:  { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center' },
  zonaIconOff: { backgroundColor: Colors.surface },
  zonaNombre:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  zonaMeta:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28 },
  modalTitle:  { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  field:       { marginBottom: 16 },
  label:       { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
  input:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.text, backgroundColor: Colors.background },
  pacOpcion:   { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 6 },
  pacOpcionActiva: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  pacOpcionText:   { fontSize: 14, color: Colors.textSecondary },
  pacOpcionTextActiva: { color: Colors.primary, fontWeight: '700' },
  hint:        { fontSize: 12, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  modalBtns:   { flexDirection: 'row', gap: 12 },
  cancelBtn:   { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText:  { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  crearBtn:    { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  crearBtnLoading: { opacity: 0.65 },
  crearText:   { color: Colors.white, fontWeight: '700', fontSize: 15 },
})
