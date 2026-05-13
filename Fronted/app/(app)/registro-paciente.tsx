import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { pacienteService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

export default function RegistroPacienteScreen() {
  const router = useRouter()
  const { cuidador } = useAuth()
  const [nombre_paciente, setNombrePaciente] = useState('')
  const [edad_paciente, setEdadPaciente]   = useState('')
  const [enfermedad,    setEnfermedad]      = useState('')
  const [loading,      setLoading]          = useState(false)
  const [error,        setError]            = useState('')

  const handleGuardar = async () => {
    if (nombre_paciente.trim().length < 2) { setError('El nombre debe tener al menos 2 caracteres.'); return }
    const edadNum = parseInt(edad_paciente)
    if (!edad_paciente || isNaN(edadNum) || edadNum < 1 || edadNum > 120) { setError('Ingresa una edad válida.'); return }
    if (!cuidador?.id) { setError('No se identificó el cuidador. Inicia sesión nuevamente.'); return }

    setLoading(true); setError('')
    try {
      await pacienteService.registrar({
        nombre_paciente: nombre_paciente.trim(),
        edad_paciente:   edadNum,
        enfermedad:     enfermedad.trim() || undefined,
        id_cuidador:    cuidador.id,
      })
      router.replace('/(app)/vincular-dispositivo' as any)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? err.message ?? 'Error al registrar el paciente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar paciente</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={15} color={Colors.error} style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Nombre completo del paciente <Text style={styles.req}>*</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={styles.icon} />
              <TextInput style={styles.input} placeholder="Ej: Carlos Gómez"
                placeholderTextColor={Colors.textSecondary} value={nombre_paciente} onChangeText={setNombrePaciente} autoCapitalize="words" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Edad <Text style={styles.req}>*</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} style={styles.icon} />
              <TextInput style={styles.input} placeholder="Ej: 72"
                placeholderTextColor={Colors.textSecondary} value={edad_paciente} onChangeText={setEdadPaciente} keyboardType="number-pad" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Enfermedad o diagnóstico <Text style={styles.opt}>(opcional)</Text></Text>
            <View style={styles.inputWrap}>
              <Ionicons name="medkit-outline" size={18} color={Colors.textSecondary} style={styles.icon} />
              <TextInput style={styles.input} placeholder="Ej: Alzheimer leve"
                placeholderTextColor={Colors.textSecondary} value={enfermedad} onChangeText={setEnfermedad} autoCapitalize="sentences" />
            </View>
          </View>

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleGuardar} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.btnText}>Guardar y vincular dispositivo</Text>
                </>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  scroll: { padding: 20, paddingTop: 0 },
  card:   { backgroundColor: Colors.white, borderRadius: 24, padding: 28, elevation: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: Colors.error },
  errorText: { flex: 1, color: Colors.error, fontSize: 13 },
  field:    { marginBottom: 18 },
  label:    { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
  req:      { color: Colors.error },
  opt:      { color: Colors.textSecondary, fontWeight: '400' },
  inputWrap:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.background, paddingHorizontal: 14 },
  icon:     { marginRight: 10 },
  input:    { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.text },
  btn:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, marginTop: 8, elevation: 4 },
  btnDisabled: { opacity: 0.65 },
  btnText:  { color: Colors.white, fontSize: 15, fontWeight: '700' },
})
