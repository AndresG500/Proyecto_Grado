import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// En Expo Go SDK 53+ el módulo expo-notifications no soporta push remoto.
// Se usa require condicional para evitar el error en el arranque.
type NotificationsModule = typeof import('expo-notifications');
const Notifications: NotificationsModule | null = IS_EXPO_GO
  ? null
  : (require('expo-notifications') as NotificationsModule);

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registrarToken(): Promise<void> {
  if (!Notifications) {
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

    const tokenStr = await SecureStore.getItemAsync('token');
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
  if (!Notifications) {
    console.log('[Notificaciones] Listeners omitidos en Expo Go');
    return () => {};
  }

  type Subscription = ReturnType<typeof Notifications.addNotificationReceivedListener>;
  const subs: Subscription[] = [];

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
