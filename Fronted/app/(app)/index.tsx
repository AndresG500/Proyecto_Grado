import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import WebView from 'react-native-webview'
import { DrawerActions, useNavigation, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { pacienteService, zonaService, familiarService, grupoService } from '@/services/api'
import { useSSEUbicacion } from '@/hooks/useSSEUbicacion'
import { useAuth } from '@/context/AuthContext'
import * as Location from 'expo-location'
import {
  iniciarSeguimiento,
  enviarUbicacionCuidador, obtenerUbicacionesGrupo,
  enviarUbicacionFamiliar, obtenerUbicacionesGrupoFamiliar,
  type UbicacionCuidador, type UbicacionFamiliar,
} from '@/services/ubicacion'

function buildMapHTML(pacientes: any[], zonas: any[], cuidadores: UbicacionCuidador[] = [], familiares: UbicacionFamiliar[] = []): string {
  const zonesJs = zonas.map((zona) => {
    const lat   = zona.centro?.latitud  ?? 0
    const lng   = zona.centro?.longitud ?? 0
    const radio = zona.radio_metros     ?? 150
    const color = zona.activa ? '#2563eb' : '#888888'
    const id    = zona.id ?? ''
    return `
      (function() {
        var circle = L.circle([${lat}, ${lng}], {
          radius: ${radio},
          fillColor: '${color}',
          fillOpacity: 0.15,
          color: '${color}',
          weight: 2
        }).addTo(map);
        ${id ? `zoneCircles['${id}'] = circle;` : ''}
      })();`
  }).join('\n')

  const markersJs = pacientes.map((pac) => {
    const id     = pac.id_paciente ?? pac.id
    const nombre = (pac.nombre_paciente ?? '').replace(/'/g, "\\'")
    const ub     = pac.ultima_ubicacion
    if (!ub) return ''
    const lat = ub.latitud  ?? ub.lat  ?? 0
    const lng = ub.longitud ?? ub.lng  ?? 0
    return `
      (function() {
        var m = L.marker([${lat}, ${lng}], { icon: personIcon }).addTo(map);
        m.bindPopup('${nombre}');
        markers['${id}'] = m;
      })();`
  }).join('\n')

  const cuidadorMarkersJs = cuidadores
    .filter((c) => c.latitud && c.longitud)
    .map((c) => `
      (function() {
        var m = L.marker([${c.latitud}, ${c.longitud}], { icon: cuidadorIcon }).addTo(map);
        m.bindPopup('Cuidador');
        cuidadorMarkers['${c.cuidador_id}'] = m;
      })();`)
    .join('\n')

  const familiarMarkersJs = familiares
    .filter((f) => f.latitud && f.longitud)
    .map((f) => `
      (function() {
        var m = L.marker([${f.latitud}, ${f.longitud}], { icon: familiarIcon }).addTo(map);
        m.bindPopup('Familiar');
        familiarMarkers['${f.familiar_id}'] = m;
      })();`)
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    #map { height: 100vh; width: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([11.2404, -74.2110], 14);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=${process.env.EXPO_PUBLIC_STADIA_API_KEY}', {
      maxZoom: 19, attribution: ''
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    var markers = {};
    var cuidadorMarkers = {};
    var familiarMarkers = {};
    var zoneCircles = {};

    var personIcon = L.divIcon({
      html: '<div style="background:#2563eb;width:32px;height:32px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35)"><svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"14\\" height=\\"14\\" viewBox=\\"0 0 24 24\\" fill=\\"white\\"><path d=\\"M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z\\"/></svg></div>',
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    var cuidadorIcon = L.divIcon({
      html: '<div style="background:#16a34a;width:28px;height:28px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35)"><svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"12\\" height=\\"12\\" viewBox=\\"0 0 24 24\\" fill=\\"white\\"><path d=\\"M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z\\"/></svg></div>',
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    var familiarIcon = L.divIcon({
      html: '<div style="background:#9333ea;width:28px;height:28px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35)"><svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"12\\" height=\\"12\\" viewBox=\\"0 0 24 24\\" fill=\\"white\\"><path d=\\"M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z\\"/></svg></div>',
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    ${zonesJs}
    ${markersJs}
    ${cuidadorMarkersJs}
    ${familiarMarkersJs}

    function updateMarker(id, lat, lng) {
      if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
      } else {
        var m = L.marker([lat, lng], { icon: personIcon }).addTo(map);
        markers[id] = m;
      }
    }

    function updateCuidador(id, lat, lng) {
      if (cuidadorMarkers[id]) {
        cuidadorMarkers[id].setLatLng([lat, lng]);
      } else {
        var m = L.marker([lat, lng], { icon: cuidadorIcon }).addTo(map);
        m.bindPopup('Cuidador');
        cuidadorMarkers[id] = m;
      }
    }

    function updateFamiliar(id, lat, lng) {
      if (familiarMarkers[id]) {
        familiarMarkers[id].setLatLng([lat, lng]);
      } else {
        var m = L.marker([lat, lng], { icon: familiarIcon }).addTo(map);
        m.bindPopup('Familiar');
        familiarMarkers[id] = m;
      }
    }

    function flyTo(lat, lng) {
      map.flyTo([lat, lng], 16, { duration: 0.8 });
    }

    function addOrUpdateZone(id, lat, lng, radio, activa) {
      var color = activa ? '#2563eb' : '#888888';
      var opts = { radius: radio, fillColor: color, fillOpacity: 0.15, color: color, weight: 2 };
      if (zoneCircles[id]) {
        zoneCircles[id].setLatLng([lat, lng]);
        zoneCircles[id].setRadius(radio);
        zoneCircles[id].setStyle({ fillColor: color, color: color });
      } else {
        zoneCircles[id] = L.circle([lat, lng], opts).addTo(map);
      }
    }
  </script>
</body>
</html>`
}

export default function MapScreen() {
  const navigation  = useNavigation()
  const { tipoUsuario, cuidador } = useAuth()
  const webViewRef  = useRef<WebView>(null)
  const [pacientes,  setPacientes]  = useState<any[]>([])
  const [online,     setOnline]     = useState(true)
  const [loading,    setLoading]    = useState(true)
  const [mapHtml,    setMapHtml]    = useState('')
  const [selPacId,   setSelPacId]   = useState<string | null>(null)
  const gruposRef         = useRef<any[]>([])
  const gruposFamiliarRef = useRef<any[]>([])
  const zonasRef          = useRef<any[]>([])
  const mapaListo         = useRef(false)

  // Los familiares no pueden acceder al stream SSE (requiere token de cuidador)
  const { ubicacion, conectado } = useSSEUbicacion(tipoUsuario === 'familiar' ? null : selPacId)

  const cargarDatos = useCallback(async () => {
    try {
      const resPac = tipoUsuario === 'familiar'
        ? await familiarService.misPacientes()
        : await pacienteService.listar()
      const pacs: any[] = Array.isArray(resPac.data) ? resPac.data : []
      setPacientes(pacs)

      if (pacs.length > 0 && !selPacId) {
        setSelPacId(pacs[0].id_paciente ?? pacs[0].id)
      }

      const todasZonas: any[] = []
      if (tipoUsuario === 'familiar') {
        try {
          const rz = await zonaService.listarFamiliar()
          todasZonas.push(...(Array.isArray(rz.data) ? rz.data : []))
        } catch {}
      } else {
        for (const p of pacs) {
          try {
            const rz = await zonaService.listarPorPaciente(p.id_paciente ?? p.id)
            todasZonas.push(...(Array.isArray(rz.data) ? rz.data : []))
          } catch {}
        }
      }

      // Cargar ubicaciones de miembros del grupo
      const todasUbicaciones: UbicacionCuidador[] = []
      const todasFamiliares:  UbicacionFamiliar[]  = []

      if (tipoUsuario !== 'familiar') {
        // Cuidador: obtener ubicaciones de otros cuidadores
        try {
          const resGrupos = await grupoService.listar()
          const gruposList: any[] = Array.isArray(resGrupos.data) ? resGrupos.data : []
          gruposRef.current = gruposList
          for (const g of gruposList) {
            const ubs = await obtenerUbicacionesGrupo(g.id)
            todasUbicaciones.push(...ubs.cuidadores)
          }
        } catch {}
      } else {
        // Familiar: obtener ubicaciones de cuidadores y otros familiares del grupo
        try {
          const resGrupos = await familiarService.misGrupos()
          const gruposList: any[] = Array.isArray(resGrupos.data) ? resGrupos.data : []
          gruposFamiliarRef.current = gruposList
          for (const g of gruposList) {
            const gId = g.id ?? g.grupo_id ?? g._id
            if (!gId) continue
            const ubs = await obtenerUbicacionesGrupoFamiliar(gId)
            todasUbicaciones.push(...ubs.cuidadores)
            todasFamiliares.push(...ubs.familiares)
          }
        } catch {}
      }

      zonasRef.current = todasZonas
      setOnline(true)

      if (!mapaListo.current) {
        // Primera carga: construir el HTML completo con Leaflet
        setMapHtml(buildMapHTML(pacs, todasZonas, todasUbicaciones, todasFamiliares))
        mapaListo.current = true
      } else {
        // Recargas siguientes: actualizar marcadores y zonas via inject
        for (const z of todasZonas) {
          const lat = z.centro?.latitud
          const lng = z.centro?.longitud
          if (!z.id || lat == null || lng == null) continue
          const radio  = z.radio_metros ?? 150
          const activa = !!z.activa
          const js = `addOrUpdateZone('${z.id}', ${lat}, ${lng}, ${radio}, ${activa}); true;`
          webViewRef.current?.injectJavaScript(js)
        }
        for (const c of todasUbicaciones) {
          const js = `updateCuidador('${c.cuidador_id}', ${c.latitud}, ${c.longitud}); true;`
          webViewRef.current?.injectJavaScript(js)
        }
        for (const f of todasFamiliares) {
          const js = `updateFamiliar('${f.familiar_id}', ${f.latitud}, ${f.longitud}); true;`
          webViewRef.current?.injectJavaScript(js)
        }
        if (tipoUsuario === 'familiar') {
          // Actualizar marcadores de pacientes (sin SSE, basado en ultima_ubicacion)
          for (const p of pacs) {
            const ub = p.ultima_ubicacion
            if (!ub) continue
            const id  = p.id_paciente ?? p.id
            const lat = ub.latitud ?? ub.lat
            const lng = ub.longitud ?? ub.lng
            if (lat != null && lng != null) {
              const js = `updateMarker('${id}', ${lat}, ${lng}); true;`
              webViewRef.current?.injectJavaScript(js)
            }
          }
        }
      }
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [tipoUsuario]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargarDatos()
    const intervalo = setInterval(cargarDatos, 60_000)
    return () => clearInterval(intervalo)
  }, [cargarDatos])

  useEffect(() => {
    if (!ubicacion || !selPacId) return
    const js = `updateMarker('${selPacId}', ${ubicacion.latitude}, ${ubicacion.longitude}); true;`
    webViewRef.current?.injectJavaScript(js)
  }, [ubicacion, selPacId])

  // Rastrear y publicar la posición propia (cuidadores)
  useEffect(() => {
    if (tipoUsuario === 'familiar') return
    let suscripcion: Location.LocationSubscription | null = null

    iniciarSeguimiento(({ latitude, longitude }) => {
      const gs = gruposRef.current
      for (const g of gs) {
        enviarUbicacionCuidador(g.id, latitude, longitude)
      }
      const miId = cuidador?.id ?? 'yo'
      const js = `updateCuidador('${miId}', ${latitude}, ${longitude}); true;`
      webViewRef.current?.injectJavaScript(js)
    })
      .then((sub) => { suscripcion = sub })
      .catch(() => {})

    return () => { suscripcion?.remove() }
  }, [tipoUsuario, cuidador])

  // Rastrear y publicar la posición propia (familiares)
  useEffect(() => {
    if (tipoUsuario !== 'familiar') return
    let suscripcion: Location.LocationSubscription | null = null

    iniciarSeguimiento(({ latitude, longitude }) => {
      const gs = gruposFamiliarRef.current
      for (const g of gs) {
        const gId = g.id ?? g.grupo_id ?? g._id
        if (gId) enviarUbicacionFamiliar(gId, latitude, longitude)
      }
      const miId = cuidador?.id ?? 'yo_familiar'
      const js = `updateFamiliar('${miId}', ${latitude}, ${longitude}); true;`
      webViewRef.current?.injectJavaScript(js)
    })
      .then((sub) => { suscripcion = sub })
      .catch(() => {})

    return () => { suscripcion?.remove() }
  }, [tipoUsuario, cuidador])

  // Cuando el usuario vuelve a esta pantalla, refresca zonas y ubicaciones
  useFocusEffect(
    useCallback(() => {
      if (mapaListo.current) cargarDatos()
    }, [cargarDatos])
  )

  const irAPaciente = (pac: any) => {
    const id = pac.id_paciente ?? pac.id
    setSelPacId(id)
    const ub = pac.ultima_ubicacion
    if (!ub) return
    const lat = ub.latitud  ?? ub.lat
    const lng = ub.longitud ?? ub.lng
    if (lat == null || lng == null) return
    webViewRef.current?.injectJavaScript(`flyTo(${lat}, ${lng}); true;`)
  }

  return (
    <View style={styles.container}>
      {mapHtml ? (
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHtml }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}
        />
      ) : (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        activeOpacity={0.85}
      >
        <Ionicons name="menu" size={24} color={Colors.primary} />
      </TouchableOpacity>

      <View style={[styles.statusBadge, !online && styles.statusBadgeOffline]}>
        {loading
          ? <ActivityIndicator size="small" color={online ? Colors.success : Colors.warning} />
          : <View style={[styles.statusDot, !online && styles.statusDotOffline]} />}
        <Text style={[styles.statusText, !online && styles.statusTextOffline]}>
          {loading ? 'Cargando...' : online ? (conectado ? 'En línea' : 'Sin GPS') : 'Sin conexión'}
        </Text>
      </View>

      {pacientes.length > 0 && (
        <View style={styles.pacientesBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {pacientes.map((pac) => {
              const id = pac.id_paciente ?? pac.id
              const activo = selPacId === id
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.pacienteChip, activo && styles.pacienteChipActivo]}
                  onPress={() => irAPaciente(pac)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.chipDot, activo && styles.chipDotActivo]} />
                  <Text style={[styles.chipText, activo && styles.chipTextActivo]} numberOfLines={1}>
                    {pac.nombre_paciente}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  map:          { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },

  menuBtn: {
    position: 'absolute', top: 52, left: 16,
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },

  statusBadge: {
    position: 'absolute', top: 52, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  statusBadgeOffline: { backgroundColor: '#FFF8E1' },
  statusDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  statusDotOffline:   { backgroundColor: Colors.warning },
  statusText:         { fontSize: 13, fontWeight: '600', color: Colors.text },
  statusTextOffline:  { color: Colors.warning },

  pacientesBar: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
  },
  pacienteChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  pacienteChipActivo: { borderColor: Colors.primary },
  chipDot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textSecondary },
  chipDotActivo:      { backgroundColor: Colors.success },
  chipText:           { fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: 120 },
  chipTextActivo:     { color: Colors.primary },
})
