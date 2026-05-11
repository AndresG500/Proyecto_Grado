import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import FormLogin from '../components/form_login'

export default function LoginScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Encabezado */}
        <View style={styles.encabezado}>
          <View style={styles.iconoContenedor}>
            <Text style={styles.icono}>📍</Text>
          </View>
          <Text style={styles.titulo}>UbiLife</Text>
          <Text style={styles.subtitulo}>Inicia sesión para continuar</Text>
        </View>

        {/* Formulario */}
        <FormLogin />

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  encabezado: {
    alignItems: 'center',
    marginBottom: 40,
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