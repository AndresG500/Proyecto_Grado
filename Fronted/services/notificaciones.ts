import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const IS_EXPO_GO = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registrarToken(): Promise<void> {
  if (IS_EXPO_GO) {
    console.log('[Notificaciones] Ejecutando en Expo Go — usa un development build para notificaciones push');
    return;
  }

  if (!Device.isDevice) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: nuevo } = await Notifications.requestPermissionsAsync();
      if (nuevo !== 'granted') return;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

    if (!token.data) return;

    const tokenStr = await AsyncStorage.getItem('token');
    if (!tokenStr) return;

    await axios.patch(
      `${API_URL}/cuidadores/fcm-token`,
      { token: token.data },
      { headers: { Authorization: `Bearer ${tokenStr}` } }
    );
  } catch (error) {
    console.warn('Error registrando token FCM:', error);
  }
}

export function configurarListeners(
  onAlerta: (data: {
    tipo: string;
    alerta_id: string;
    paciente_id: string;
    lat: string;
    lng: string;
  }) => void
): () => void {
  if (IS_EXPO_GO) {
    console.log('[Notificaciones] Listeners omitidos en Expo Go');
    return () => {};
  }

  const subs: Notifications.Subscription[] = [];

  subs.push(
    Notifications.addNotificationReceivedListener((notif) => {
      const data = notif.request.content.data as any;
      if (data?.paciente_id) onAlerta(data);
    })
  );

  subs.push(
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.paciente_id) onAlerta(data);
    })
  );

  return () => subs.forEach((s) => s.remove());
}