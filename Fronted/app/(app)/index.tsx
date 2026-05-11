import { View, TouchableOpacity, StyleSheet, Text } from 'react-native'
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { Colors } from '@/constants/Colors'

// Santa Marta, Colombia — región inicial del mapa
const INITIAL_REGION = {
  latitude:      11.2404,
  longitude:    -74.2110,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
}

export default function MapScreen() {
  const navigation = useNavigation()

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale
        rotateEnabled={false}
        toolbarEnabled={false}
      />

      {/* Botón hamburguesa */}
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        activeOpacity={0.85}
      >
        <Text style={styles.menuLine}>▬</Text>
        <Text style={styles.menuLine}>▬</Text>
        <Text style={styles.menuLine}>▬</Text>
      </TouchableOpacity>

      {/* Badge de estado (esquina superior derecha) */}
      <View style={styles.statusBadge}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>En línea</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  menuBtn: {
    position:        'absolute',
    top:             52,
    left:            16,
    width:           48,
    height:          48,
    borderRadius:    14,
    backgroundColor: Colors.white,
    justifyContent:  'center',
    alignItems:      'center',
    gap:             2,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
    elevation:       6,
  },
  menuLine: {
    fontSize:   10,
    color:      Colors.primary,
    lineHeight: 11,
  },

  statusBadge: {
    position:        'absolute',
    top:             52,
    right:           16,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical:   10,
    borderRadius:    14,
    gap:             7,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.12,
    shadowRadius:    8,
    elevation:       6,
  },
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize:   13,
    fontWeight: '600',
    color:      Colors.text,
  },
})
