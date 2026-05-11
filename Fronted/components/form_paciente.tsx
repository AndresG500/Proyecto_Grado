import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Errores = {
  nombre_paciente?: string;
  edad_paciente?: string;
  enfermedad?: string;
};

export default function FormRegistroPaciente() {
  const router = useRouter();

  const [nombre_paciente, setNombre] = useState<string>('');
  const [edad_paciente, setEdad] = useState<string>('');
  const [enfermedad, setEnfermedad] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  const [errores, setErrores] = useState<Errores>({});

  const validar = (): boolean => {
    const nuevosErrores: Errores = {};

    if (!nombre_paciente.trim()) {
      nuevosErrores.nombre_paciente = 'El nombre es obligatorio';
    } else if (nombre_paciente.trim().length < 3) {
      nuevosErrores.nombre_paciente = 'Mínimo 3 caracteres';
    }

    if (!edad_paciente.trim()) {
      nuevosErrores.edad_paciente = 'La edad es obligatoria';
    } else {
      const edadNum = Number(edad_paciente);
      if (isNaN(edadNum) || edadNum < 1 || edadNum > 120) {
        nuevosErrores.edad_paciente = 'Ingresa una edad válida (1–120)';
      }
    }

    if (!enfermedad.trim()) {
      nuevosErrores.enfermedad = 'La enfermedad es obligatoria';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleRegistro = async (): Promise<void> => {
    if (!validar()) return;

    setCargando(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const respuesta = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/pacientes/registrar`,
        {
          nombre_paciente: nombre_paciente.trim(),
          edad_paciente: Number(edad_paciente),
          enfermedad: enfermedad.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const pacienteId = respuesta.data.id_paciente;
      setCargando(false);

      router.push({
        pathname: '/vincular-dispositivo' as any,
        params: { pacienteId },
      });
    } catch (error: any) {
      setCargando(false);
      const mensaje =
        error.response?.data?.detail ??
        error.response?.data?.error ??
        'No se pudo registrar el paciente';
      Alert.alert('Error', mensaje);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.contenedor}>
        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Nombre completo</Text>
          <TextInput
            style={[
              styles.input,
              errores.nombre_paciente ? styles.inputError : null,
            ]}
            placeholder="Ej: María García"
            placeholderTextColor="#9CA3AF"
            value={nombre_paciente}
            onChangeText={(texto) => {
              setNombre(texto);
              if (errores.nombre_paciente)
                setErrores({ ...errores, nombre_paciente: undefined });
            }}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {errores.nombre_paciente && (
            <Text style={styles.textoError}>{errores.nombre_paciente}</Text>
          )}
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Edad</Text>
          <TextInput
            style={[
              styles.input,
              errores.edad_paciente ? styles.inputError : null,
            ]}
            placeholder="Ej: 72"
            placeholderTextColor="#9CA3AF"
            value={edad_paciente}
            onChangeText={(texto) => {
              setEdad(texto);
              if (errores.edad_paciente)
                setErrores({ ...errores, edad_paciente: undefined });
            }}
            keyboardType="numeric"
          />
          {errores.edad_paciente && (
            <Text style={styles.textoError}>{errores.edad_paciente}</Text>
          )}
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Enfermedad o condición</Text>
          <TextInput
            style={[
              styles.input,
              styles.inputMultilinea,
              errores.enfermedad ? styles.inputError : null,
            ]}
            placeholder="Ej: Alzheimer en etapa moderada"
            placeholderTextColor="#9CA3AF"
            value={enfermedad}
            onChangeText={(texto) => {
              setEnfermedad(texto);
              if (errores.enfermedad)
                setErrores({ ...errores, enfermedad: undefined });
            }}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />
          {errores.enfermedad && (
            <Text style={styles.textoError}>{errores.enfermedad}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.boton, cargando ? styles.botonDeshabilitado : null]}
          onPress={handleRegistro}
          disabled={cargando}
          activeOpacity={0.85}
        >
          {cargando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBoton}>Registrar paciente</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.enlace}
          onPress={() => router.replace('/Mapa')}
        >
          <Text style={styles.textoEnlace}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  contenedor: {
    gap: 20,
  },
  campo: {
    gap: 6,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputMultilinea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textoError: {
    fontSize: 12,
    color: '#EF4444',
  },
  boton: {
    height: 52,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  botonDeshabilitado: {
    opacity: 0.7,
  },
  textoBoton: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  enlace: {
    alignItems: 'center',
    marginTop: 4,
  },
  textoEnlace: {
    fontSize: 14,
    color: '#6B7280',
  },
});
