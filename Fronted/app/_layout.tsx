import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { configurarListeners } from '@/utils/notificaciones'

const RUTAS_PUBLICAS = ['login', 'register', 'register-cuidador', 'register-familiar', 'elegir-rol']

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  const segments = useSegments()
  const router   = useRouter()

  useEffect(() => {
    if (loading) return
    const inApp     = segments[0] === '(app)'
    const enPublico = RUTAS_PUBLICAS.includes(segments[0] as string)

    if (!token && inApp) {
      router.replace('/login')
    } else if (!token && !enPublico) {
      // Estado inicial sin ruta activa → ir a login
      router.replace('/login')
    } else if (token && !inApp) {
      router.replace('/(app)')
    }
  }, [token, loading, segments, router])

  if (loading) return null
  const inApp = segments[0] === '(app)'
  if (!token && inApp) return null
  return <>{children}</>
}

export default function RootLayout() {
  useEffect(() => {
    const limpiar = configurarListeners((data) => {
      console.log('Alerta recibida:', data)
    })
    return limpiar
  }, [])

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGuard>
    </AuthProvider>
  )
}
