import React, { useEffect, useRef, useState } from 'react';
import MapView, { Marker, UrlTile, Callout } from 'react-native-maps';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import type { LocationSubscription } from 'expo-location';
import { router } from 'expo-router';

import { useSSEUbicacion } from '../hooks/useSSEUbicacion';
import { iniciarSeguimiento } from '../utils/ubicacion';
import { listarPacientes, type Paciente } from '../utils/pacientes';

interface Coords {
  latitude: number;
  longitude: number;
}

// Marcador personalizado para el dispositivo GPS
function MarcadorGPS({ nombre }: { nombre: string }) {
  return (
    <View style={styles.marcadorGPS}>
      <Text style={styles.marcadorGPSIcono}>📡</Text>
      <View style={styles.marcadorGPSEtiqueta}>
        <Text style={styles.marcadorGPSTexto}>{nombre}</Text>
      </View>
    </View>
  );
}

// Marcador personalizado para el cuidador
function MarcadorCuidador() {
  return (
    <View style={styles.marcadorCuidador}>
      <Text style={styles.marcadorCuidadorIcono}>🧑‍⚕️</Text>
    </View>
  );
}

export default function MapaScreen() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [pacienteActivo, setPacienteActivo] = useState<string | null>(null);
  const [ubicacionCuidador, setUbicacionCuidador] = useState<Coords | null>(null);
  const suscripcionRef = useRef<LocationSubscription | null>(null);

  const { ubicacion: ubicacionPaciente, conectado } = useSSEUbicacion(pacienteActivo);

  // Cargar pacientes al entrar
  useEffect(() => {
      listarPacientes().then((lista: Paciente[]) => {
      setPacientes(lista);
      if (lista.length > 0) setPacienteActivo(lista[0].id);
    }).catch(console.error);
  }, []);

  // Ubicación del cuidador
  useEffect(() => {
    iniciarSeguimiento(setUbicacionCuidador)
      .then((sus) => { suscripcionRef.current = sus; })
      .catch(console.error);
    return () => { suscripcionRef.current?.remove(); };
  }, []);

  const pacienteActivoInfo = pacientes.find((p) => p.id === pacienteActivo);

  const regionInicial = {
    latitude: ubicacionPaciente?.latitude ?? ubicacionCuidador?.latitude ?? 11.2408,
    longitude: ubicacionPaciente?.longitude ?? ubicacionCuidador?.longitude ?? -74.1990,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <>
    <MapView style={styles.mapa} initialRegion={regionInicial}>
      <UrlTile
        urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />

      {/* Dispositivo GPS del paciente activo (SSE tiempo real) */}
      {ubicacionPaciente && (
        <Marker
          coordinate={ubicacionPaciente}
          anchor={{ x: 0.5, y: 1 }}
        >
          <MarcadorGPS nombre={pacienteActivoInfo?.nombre_paciente ?? 'Paciente'} />
          <Callout>
            <View style={styles.callout}>
              <Text style={styles.calloutTitulo}>
                {pacienteActivoInfo?.nombre_paciente ?? 'Paciente'}
              </Text>
              <Text style={styles.calloutSubtitulo}>
                {conectado ? '🟢 En tiempo real' : '🟡 Última ubicación'}
              </Text>
            </View>
          </Callout>
        </Marker>
      )}

      {/* Otros pacientes (última ubicación conocida) */}
      {pacientes
        .filter((p) => p.id !== pacienteActivo && p.ultima_ubicacion)
        .map((p) => (
          <Marker
            key={p.id}
            coordinate={{
              latitude: p.ultima_ubicacion!.latitud,
              longitude: p.ultima_ubicacion!.longitud,
            }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => setPacienteActivo(p.id)}
          >
            <MarcadorGPS nombre={p.nombre_paciente} />
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitulo}>{p.nombre_paciente}</Text>
                <Text style={styles.calloutSubtitulo}>⚫ Última ubicación</Text>
              </View>
            </Callout>
          </Marker>
        ))}

      {/* Cuidador */}
      {ubicacionCuidador && (
        <Marker coordinate={ubicacionCuidador} anchor={{ x: 0.5, y: 0.5 }}>
          <MarcadorCuidador />
          <Callout>
            <View style={styles.callout}>
              <Text style={styles.calloutTitulo}>Tú</Text>
              <Text style={styles.calloutSubtitulo}>Tu ubicación actual</Text>
            </View>
          </Callout>
        </Marker>
      )}
    </MapView>
    <TouchableOpacity
      style={styles.fab}
      onPress={() => router.push('/registro-paciente' as any)}
    >
      <Text style={styles.fabIcono}>➕</Text>
    </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },

  marcadorGPS: {
    alignItems: 'center',
  },
  marcadorGPSIcono: {
    fontSize: 28,
  },
  marcadorGPSEtiqueta: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  marcadorGPSTexto: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  marcadorCuidador: {
    backgroundColor: '#3182CE',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  marcadorCuidadorIcono: {
    fontSize: 20,
  },

  callout: {
    padding: 8,
    minWidth: 120,
  },
  calloutTitulo: {
    fontWeight: '700',
    fontSize: 13,
    color: '#1E3A5F',
  },
  calloutSubtitulo: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcono: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});