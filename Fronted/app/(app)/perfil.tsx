import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { useAuth } from '@/context/AuthContext'
import { cuidadorService } from '@/services/api'

export default function PerfilScreen() {
  const { cuidador, logout } = useAuth()
  const router = useRouter()
  const [nombre,   setNombre]   = useState(cuidador?.name  ?? '')
  const [telefono, setTelefono] = useState(cuidador?.phone ?? '')
  const [loading,  setLoading]  = useState(false)
  const [saved,    setSaved]    = useState(false)

  const handleGuardar = async () => {
    setLoading(true)
    try {
      await cuidadorService.actualizar({ name: nombre, phone: telefono })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      // el backend devuelve error silencioso; el usuario puede reintentar
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: async () => {
          await cuidadorService.logout()
          await logout()
          // AuthGuard detecta token === null y redirige a /login automáticamente
        }},
    ])
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{cuidador?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.avatarName}>{cuidador?.name ?? 'Cuidador'}</Text>
          <Text style={styles.avatarEmail}>{cuidador?.email ?? ''}</Text>
        </View>

        <View style={styles.card}>
          {saved && (
            <View style={styles.savedBox}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} style={{ marginRight: 6 }} />
              <Text style={styles.savedText}>Cambios guardados</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nombre</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={styles.icon} />
              <TextInput style={styles.input} value={nombre} onChangeText={setNombre}
                autoCapitalize="words" placeholderTextColor={Colors.textSecondary} />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Teléfono</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={Colors.textSecondary} style={styles.icon} />
              <TextInput style={styles.input} value={telefono} onChangeText={setTelefono}
                keyboardType="phone-pad" placeholderTextColor={Colors.textSecondary} />
            </View>
          </View>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleGuardar} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Guardar cambios</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} style={{ marginRight: 10 }} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  scroll: { padding: 20 },
  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatar:     { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  avatarName: { fontSize: 20, fontWeight: '700', color: Colors.white },
  avatarEmail:{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card:   { backgroundColor: Colors.white, borderRadius: 24, padding: 24, elevation: 8 },
  savedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 16 },
  savedText:{ color: Colors.success, fontWeight: '600', fontSize: 13 },
  field:    { marginBottom: 16 },
  label:    { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
  inputWrap:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.background, paddingHorizontal: 14 },
  icon:     { marginRight: 10 },
  input:    { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.text },
  btn:      { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8, elevation: 4 },
  btnDisabled: { opacity: 0.65 },
  btnText:  { color: Colors.white, fontSize: 15, fontWeight: '700' },
  logoutBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28, padding: 16 },
  logoutText:{ color: Colors.error, fontSize: 15, fontWeight: '700' },
})
