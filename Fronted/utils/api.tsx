import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface OpcionesFetch extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T>(
  endpoint: string,
  opciones: OpcionesFetch = {}
): Promise<T> {
  const { auth = true, headers = {}, ...resto } = opciones;

  const cabeceras: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = await AsyncStorage.getItem('token');
    if (token) cabeceras['Authorization'] = `Bearer ${token}`;
  }

  const respuesta = await fetch(`${BASE_URL}${endpoint}`, {
    headers: cabeceras,
    ...resto,
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    const mensaje = datos?.detail || 'Error en el servidor';
    throw new Error(typeof mensaje === 'string' ? mensaje : JSON.stringify(mensaje));
  }

  return datos as T;
}