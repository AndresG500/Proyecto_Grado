import { apiFetch } from './api';

export interface Paciente {
  id: string;
  nombre_paciente: string;
  ultima_ubicacion?: {
    latitud: number;
    longitud: number;
    timestamp: string;
  };
}

export async function listarPacientes(): Promise<Paciente[]> {
  const respuesta = await apiFetch<Paciente[] | { pacientes: Paciente[] }>('/pacientes/');

  // Por si el backend retorna { pacientes: [...] } o directamente el array
  if (Array.isArray(respuesta)) return respuesta;
  return respuesta.pacientes ?? [];
}

export async function tienePacientes(): Promise<boolean> {
  const lista = await listarPacientes();
  return lista.length > 0;
}