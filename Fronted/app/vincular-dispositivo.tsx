import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Dispositivo {
  id_dispositivo: string;
  dispositivo_detectado: string | null;
}

export default function VincularDispositivoScreen() {
  const router = useRouter();
  const { pacienteId } = useLocalSearchParams<{ pacienteId: string }>();

  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    const buscar = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/dispositivos/disponibles`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDispositivos(res.data);
      } catch (error: any) {
        setDispositivos([]);
      } finally {
        setCargando(false);
      }
    };

    buscar();
  }, []);

  const handleVincular = async (id_dispositivo: string) => {
    if (vinculando) return;
    setVinculando(true);

    try {
      const token = await AsyncStorage.getItem('token');
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/dispositivos/vincular`,
        { id_dispositivo, paciente_id: pacienteId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('¡Listo!', 'Paciente registrado y dispositivo vinculado', [
        { text: 'OK', onPress: () => router.replace('/Mapa') },
      ]);
    } catch (error: any) {
      setVinculando(false);
      const mensaje =
        error.response?.data?.detail ??
        error.response?.data?.error ??
        'No se pudo vincular el dispositivo';
      Alert.alert('Error', mensaje);
    }
  };

  const hayDispositivos = dispositivos.length > 0;
  const unico = dispositivos[0];

  return (
    <View style={styles.contenedor}>
      {cargando ? (
        <>
          <LottieView
            source={require('../assets/animations/planet.json')}
            autoPlay
            loop
            style={styles.animacion}
          />
          <Text style={styles.texto}>Buscando dispositivos...</Text>
        </>
      ) : hayDispositivos ? (
        <View style={styles.lista}>
          <Text style={styles.titulo}>Dispositivo detectado</Text>
          <TouchableOpacity
            style={styles.tarjeta}
            onPress={() => handleVincular(unico.id_dispositivo)}
            disabled={vinculando}
            activeOpacity={0.85}
          >
            {vinculando ? (
              <ActivityIndicator color="#1E3A5F" />
            ) : (
              <>
                <Text style={styles.tarjetaId}>{unico.id_dispositivo}</Text>
                <Text style={styles.tarjetaEstado}>
                  Toca para vincular al paciente
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sinDispositivos}>
          <Text style={styles.sinDispositivosTitulo}>
            No se detectaron dispositivos
          </Text>
          <Text style={styles.sinDispositivosSubtitulo}>
            Asegúrate de que el dispositivo esté encendido y visible
          </Text>
          <TouchableOpacity
            style={styles.botonCancelar}
            onPress={() => router.replace('/Mapa')}
          >
            <Text style={styles.textoCancelar}>Continuar al mapa</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  animacion: {
    width: 220,
    height: 220,
  },
  texto: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  lista: {
    width: '100%',
    gap: 16,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A5F',
    textAlign: 'center',
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#1E3A5F',
  },
  tarjetaId: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  tarjetaEstado: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  sinDispositivos: {
    alignItems: 'center',
    gap: 16,
  },
  sinDispositivosTitulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
  },
  sinDispositivosSubtitulo: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 260,
  },
  botonCancelar: {
    marginTop: 8,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  textoCancelar: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
