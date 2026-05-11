import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, } from 'react-native';
import { useRouter } from 'expo-router';
import { registrar } from '../utils/auth'

// ── Tipos ─────────────────────────────────────────────────────────────
type Errores = {
  nombre?: string;
  correo?: string;
  telefono?: string;
  contrasena?: string;
  confirmarContrasena?: string;
};

// ── Componente ────────────────────────────────────────────────────────
export default function FormRegistro() {
  const router = useRouter();

  const [nombre, setNombre] = useState<string>('');
  const [correo, setCorreo] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [contrasena, setContrasena] = useState<string>('');
  const [confirmarContrasena, setConfirmarContrasena] = useState<string>('');
  const [mostrarContrasena, setMostrarContrasena] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [errores, setErrores] = useState<Errores>({});

  // ── Validación ──────────────────────────────────────────────────────
  const validar = (): boolean => {
    const nuevosErrores: Errores = {};

    if (!nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio';
    } else if (nombre.trim().length < 3) {
      nuevosErrores.nombre = 'Mínimo 3 caracteres';
    }

    if (!correo.trim()) {
      nuevosErrores.correo = 'El correo es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      nuevosErrores.correo = 'Ingresa un correo válido';
    }

    if (!telefono.trim()) {
      nuevosErrores.telefono = 'El teléfono es obligatorio';
    } else if (!/^\d{7,15}$/.test(telefono.replace(/\s/g, ''))) {
      nuevosErrores.telefono = 'Ingresa un teléfono válido';
    }

    if (!contrasena) {
      nuevosErrores.contrasena = 'La contraseña es obligatoria';
    } else if (contrasena.length < 6) {
      nuevosErrores.contrasena = 'Mínimo 6 caracteres';
    }

    if (!confirmarContrasena) {
      nuevosErrores.confirmarContrasena = 'Confirma tu contraseña';
    } else if (contrasena !== confirmarContrasena) {
      nuevosErrores.confirmarContrasena = 'Las contraseñas no coinciden';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // ── Envío ───────────────────────────────────────────────────────────
const handleRegistro = async (): Promise<void> => {
  if (!validar()) return;

  setCargando(true);
  try {
    await registrar({
      nombre_cuidador: nombre,
      email: correo,
      telefono,
      contrasena,
    });
    Alert.alert(
      'Registro exitoso',
      'Tu cuenta fue creada correctamente',
      [{ text: 'Iniciar sesión', onPress: () => router.replace('/Login') }]
    );
  } catch (error: any) {
    Alert.alert('Error al registrarse', error.message);
  } finally {
    setCargando(false);
  }
};

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={styles.contenedor}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

      {/* Nombre */}
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Nombre completo</Text>
        <TextInput
          style={[styles.input, errores.nombre ? styles.inputError : null]}
          placeholder="Ej: Carlos López"
          placeholderTextColor="#9CA3AF"
          value={nombre}
          onChangeText={(texto) => {
            setNombre(texto);
            if (errores.nombre) setErrores({ ...errores, nombre: undefined });
          }}
          autoCapitalize="words"
        />
        {errores.nombre && (
          <Text style={styles.textoError}>{errores.nombre}</Text>
        )}
      </View>

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

      {/* Teléfono */}
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Teléfono</Text>
        <TextInput
          style={[styles.input, errores.telefono ? styles.inputError : null]}
          placeholder="Ej: 3001234567"
          placeholderTextColor="#9CA3AF"
          value={telefono}
          onChangeText={(texto) => {
            setTelefono(texto);
            if (errores.telefono) setErrores({ ...errores, telefono: undefined });
          }}
          keyboardType="phone-pad"
        />
        {errores.telefono && (
          <Text style={styles.textoError}>{errores.telefono}</Text>
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

      {/* Confirmar contraseña */}
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Confirmar contraseña</Text>
        <View style={styles.filaContrasena}>
          <TextInput
            style={[styles.inputContrasena, errores.confirmarContrasena ? styles.inputError : null]}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={confirmarContrasena}
            onChangeText={(texto) => {
              setConfirmarContrasena(texto);
              if (errores.confirmarContrasena) setErrores({ ...errores, confirmarContrasena: undefined });
            }}
            secureTextEntry={!mostrarConfirmar}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.botonOjo}
            onPress={() => setMostrarConfirmar(!mostrarConfirmar)}
          >
            <Text style={styles.ojo}>{mostrarConfirmar ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {errores.confirmarContrasena && (
          <Text style={styles.textoError}>{errores.confirmarContrasena}</Text>
        )}
      </View>

      {/* Botón */}
      <TouchableOpacity
        style={[styles.boton, cargando ? styles.botonDeshabilitado : null]}
        onPress={handleRegistro}
        disabled={cargando}
        activeOpacity={0.85}
      >
        {cargando ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.textoBoton}>Crear cuenta</Text>
        )}
      </TouchableOpacity>

      {/* Ir a login */}
      <TouchableOpacity
        style={styles.enlace}
        onPress={() => router.replace('/Login')}
      >
        <Text style={styles.textoEnlace}>
          ¿Ya tienes cuenta?{' '}
          <Text style={styles.textoEnlaceNegrita}>Inicia sesión</Text>
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  contenedor: {
    gap: 20,
    paddingBottom: 32,
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