import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, } from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../utils/auth';
import { tienePacientes } from '../utils/pacientes';
import { registrarToken } from '../utils/notificaciones';

// ── Tipos ─────────────────────────────────────────────────────────────
type Errores = {
  correo?: string;
  contrasena?: string;
};

// ── Componente ────────────────────────────────────────────────────────
export default function FormLogin() {
  const router = useRouter();

  const [correo, setCorreo] = useState<string>('');
  const [contrasena, setContrasena] = useState<string>('');
  const [mostrarContrasena, setMostrarContrasena] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [errores, setErrores] = useState<Errores>({});

  // ── Validación ──────────────────────────────────────────────────────
  const validar = (): boolean => {
    const nuevosErrores: Errores = {};

    if (!correo.trim()) {
      nuevosErrores.correo = 'El correo es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      nuevosErrores.correo = 'Ingresa un correo válido';
    }

    if (!contrasena.trim()) {
      nuevosErrores.contrasena = 'La contraseña es obligatoria';
    } else if (contrasena.length < 6) {
      nuevosErrores.contrasena = 'Mínimo 6 caracteres';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // ── Envío ──────────────────────────────────────────────────────────

const handleLogin = async (): Promise<void> => {
  if (!validar()) return;

  setCargando(true);
  try {
    await login(correo, contrasena);
    registrarToken();
    const pacientes = await tienePacientes();
    if (pacientes) {
      router.replace('/Mapa');
    } else {
      router.replace('/registro-paciente');
    }
  } catch (error: any) {
    Alert.alert('Error al iniciar sesión', error.message);
  } finally {
    setCargando(false);
  }
};

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.contenedor}>

      {/* Correo */}
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Correo electrónico</Text>
        <TextInput
          style={[styles.input, errores.correo ? styles.inputError : null]}
          placeholder="ejemplo@correo.com"
          placeholderTextColor="#9CA3AF"
          value={correo}
          onChangeText={(texto) => {
            setCorreo(texto);
            if (errores.correo) setErrores({ ...errores, correo: undefined });
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errores.correo && (
          <Text style={styles.textoError}>{errores.correo}</Text>
        )}
      </View>

      {/* Contraseña */}
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Contraseña</Text>
        <View style={styles.filaContrasena}>
          <TextInput
            style={[styles.inputContrasena, errores.contrasena ? styles.inputError : null]}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={contrasena}
            onChangeText={(texto) => {
              setContrasena(texto);
              if (errores.contrasena) setErrores({ ...errores, contrasena: undefined });
            }}
            secureTextEntry={!mostrarContrasena}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.botonOjo}
            onPress={() => setMostrarContrasena(!mostrarContrasena)}
          >
            <Text style={styles.ojo}>{mostrarContrasena ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {errores.contrasena && (
          <Text style={styles.textoError}>{errores.contrasena}</Text>
        )}
      </View>

      {/* Botón */}
      <TouchableOpacity
        style={[styles.boton, cargando ? styles.botonDeshabilitado : null]}
        onPress={handleLogin}
        disabled={cargando}
        activeOpacity={0.85}
      >
        {cargando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.textoBoton}>Ingresar</Text>
        )}
      </TouchableOpacity>

      {/* Ir a registro */}
      <TouchableOpacity
        style={styles.enlace}
        onPress={() => router.push('/Register')}
      >
        <Text style={styles.textoEnlace}>
          ¿No tienes cuenta?{' '}
          <Text style={styles.textoEnlaceNegrita}>Regístrate</Text>
        </Text>
      </TouchableOpacity>

    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
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
  inputError: {
    borderColor: '#EF4444',
  },
  textoError: {
    fontSize: 12,
    color: '#EF4444',
  },
  filaContrasena: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContrasena: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  botonOjo: {
    position: 'absolute',
    right: 14,
    height: 50,
    justifyContent: 'center',
  },
  ojo: {
    fontSize: 18,
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
  textoEnlaceNegrita: {
    color: '#1E3A5F',
    fontWeight: '700',
  },
});