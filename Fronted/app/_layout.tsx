import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments, router as expoRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { registrarToken, configurarListeners } from '../utils/notificaciones';

const RUTAS_PUBLICAS = ['Login', 'Register'];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segmentos = useSegments();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('token').then((token) => {
      const rutaActual = segmentos[0];
      const esPublica = RUTAS_PUBLICAS.includes(rutaActual);
      if (!token && !esPublica) {
        router.replace('/Login');
      }
      setVerificando(false);
    });
  }, [segmentos]);

  if (verificando) {
    return (
      <View style={styles.carga}>
        <ActivityIndicator size="large" color="#1E3A5F" />
      </View>
    );
  }

  return <>{children}</>;
}

function LayoutConNotificaciones({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registrarToken();

    const limpiar = configurarListeners((data) => {
      expoRouter.push({
        pathname: '/Mapa',
        params: {
          paciente_id: data.paciente_id,
          lat: data.lat,
          lng: data.lng,
        },
      });
    });

    return limpiar;
  }, []);

  return <AuthGuard>{children}</AuthGuard>;
}

export default function Layout() {
  return (
    <LayoutConNotificaciones>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="Login" />
        <Stack.Screen name="Register" />
        <Stack.Screen name="Mapa" />
        <Stack.Screen name="registro-paciente" />
        <Stack.Screen name="vincular-dispositivo" />
      </Stack>
    </LayoutConNotificaciones>
  );
}

const styles = StyleSheet.create({
  carga: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});
