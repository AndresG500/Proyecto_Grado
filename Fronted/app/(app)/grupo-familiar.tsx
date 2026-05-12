import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '@/constants/Colors'
import { useAuth } from '@/context/AuthContext'

const KEYS = {
  grupos: '@ubilife_grupos',
}

interface Miembro {
  nombre: string
  email: string
  rol: 'cuidador' | 'familiar'
  connected?: boolean
}

interface Grupo {
  id: string
  nombre: string
  codigo: string
  paciente_nombre: string
  miembros: Miembro[]
  created_at: string
}

export default function GrupoFamiliarScreen() {
  const router = useRouter()
  const { cuidador } = useAuth()
  const [loading, setLoading] = useState(true)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [codigoInput, setCodigoInput] = useState('')

  const cargarGrupos = async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.grupos)
      const gruposData = JSON.parse(raw || '[]') as any[]
      
      const gruposConPacientes = await Promise.all(
        gruposData.map(async (g: any) => {
          const pacientesRaw = await AsyncStorage.getItem('@ubilife_pacientes')
          const pacientes = JSON.parse(pacientesRaw || '[]')
          
          const miembros: Miembro[] = (g.miembros as string[] || []).map((email: string) => ({
            nombre: email.split('@')[0],
            email,
            rol: g.cuidador_id === email ? 'cuidador' as const : 'familiar' as const,
            connected: true,
          }))

          return {
            id: g.id,
            nombre: g.nombre,
            codigo: g.codigo,
            cuidador_id: g.cuidador_id,
            paciente_nombre: pacientes[0]?.nombre_paciente || 'Sin paciente',
            miembros,
            created_at: g.created_at,
          }
        })
      )

      setGrupos(gruposConPacientes)
    } catch (err) {
      console.error('Error cargando grupos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarGrupos()
  }, [])

  const generarCodigo = async () => {
    const nuevoCodigo = `FAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    const raw = await AsyncStorage.getItem(KEYS.grupos)
    const gruposData: Grupo[] = JSON.parse(raw || '[]')
    
    const nuevoGrupo: Grupo = {
      id: `grupo_${Date.now()}`,
      nombre: 'Mi Familia',
      codigo: nuevoCodigo,
      paciente_nombre: '',
      miembros: [
        { nombre: cuidador?.name || 'Cuidador', email: cuidador?.email || '', rol: 'cuidador', connected: true }
      ],
      created_at: new Date().toISOString(),
    }

    gruposData.push(nuevoGrupo)
    await AsyncStorage.setItem(KEYS.grupos, JSON.stringify(gruposData))
    setGrupos([...gruposData])
  }

  const unirseConCodigo = async () => {
    if (!codigoInput.trim()) {
      Alert.alert('Error', 'Por favor ingresa un código')
      return
    }

    const raw = await AsyncStorage.getItem(KEYS.grupos)
    const gruposData = JSON.parse(raw || '[]') as any[]
    
    const grupo = gruposData.find((g: any) => g.codigo === codigoInput.trim().toUpperCase())
    
    if (!grupo) {
      Alert.alert('Error', 'El código no existe. Verifica e intenta de nuevo.')
      return
    }

    const nuevosMiembros = [...(grupo.miembros || []), cuidador?.email || '']
    const grupoIndex = gruposData.findIndex((g: any) => g.codigo === codigoInput.trim().toUpperCase())
    gruposData[grupoIndex].miembros = nuevosMiembros

    await AsyncStorage.setItem(KEYS.grupos, JSON.stringify(gruposData))
    setModalVisible(false)
    setCodigoInput('')
    cargarGrupos()
    Alert.alert('Éxito', 'Te has unido al grupo familiar')
  }

  const copiarCodigo = async (codigo: string) => {
    await Clipboard.setStringAsync(codigo)
    Alert.alert('Código copiado', `El código ${codigo} ha sido copiado al portapapeles. Compártelo con los familiares.`)
  }

  const eliminarGrupo = (grupoId: string) => {
    Alert.alert(
      'Eliminar grupo',
      '¿Estás seguro de que quieres eliminar este grupo familiar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const raw = await AsyncStorage.getItem(KEYS.grupos)
            const gruposData = JSON.parse(raw || '[]') as any[]
            const gruposFiltrados = gruposData.filter((g: any) => g.id !== grupoId)
            await AsyncStorage.setItem(KEYS.grupos, JSON.stringify(gruposFiltrados))
            setGrupos(gruposFiltrados.map((g: any) => ({
              id: g.id,
              nombre: g.nombre,
              codigo: g.codigo,
              cuidador_id: g.cuidador_id,
              paciente_nombre: '',
              miembros: (g.miembros as string[] || []).map((email: string) => ({
                nombre: email.split('@')[0],
                email,
                rol: 'familiar' as const,
                connected: true,
              })),
              created_at: g.created_at,
            })))
          },
        },
      ]
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
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn} activeOpacity={0.7}>
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
            <TouchableOpacity style={styles.createBtn} onPress={generarCodigo} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.createBtnText}>Crear grupo familiar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={grupos}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: grupo }) => (
              <View style={styles.grupoCard}>
                <View style={styles.grupoHeader}>
                  <View style={styles.grupoIcon}>
                    <Ionicons name="people" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.grupoInfo}>
                    <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
                    <Text style={styles.grupoPaciente}>Paciente: {grupo.paciente_nombre}</Text>
                  </View>
                </View>

                <View style={styles.codigoBox}>
                  <Text style={styles.codigoLabel}>Código de invitación</Text>
                  <View style={styles.codigoRow}>
                    <Text style={styles.codigoText}>{grupo.codigo}</Text>
                    <TouchableOpacity onPress={() => copiarCodigo(grupo.codigo)} style={styles.copyBtn}>
                      <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.miembrosSection}>
                  <Text style={styles.miembrosTitle}>Miembros ({grupo.miembros?.length || 0})</Text>
                  {grupo.miembros?.map((miembro, idx) => (
                    <View key={idx} style={styles.miembroItem}>
                      <View style={[styles.miembroAvatar, miembro.rol === 'cuidador' && styles.miembroAvatarCuidador]}>
                        <Text style={styles.miembroAvatarText}>{miembro.nombre.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.miembroInfo}>
                        <Text style={styles.miembroNombre}>{miembro.nombre}</Text>
                        <Text style={styles.miembroEmail}>{miembro.email}</Text>
                      </View>
                      <View style={[styles.rolBadge, miembro.rol === 'cuidador' && styles.rolBadgeCuidador]}>
                        <Text style={[styles.rolBadgeText, miembro.rol === 'cuidador' && styles.rolBadgeTextCuidador]}>
                          {miembro.rol === 'cuidador' ? 'Cuidador' : 'Familiar'}
                        </Text>
                      </View>
                    </View>
                  ))}
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
            )}
          />
        )}
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Unirse a un grupo</Text>
            <Text style={styles.modalDesc}>
              Ingresa el código que te proporcionó el cuidador principal
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ej: FAM-ABC123"
                placeholderTextColor={Colors.textSecondary}
                value={codigoInput}
                onChangeText={setCodigoInput}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity style={styles.modalBtn} onPress={unirseConCodigo} activeOpacity={0.85}>
              <Text style={styles.modalBtnText}>Unirse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.white },
  addBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, backgroundColor: Colors.background },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  createBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  grupoCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
  },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  grupoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  grupoInfo: { flex: 1 },
  grupoNombre: { fontSize: 17, fontWeight: '700', color: Colors.text },
  grupoPaciente: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  codigoBox: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  codigoLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  codigoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codigoText: { fontSize: 18, fontWeight: '700', color: Colors.primary, letterSpacing: 2 },
  copyBtn: { padding: 4 },

  miembrosSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16 },
  miembrosTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12 },
  miembroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  miembroAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  miembroAvatarCuidador: { backgroundColor: Colors.primary },
  miembroAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  miembroInfo: { flex: 1 },
  miembroNombre: { fontSize: 14, fontWeight: '600', color: Colors.text },
  miembroEmail: { fontSize: 12, color: Colors.textSecondary },
  rolBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  rolBadgeCuidador: { backgroundColor: Colors.primaryBg },
  rolBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  rolBadgeTextCuidador: { color: Colors.primary },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalClose: { alignSelf: 'flex-end', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  modalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  eliminarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 16,
    gap: 8,
  },
  eliminarBtnText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
})