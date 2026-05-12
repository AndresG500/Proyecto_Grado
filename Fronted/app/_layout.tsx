import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '@/context/AuthContext'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  const segments = useSegments()
  const router   = useRouter()

  useEffect(() => {
    if (loading) return
    const inApp = segments[0] === '(app)'
    if (!token && inApp)  router.replace('/login')
    if (token  && !inApp) router.replace('/')
  }, [token, loading, segments])

  if (loading) return null
  return <>{children}</>
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGuard>
    </AuthProvider>
  )
}
