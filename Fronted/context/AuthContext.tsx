import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface Cuidador {
  id?: string
  name?: string
  email: string
  phone?: string
}

type TipoUsuario = 'cuidador' | 'familiar'

interface AuthContextType {
  token:     string | null
  cuidador:  Cuidador | null
  tipoUsuario: TipoUsuario
  loading:   boolean
  login:     (token: string, cuidador: Cuidador, tipo?: TipoUsuario) => Promise<void>
  logout:    () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,        setToken]        = useState<string | null>(null)
  const [cuidador,     setCuidador]     = useState<Cuidador | null>(null)
  const [tipoUsuario,  setTipoUsuario]  = useState<TipoUsuario>('cuidador')
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { init() }, [])

  const init = async () => {
    try {
      const t = await AsyncStorage.getItem('token')
      const c = await AsyncStorage.getItem('cuidador')
      const tipo = await AsyncStorage.getItem('tipoUsuario')
      if (t) { 
        setToken(t); 
        setCuidador(c ? JSON.parse(c) : null)
        setTipoUsuario((tipo as TipoUsuario) || 'cuidador')
      }
    } finally {
      setLoading(false)
    }
  }

  const login = async (newToken: string, cuidadorData: Cuidador, tipo: TipoUsuario = 'cuidador') => {
    await AsyncStorage.setItem('token',       newToken)
    await AsyncStorage.setItem('cuidador',    JSON.stringify(cuidadorData))
    await AsyncStorage.setItem('tipoUsuario', tipo)
    setToken(newToken)
    setCuidador(cuidadorData)
    setTipoUsuario(tipo)
  }

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'cuidador', 'tipoUsuario'])
    setToken(null)
    setCuidador(null)
    setTipoUsuario('cuidador')
  }

  return (
    <AuthContext.Provider value={{ token, cuidador, tipoUsuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
