import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';

interface RespuestaLogin {
  access_token: string;
  token_type: string;
}

interface DatosLogin {
  email: string;
  contrasena: string;
}

interface DatosRegistro {
  nombre_cuidador: string;
  email: string;
  telefono: string;
  contrasena: string;
}

export async function login(email: string, contrasena: string): Promise<void> {
  const respuesta = await apiFetch<RespuestaLogin>('/cuidadores/verificar', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password: contrasena }),
  });
  await AsyncStorage.setItem('token', respuesta.access_token);
}

export async function registrar(datos: DatosRegistro): Promise<void> {
  await apiFetch('/cuidadores/registrar', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      name: datos.nombre_cuidador,       // ← era nombre_cuidador
      email: datos.email,
      telefono: datos.telefono,
      password: datos.contrasena,        // ← era contrasena
    }),
  });
}

export async function cerrarSesion(): Promise<void> {
  await apiFetch('/cuidadores/logout', { method: 'POST' });
  await AsyncStorage.removeItem('token');
}