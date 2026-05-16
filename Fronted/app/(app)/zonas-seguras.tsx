import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import WebView from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Colors } from '@/constants/Colors'
import { zonaService, pacienteService, familiarService } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const { height: SCREEN_H } = Dimensions.get('window')

const ZONA_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H"
        crossorigin="anonymous"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH"
          crossorigin="anonymous"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    #map { height: 100vh; width: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([11.2404, -74.2110], 14);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${process.env.EXPO_PUBLIC_STADIA_API_KEY}', {
      maxZoom: 19, attribution: ''
    }).addTo(map);

    var marcador = null;
    var circulo  = null;
    var radioActual = 150;

    var shieldIcon = L.divIcon({
      html: '<div style="background:#2563eb;width:32px;height:32px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);color:white;font-size:18px;">&#10003;</div>',
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    map.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      if (marcador) { marcador.setLatLng([lat, lng]); }
      else { marcador = L.marker([lat, lng], { icon: shieldIcon }).addTo(map); }
      if (circulo) { circulo.setLatLng([lat, lng]); }
      else {
        circulo = L.circle([lat, lng], {
          radius: radioActual,
          fillColor: '#2563eb',
          fillOpacity: 0.15,
          color: '#2563eb',
          weight: 2
        }).addTo(map);
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
    });

    function updateRadio(r) {
      radioActual = r;
      if (circulo) circulo.setRadius(r);
    }

    function limpiar() {
      if (marcador) { map.removeLayer(marcador); marcador = null; }
      if (circulo)  { map.removeLayer(circulo);  circulo  = null; }
    }
  </script>
</body>
</html>`

type Coord = { latitud: number; longitud: number }

export default function ZonasSeguras() {
  const router  = useRouter()
  const mapRef  = useRef<WebView>(null)
  const { tipoUsuario } = useAuth()
  const esFamiliar = tipoUsuario === 'familiar'

  const [zonas,     setZonas]     = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  // Creación
  const [creando,   setCreando]   = useState(false)
  const [nombre,    setNombre]    = useState('')
  const [radio,     setRadio]     = useState('150')
  const [pacSelId,  setPacSelId]  = useState('')
  const [centro,    setCentro]    = useState<Coord | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [toggling,  setToggling]  = useState<string | null>(null)

  const cargar = async () => {
    try {
      if (esFamiliar) {
        const [resPac, resZonas] = await Promise.all([
          familiarService.misPacientes(),
          zonaService.listarFamiliar(),
        ])
        const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
        setPacientes(pacs)
        const validas = (Array.isArray(resZonas.data) ? resZonas.data : []).filter((z: any) => !!z.id)
        setZonas(validas)
      } else {
        const resPac = await pacienteService.listar()
        const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
        setPacientes(pacs)
        if (pacs.length > 0) setPacSelId(pacs[0].id_paciente ?? pacs[0].id)

        const resultados = await Promise.all(
          pacs.map((p) =>
            zonaService.listarPorPaciente(p.id_paciente ?? p.id).catch(() => ({ data: [] }))
          )
        )
        const todas = resultados.flatMap((rz) =>
          (Array.isArray(rz.data) ? rz.data : []).filter((z: any) => !!z.id)
        )
        setZonas(todas)
      }
    } catch {
      setZonas([])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (!creando) return
    const radioNum = parseInt(radio) || 150
    mapRef.current?.injectJavaScript(`updateRadio(${radioNum}); true;`)
  }, [radio, creando])

  const handleCrear = async () => {
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Escribe un nombre para la zona.'); return }
    if (!centro)        { Alert.alert('Falta el centro', 'Toca el mapa para elegir el centro de la zona.'); return }
    const radioNum = parseInt(radio)
    if (isNaN(radioNum) || radioNum < 50 || radioNum > 500) {
      Alert.alert('Radio inválido', 'El radio debe estar entre 50 y 500 metros.'); return
    }
    setGuardando(true)
    try {
      await zonaService.crear({ nombre: nombre.trim(), paciente_id: pacSelId, centro, radio_metros: radioNum })
      setCreando(false); setNombre(''); setRadio('150'); setCentro(null)
      await cargar()
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo crear la zona.')
    } finally { setGuardando(false) }
  }

  const handleEliminar = (id: string) => {
    Alert.alert('Eliminar zona', '¿Seguro que quieres eliminar esta zona segura?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await zonaService.eliminar(id)
            setZonas((z) => z.filter((x) => x.id !== id))
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail ?? 'No se pudo eliminar la zona.')
          }
        }},
    ])
  }

  const handleToggle = async (id: string, activa: boolean) => {
    if (toggling) return
    setToggling(id)
    try {
      await zonaService.toggle(id, !activa)
      setZonas((z) => z.map((x) => x.id === id ? { ...x, activa: !x.activa } : x))
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'No se pudo actualizar la zona.')
    } finally {
      setToggling(null)
    }
  }

  // ── Vista de creación con mapa ─────────────────────────────────────────
  if (creando) {
    return (
      <View style={{ flex: 1 }}>
        <WebView
          ref={mapRef}
          style={styles.mapCrear}
          source={{ html: ZONA_MAP_HTML }}
          javaScriptEnabled
          originWhitelist={['*']}
          onMessage={(e) => {
            try {
              const { lat, lng } = JSON.parse(e.nativeEvent.data)
              setCentro({ latitud: lat, longitud: lng })
            } catch {}
          }}
        />

        {!centro && (
          <View style={styles.hint}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.white} />
            <Text style={styles.hintText}>Toca el mapa para elegir el centro de la zona</Text>
          </View>
        )}

        <SafeAreaView style={styles.panel} edges={['bottom']}>
          <View style={styles.panelHandle} />

          <Text style={styles.panelTitle}>Nueva zona segura</Text>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} placeholder="Ej: Casa, Parque"
                placeholderTextColor={Colors.textSecondary}
                value={nombre} onChangeText={setNombre} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Radio (m)</Text>
              <TextInput style={[styles.input, { width: 80, textAlign: 'center' }]}
                keyboardType="number-pad" placeholder="150"
                placeholderTextColor={Colors.textSecondary}
                value={radio} onChangeText={setRadio} />
            </View>
          </View>

          {pacientes.length > 1 && (
            <View style={styles.field}>
              <Text style={styles.label}>Paciente</Text>
              <View style={styles.pacRow}>
                {pacientes.map((p) => {
                  const pid = p.id_paciente ?? p.id
                  return (
                  <TouchableOpacity key={pid}
                    style={[styles.pacChip, pacSelId === pid && styles.pacChipActivo]}
                    onPress={() => setPacSelId(pid)} activeOpacity={0.8}>
                    <Text style={[styles.pacChipText, pacSelId === pid && styles.pacChipTextActivo]}
                      numberOfLines={1}>{p.nombre_paciente}</Text>
                  </TouchableOpacity>
                )})}
              </View>
            </View>
          )}

          {centro && (
            <View style={styles.coordBox}>
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.coordText}>
                {centro.latitud.toFixed(5)}, {centro.longitud.toFixed(5)}
              </Text>
              <TouchableOpacity
                onPress={() => { setCentro(null); mapRef.current?.injectJavaScript('limpiar(); true;') }}
                style={{ marginLeft: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.panelBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreando(false); setCentro(null) }} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.crearBtn, (!centro || guardando) && styles.crearBtnDisabled]}
              onPress={handleCrear} disabled={!centro || guardando} activeOpacity={0.85}>
              {guardando
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.crearText}>Guardar zona</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  // ── Vista de lista ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zonas seguras</Text>
        {!esFamiliar && (
          <TouchableOpacity onPress={() => setCreando(true)} style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={26} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primaryLight} /></View>
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={styles.list}>
          {zonas.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="shield-outline" size={56} color={Colors.primaryLight} />
              <Text style={styles.emptyText}>
                {esFamiliar ? 'No hay zonas seguras registradas' : 'No hay zonas seguras\nToca + para crear una'}
              </Text>
            </View>
          ) : zonas.map((item) => {
            const pac = pacientes.find((p) => (p.id_paciente ?? p.id) === item.paciente_id)
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.zonaIcon, !item.activa && styles.zonaIconOff]}>
                    <Ionicons name="shield-checkmark" size={22}
                      color={item.activa ? Colors.primary : Colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.zonaNombre}>{item.nombre}</Text>
                    <Text style={styles.zonaMeta}>{pac?.nombre_paciente ?? '—'} · {item.radio_metros}m</Text>
                  </View>
                </View>
                {!esFamiliar && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => handleToggle(item.id, item.activa)}
                      activeOpacity={0.7}
                      style={[styles.actionBtn, toggling === item.id && { opacity: 0.4 }]}
                      disabled={toggling !== null}
                    >
                      {toggling === item.id
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Ionicons name={item.activa ? 'toggle' : 'toggle-outline'} size={28}
                            color={item.activa ? Colors.primary : Colors.textSecondary} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminar(item.id)} activeOpacity={0.7} style={styles.actionBtn}>
                      <Ionicons name="trash-outline" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backBtn:     { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.white },
  addBtn:      { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyText: { fontSize: 15, color: Colors.primaryLight, textAlign: 'center', lineHeight: 22 },
  list:   { padding: 16, gap: 12, flexGrow: 1 },
  card:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 12, elevation: 3 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { padding: 6 },
  zonaIcon:    { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center' },
  zonaIconOff: { backgroundColor: Colors.surface },
  zonaNombre:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  zonaMeta:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Creación con mapa
  mapCrear: { flex: 1, height: SCREEN_H * 0.52 },
  hint:     { position: 'absolute', top: 52, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  hintText: { color: Colors.white, fontSize: 13, fontWeight: '500' },

  panel: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12, elevation: 16 },
  panelHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  panelTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  row:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  field:  { marginBottom: 14 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input:  { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: Colors.text, backgroundColor: Colors.background },
  pacRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pacChip:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  pacChipActivo: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  pacChipText:       { fontSize: 13, color: Colors.textSecondary },
  pacChipTextActivo: { color: Colors.primary, fontWeight: '700' },
  coordBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryBg, borderRadius: 10, padding: 10, marginBottom: 14, gap: 6 },
  coordText:{ flex: 1, fontSize: 12, color: Colors.primary, fontWeight: '600' },
  panelBtns:  { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn:  { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  crearBtn:   { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  crearBtnDisabled: { opacity: 0.45 },
  crearText:  { color: Colors.white, fontWeight: '700', fontSize: 15 },
})
