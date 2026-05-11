import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Cuidador {
  id?: string
  name?: string
  email: string
  phone?: string
}

interface AuthContextType {
  token:     string | null
  cuidador:  Cuidador | null
  loading:   boolean
  login:     (token: string, cuidador: Cuidador) => Promise<void>
  logout:    () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,    setToken]    = useState<string | null>(null)
  const [cuidador, setCuidador] = useState<Cuidador | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const t = await AsyncStorage.getItem('token')
      const c = await AsyncStorage.getItem('cuidador')
      if (t) { setToken(t); setCuidador(c ? JSON.parse(c) : null) }
    } finally {
      setLoading(false)
    }
  }

  const login = async (newToken: string, cuidadorData: Cuidador) => {
    await AsyncStorage.setItem('token',    newToken)
    await AsyncStorage.setItem('cuidador', JSON.stringify(cuidadorData))
    setToken(newToken)
    setCuidador(cuidadorData)
  }

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'cuidador'])
    setToken(null)
    setCuidador(null)
  }

  return (
    <AuthContext.Provider value={{ token, cuidador, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
