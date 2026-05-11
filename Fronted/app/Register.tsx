import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FormRegistro from '../components/form_register';

export default function RegistroScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Encabezado */}
      <View style={styles.encabezado}>
        <View style={styles.iconoContenedor}>
          <Text style={styles.icono}>📍</Text>
        </View>
        <Text style={styles.titulo}>UbiLife</Text>
        <Text style={styles.subtitulo}>Crea tu cuenta de cuidador</Text>
      </View>

      {/* Formulario */}
      <FormRegistro />

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  encabezado: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconoContenedor: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icono: {
    fontSize: 36,
  },
  titulo: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1E3A5F',
    letterSpacing: 0.5,
  },
  subtitulo: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
  },
});