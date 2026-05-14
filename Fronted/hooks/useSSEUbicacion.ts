import { useEffect, useRef, useState } from 'react';
import EventSource from 'react-native-sse';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface UbicacionPaciente {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export const useSSEUbicacion = (pacienteId: string | null) => {
  const [ubicacion, setUbicacion] = useState<UbicacionPaciente | null>(null);
  const [conectado, setConectado] = useState<boolean>(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!pacienteId || pacienteId === undefined) return;

    let cancelado = false;

    const conectar = async (): Promise<void> => {
      esRef.current?.close();

      const token = await AsyncStorage.getItem('token');
      if (!token || cancelado) return;

      const url = `${API_URL}/pacientes/${pacienteId}/ubicacion/stream`;

      const es = new EventSource(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      es.addEventListener('open', () => {
        if (!cancelado) setConectado(true);
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
        setTimeout(conectar, 5000);
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