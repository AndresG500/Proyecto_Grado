import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { cuidadorService, familiarService } from '@/services/api'
import { registrarToken } from '@/utils/notificaciones'
import { Colors } from '@/constants/Colors'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const { login } = useAuth()
  const router    = useRouter()

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Por favor completa todos los campos')
      return
    }
    setLoading(true)
    setError('')

    let data: any = null
    let tipo: 'cuidador' | 'familiar' = 'cuidador'

    try {
      const res = await cuidadorService.login(email.trim().toLowerCase(), password)
      data = res.data
      tipo = 'cuidador'
    } catch {
      try {
        const res = await familiarService.login(email.trim().toLowerCase(), password)
        data = res.data
        tipo = 'familiar'
      } catch (familiarErr: any) {
        const msg =
          familiarErr.response?.data?.detail  ??
          familiarErr.response?.data?.mensaje ??
          familiarErr.response?.data?.error   ??
          'Credenciales inválidas. Verifica tu correo y contraseña.'
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
        setLoading(false)
        return
      }
    }

    try {
      const token    = data.token ?? data.access_token ?? data.jwt
      const cuidador = data.cuidador ?? data.familiar ?? { email: email.trim() }
      await login(token, cuidador, data.tipo ?? tipo)
      registrarToken().catch(() => {})
      router.replace('/(app)/' as any)
    } catch {
      setError('Error inesperado al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.bgTop} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo y nombre */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="location" size={42} color={Colors.white} />
            </View>
            <Text style={styles.appName}>UbiLife</Text>
            <Text style={styles.tagline}>Rastreo GPS para cuidadores</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={15} color={Colors.error} style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Ingresar</Text>}
            </TouchableOpacity>

            {/* Link de registro */}
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/elegir-rol' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>
                ¿No tienes cuenta?{' '}
                <Text style={styles.registerHighlight}>Regístrate</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  bgTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 6,
    letterSpacing: 0.3,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 22,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: 13,
    lineHeight: 19,
  },

  field: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },

  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.65 },
  btnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  registerLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
})
