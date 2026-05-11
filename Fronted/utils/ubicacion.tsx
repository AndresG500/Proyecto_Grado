import * as Location from 'expo-location';

export const solicitarPermisos = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
};

export const iniciarSeguimiento = async (
  onUbicacion: (coords: { latitude: number; longitude: number }) => void
): Promise<Location.LocationSubscription> => {
  const permiso = await solicitarPermisos();
  if (!permiso) throw new Error('Permiso de ubicación denegado');

  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
    },
    (loc) => {
      onUbicacion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    }
  );
};