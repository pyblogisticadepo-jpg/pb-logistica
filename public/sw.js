const CACHE_NAME = 'pyb-logistica-v1'
const GPS_INTERVAL = 30000

let gpsInterval = null
let supabaseUrl = null
let supabaseKey = null
let operarioNombre = null

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

self.addEventListener('message', (e) => {
  const { type, data } = e.data || {}

  if (type === 'START_GPS') {
    supabaseUrl = data.supabaseUrl
    supabaseKey = data.supabaseKey
    operarioNombre = data.operario

    if (gpsInterval) clearInterval(gpsInterval)

    // Enviar GPS inmediatamente y luego cada 30s
    enviarGPS()
    gpsInterval = setInterval(enviarGPS, GPS_INTERVAL)
  }

  if (type === 'STOP_GPS') {
    if (gpsInterval) { clearInterval(gpsInterval); gpsInterval = null }
    operarioNombre = null
  }
})

async function enviarGPS() {
  if (!operarioNombre || !supabaseUrl || !supabaseKey) return

  // Pedir ubicación a los clientes activos
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (allClients.length === 0) return

  // Pedirle la ubicación al primer cliente disponible
  allClients[0].postMessage({ type: 'GET_LOCATION' })
}

self.addEventListener('message', async (e) => {
  if (e.data?.type === 'LOCATION_UPDATE') {
    const { lat, lng } = e.data
    if (!lat || !lng || !operarioNombre) return

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
    } catch (e) {
      console.error('GPS SW error:', e)
    }
  }
})