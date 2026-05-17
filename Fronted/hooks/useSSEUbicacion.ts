import { useEffect, useRef, useState } from 'react';
import EventSource from 'react-native-sse';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const DELAY_BASE_MS = 5000;
const DELAY_MAX_MS  = 60000;

interface UbicacionPaciente {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export const useSSEUbicacion = (pacienteId: string | null) => {
  const [ubicacion, setUbicacion] = useState<UbicacionPaciente | null>(null);
  const [conectado, setConectado] = useState<boolean>(false);
  const esRef      = useRef<EventSource | null>(null);
  const intentosRef = useRef(0);

  useEffect(() => {
    if (!pacienteId) return;

    let cancelado = false;
    intentosRef.current = 0;

    const conectar = async (): Promise<void> => {
      if (cancelado) return;

      esRef.current?.close();

      const token = await SecureStore.getItemAsync('token');
      if (!token || cancelado) return;

      const url = `${API_URL}/pacientes/${pacienteId}/ubicacion/stream`;

      const es = new EventSource(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      es.addEventListener('open', () => {
        if (!cancelado) {
          setConectado(true);
          intentosRef.current = 0;
        }
      });

      es.addEventListener('message', (e) => {
        if (cancelado || !e.data) return;
        try {
          const datos = JSON.parse(e.data);
          setUbicacion({
            latitude:  datos.latitud  ?? datos.lat,
            longitude: datos.longitud ?? datos.lng,
            timestamp: datos.timestamp,
          });
        } catch (_) {}
      });

      es.addEventListener('error', () => {
        if (cancelado) return;
        setConectado(false);
        esRef.current?.close();
        intentosRef.current += 1;
        const delay = Math.min(DELAY_BASE_MS * intentosRef.current, DELAY_MAX_MS);
        setTimeout(conectar, delay);
      });

      esRef.current = es;
    };

    conectar();

    return () => {
      cancelado = true;
      esRef.current?.close();
    };
  }, [pacienteId]);

  return { ubicacion, conectado };
};