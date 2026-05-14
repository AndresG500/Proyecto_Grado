import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { Colors } from '@/constants/Colors'
import { grupoService, pacienteService } from '@/services/api'

interface Grupo {
  id:                   string
  nombre:               string
  cuidador_principal_id: string
  cuidador_ids:         string[]
  paciente_ids:         string[]
  familiar_ids:         string[]
  codigo:               string
  created_at:           string
}

export default function GrupoFamiliarScreen() {
  const router = useRouter()
  const [loading,        setLoading]        = useState(true)
  const [grupos,         setGrupos]         = useState<Grupo[]>([])
  const [pacientes,      setPacientes]      = useState<any[]>([])
  const [modalCrear,     setModalCrear]     = useState(false)
  const [nombreNuevo,    setNombreNuevo]    = useState('')
  const [pacSelIds,      setPacSelIds]      = useState<string[]>([])
  const [guardando,      setGuardando]      = useState(false)

  const cargarDatos = async () => {
    try {
      const [resGrupos, resPac] = await Promise.all([
        grupoService.listar(),
        pacienteService.listar(),
      ])
      setGrupos(Array.isArray(resGrupos.data) ? resGrupos.data : [])
      setPacientes(Array.isArray(resPac.data) ? resPac.data : [])
    } catch (err) {
      console.error('Error cargando grupos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const handleCrearGrupo = async () => {
    if (!nombreNuevo.trim()) {
      Alert.alert('Falta el nombre', 'Escribe un nombre para el grupo.')
      return
    }
    setGuardando(true)
    try {
      const res = await grupoService.crear({
        nombre: nombreNuevo.trim(),
        paciente_ids: pacSelIds,
      })
      if (res.data?.error) {
        Alert.alert('Error', res.data.error)
        return
      }
      setModalCrear(false)
      setNombreNuevo('')
      setPacSelIds([])
      await cargarDatos()
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? 'No se pudo crear el grupo.'
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setGuardando(false)
    }
  }

  const eliminarGrupo = (grupoId: string) => {
    Alert.alert('Eliminar grupo', '¿Estás seguro de que quieres eliminar este grupo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await grupoService.eliminar(grupoId)
            setGrupos((prev) => prev.filter((g) => g.id !== grupoId))
          } catch (err: any) {
            const msg = err.response?.data?.detail ?? 'No se pudo eliminar el grupo.'
            Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg))
          }
        },
      },
    ])
  }

  const copiarCodigo = async (codigo: string) => {
    await Clipboard.setStringAsync(codigo)
    Alert.alert('Copiado', 'Código de invitación copiado al portapapeles.')
  }

  const togglePaciente = (id: string) => {
    setPacSelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

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
        <Text style={styles.headerTitle}>Grupo familiar</Text>
        <TouchableOpacity onPress={() => setModalCrear(true)} style={styles.addBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={26} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {grupos.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={48} color={Colors.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>Sin grupo familiar</Text>
            <Text style={styles.emptyDesc}>
              Crea un grupo para compartir el cuidado de pacientes con tu familia
            </Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => setModalCrear(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.createBtnText}>Crear grupo familiar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={grupos}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: grupo }) => {
              const pacientesGrupo = pacientes.filter((p) =>
                grupo.paciente_ids?.includes(p.id_paciente ?? p.id)
              )
              return (
                <View style={styles.grupoCard}>
                  <View style={styles.grupoHeader}>
                    <View style={styles.grupoIcon}>
                      <Ionicons name="people" size={24} color={Colors.primary} />
                    </View>
                    <View style={styles.grupoInfo}>
                      <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
                      <Text style={styles.grupoMeta}>
                        {grupo.cuidador_ids?.length ?? 0} cuidador(es) · {grupo.paciente_ids?.length ?? 0} paciente(s) · {grupo.familiar_ids?.length ?? 0} familiar(es)
                      </Text>
                    </View>
                  </View>

                  {pacientesGrupo.length > 0 && (
                    <View style={styles.pacientesSection}>
                      <Text style={styles.seccionLabel}>Pacientes</Text>
                      {pacientesGrupo.map((p) => (
                        <Text key={p.id_paciente ?? p.id} style={styles.pacienteItem}>
                          • {p.nombre_paciente}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.codigoBox}>
                    <View style={styles.codigoHeader}>
                      <Ionicons name="key" size={14} color={Colors.primary} />
                      <Text style={styles.codigoLabel}>Código de invitación</Text>
                    </View>
                    <View style={styles.codigoRow}>
                      <Text style={styles.codigoText}>{grupo.codigo ?? '—'}</Text>
                      <TouchableOpacity onPress={() => copiarCodigo(grupo.codigo)} style={styles.copyBtn}>
                        <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.codigoHint}>
                      Comparte este código con familiares para que puedan unirse
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.eliminarBtn}
                    onPress={() => eliminarGrupo(grupo.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    <Text style={styles.eliminarBtnText}>Eliminar grupo</Text>
                  </TouchableOpacity>
                </View>
              )
            }}
          />
        )}
      </View>

      <Modal visible={modalCrear} transparent animationType="slide" onRequestClose={() => setModalCrear(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setModalCrear(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nuevo grupo familiar</Text>

            <Text style={styles.fieldLabel}>Nombre del grupo</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="people-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ej: Familia García"
                placeholderTextColor={Colors.textSecondary}
                value={nombreNuevo}
                onChangeText={setNombreNuevo}
              />
            </View>

            {pacientes.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Pacientes (opcional)</Text>
                <View style={styles.pacRow}>
                  {pacientes.map((p) => {
                    const id       = p.id_paciente ?? p.id
                    const selected = pacSelIds.includes(id)
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.pacChip, selected && styles.pacChipActivo]}
                        onPress={() => togglePaciente(id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.pacChipText, selected && styles.pacChipTextActivo]}>
                          {p.nombre_paciente}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.modalBtn, guardando && { opacity: 0.65 }]}
              onPress={handleCrearGrupo}
              disabled={guardando}
              activeOpacity={0.85}
            >
              {guardando
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.modalBtnText}>Crear grupo</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.primary },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 14 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.white },
  addBtn:  { padding: 4 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, backgroundColor: Colors.background },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon:  { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  createBtn:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, gap: 8 },
  createBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  grupoCard:    { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 16, elevation: 2 },
  grupoHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  grupoIcon:    { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  grupoInfo:    { flex: 1 },
  grupoNombre:  { fontSize: 17, fontWeight: '700', color: Colors.text },
  grupoMeta:    { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  pacientesSection: { marginBottom: 12 },
  seccionLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  pacienteItem: { fontSize: 13, color: Colors.text, marginBottom: 2, paddingLeft: 4 },

  codigoBox:    { backgroundColor: Colors.primaryBg, borderRadius: 12, padding: 14, marginBottom: 14 },
  codigoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  codigoLabel:  { fontSize: 12, fontWeight: '600', color: Colors.primary },
  codigoRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  codigoText:   { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  codigoHint:   { fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },
  copyBtn:      { padding: 4, marginLeft: 8 },

  eliminarBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.error, borderRadius: 10, paddingVertical: 10, gap: 8 },
  eliminarBtnText: { color: Colors.error, fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalClose:   { alignSelf: 'flex-end', marginBottom: 12 },
  modalTitle:   { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 18 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, paddingVertical: 14, fontSize: 16, color: Colors.text },
  pacRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pacChip:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  pacChipActivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  pacChipText:       { fontSize: 13, color: Colors.textSecondary },
  pacChipTextActivo: { color: Colors.primary, fontWeight: '700' },
  modalBtn:     { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
})
