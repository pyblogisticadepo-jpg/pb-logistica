const GPS_INTERVAL = 25000
let gpsTimer = null
let supabaseUrl = null
let supabaseKey = null
let operarioNombre = null
let watchId = null

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

// Un solo listener de mensajes
self.addEventListener('message', async (e) => {
  const { type, data } = e.data || {}

  if (type === 'START_GPS') {
    supabaseUrl = data.supabaseUrl
    supabaseKey = data.supabaseKey
    operarioNombre = data.operario
    iniciarGPS()
    return
  }

  if (type === 'STOP_GPS') {
    detenerGPS()
    return
  }

  if (type === 'LOCATION_UPDATE') {
    const { lat, lng } = data || e.data
    if (lat && lng && operarioNombre) {
      await subirPosicion(lat, lng)
    }
    return
  }

  if (type === 'PING') {
    // Mantener SW activo — responder al ping
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    allClients.forEach(c => c.postMessage({ type: 'PONG' }))
    return
  }
})

function iniciarGPS() {
  detenerGPS()
  // Pedir ubicación inmediata
  pedirUbicacion()
  // Repetir cada 25s con timer propio
  gpsTimer = setInterval(() => {
    pedirUbicacion()
  }, GPS_INTERVAL)
}

function detenerGPS() {
  if (gpsTimer) { clearInterval(gpsTimer); gpsTimer = null }
  operarioNombre = null
}

async function pedirUbicacion() {
  if (!operarioNombre) return
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (allClients.length > 0) {
    allClients[0].postMessage({ type: 'GET_LOCATION' })
  }
}

async function subirPosicion(lat, lng) {
  if (!supabaseUrl || !supabaseKey || !operarioNombre) return
  try {
    await fetch(`${supabaseUrl}/rest/v1/gps_positions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        operario: operarioNombre,
        lat,
        lng,
        updated_at: new Date().toISOString()
      })
    })
  } catch (err) {
    console.error('GPS SW error:', err)
  }
}