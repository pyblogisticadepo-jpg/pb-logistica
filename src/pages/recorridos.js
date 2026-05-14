const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjIwOTM5ZWM0NzVhYzRmZjA5ZjQ1NWVlODk3OWIyMTk0IiwiaCI6Im11cm11cjY0In0='
const DEPOSITO = { lat: -31.4493549, lng: -64.1171403, nombre: 'Depósito P&B' }

async function geocodeAddress(address) {
  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_KEY}&text=${encodeURIComponent(address + ', Córdoba, Argentina')}&size=1`
    const res = await fetch(url)
    const data = await res.json()
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates
      return { lat, lng }
    }
  } catch (e) { console.error('Geocode error:', e) }
  return null
}

async function optimizeRoute(pedidos) {
  try {
    const jobs = pedidos.map((p, i) => ({ id: i + 1, location: [p.coords.lng, p.coords.lat], description: p.cliente }))
    const body = { jobs, vehicles: [{ id: 1, start: [DEPOSITO.lng, DEPOSITO.lat], end: [DEPOSITO.lng, DEPOSITO.lat] }] }
    const res = await fetch('https://api.openrouteservice.org/optimization', {
      method: 'POST',
      headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (data.routes && data.routes[0]) {
      const steps = data.routes[0].steps.filter(s => s.type === 'job')
      return steps.map(s => pedidos[s.job - 1])
    }
  } catch (e) { console.error('ORS optimize error:', e) }
  return pedidos
}

let leafletLoaded = false
let mapInstance = null
let mapMarkers = []
let mapInterval = null

async function loadLeaflet() {
  if (leafletLoaded) return
  await new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => { leafletLoaded = true; resolve() }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export async function renderRecorridos(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)

  if (mapInterval) { clearInterval(mapInterval); mapInterval = null }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Recorridos</span><span class="page-subtitle" id="rec-sub"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-new-rec"><i class="ti ti-plus"></i> Nuevo recorrido</button>' : ''}
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="lista">Recorridos del día</button>
      <button class="tab-btn" data-tab="mapa">GPS en tiempo real</button>
    </div>
    <div class="tab-content active" id="tab-lista">
      <div id="rec-list"><div class="loading">Cargando...</div></div>
    </div>
    <div class="tab-content" id="tab-mapa">
      <div id="map-container" style="height:420px;border-radius:2px;overflow:hidden;border:1px solid #1e1e1e;"></div>
      <div id="map-legend" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;"></div>
      <div style="font-size:11px;color:#2a2a2a;margin-top:8px;text-align:center">GPS se actualiza cada 30s · El operario debe tener la app abierta</div>
    </div>

    <div class="modal-overlay" id="modal-new-rec">
      <div class="modal"><div class="modal-top-bar" style="background:#5aadee"></div>
        <div class="modal-header"><span class="modal-title">Nuevo recorrido</span><button class="modal-close" id="close-new-rec"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#3a6a3a;margin-bottom:16px;display:flex;gap:10px;">
            <i class="ti ti-info-circle" style="color:#52c452;flex-shrink:0"></i>
            <span>Solo pedidos <strong>habilitados</strong> con dirección cargada. La ruta se optimiza automáticamente.</span>
          </div>
          <div class="form-row"><label class="form-label">Seleccionar pedidos</label>
            <div id="pedidos-disponibles" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
          </div>
          <div class="form-row"><label class="form-label">Asignar operario <span class="req">*</span></label>
            <select class="form-select" id="rec-operario"></select>
          </div>
          <div id="ruta-preview" style="display:none;margin-top:16px;">
            <div style="font-size:10px;letter-spacing:3px;color:#5aadee;text-transform:uppercase;margin-bottom:10px;"><i class="ti ti-route"></i> Ruta optimizada</div>
            <div id="ruta-steps"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-new-rec">Cancelar</button>
          <button class="btn-confirm" id="optimizar-btn"><i class="ti ti-route"></i> Optimizar y crear</button>
        </div>
      </div>
    </div>`

  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      el.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
      btn.classList.add('active')
      el.querySelector('#tab-' + btn.dataset.tab).classList.add('active')
      if (btn.dataset.tab === 'mapa') initMap()
    }
  })

  let selectedPedidos = []
  const modal = el.querySelector('#modal-new-rec')
  el.querySelector('#close-new-rec').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-new-rec').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  async function load() {
    let query = supabase.from('recorridos').select(`*, recorrido_pedidos(*)`).order('created_at', { ascending: false })
    if (currentUser.rol === 'operario') query = query.eq('operario', currentUser.nombre)
    const { data } = await query
    const recorridos = data || []
    el.querySelector('#rec-sub').textContent = recorridos.length + ' recorridos'
    const list = el.querySelector('#rec-list')
    if (recorridos.length === 0) { list.innerHTML = '<div class="empty-state">Sin recorridos</div>'; return }
    list.innerHTML = recorridos.map(r => {
      const ent = r.recorrido_pedidos.filter(p => p.estado === 'entregado').length
      const estBadge = r.estado === 'en-ruta' ? '<span class="badge badge-en-ruta">En ruta</span>' : r.estado === 'completado' ? '<span class="badge badge-completado">Completado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'
      return `<div class="recorrido-card">
        <div class="recorrido-card-header" data-toggle="${r.id}">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;color:#444;margin-bottom:3px">${r.codigo}</div>
            <div style="font-size:13px;color:#ccc">Operario: <strong>${r.operario}</strong> · ${r.recorrido_pedidos.length} paradas · ${ent} entregadas · ${estBadge}${r.vehiculo ? ' · ' + r.vehiculo : ''}</div>
          </div>
          <i class="ti ti-chevron-down" style="color:#333;font-size:16px"></i>
        </div>
        <div class="recorrido-card-body" id="rbody-${r.id}">
          ${r.recorrido_pedidos.length === 0 ? '<div style="color:#2a2a2a;font-size:12px;padding:8px">Sin paradas</div>' :
          r.recorrido_pedidos.map(p => `
            <div class="recorrido-stop">
              <div class="stop-num ${p.tipo}">${p.orden}</div>
              <div style="flex:1">
                <div style="font-size:13px;color:#ccc;font-weight:500">${p.cliente_nombre}</div>
                <div style="font-size:11px;color:#333;margin-top:2px"><i class="ti ti-map-pin" style="font-size:10px"></i> ${p.direccion || '—'}${p.tipo === 'externo' ? ' · ' + (p.transporte_nombre || '') : ''}</div>
              </div>
              <div>${p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>` : '<span class="badge badge-pendiente" style="font-size:9px">Pendiente</span>'}</div>
            </div>`).join('')}
        </div>
      </div>`
    }).join('')
    list.querySelectorAll('[data-toggle]').forEach(h => {
      h.onclick = () => document.getElementById('rbody-' + h.dataset.toggle).classList.toggle('open')
    })
  }

  async function initMap() {
    const mapContainer = el.querySelector('#map-container')
    if (!mapContainer) return
    await loadLeaflet()
    if (mapInstance) { mapInstance.remove(); mapInstance = null }
    mapInstance = L.map(mapContainer).setView([DEPOSITO.lat, DEPOSITO.lng], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance)
    const depositoIcon = L.divIcon({
      html: `<div style="background:#fff;border:2px solid #555;width:14px;height:14px;border-radius:2px;"></div>`,
      iconSize: [14,14], iconAnchor: [7,7], className: ''
    })
    L.marker([DEPOSITO.lat, DEPOSITO.lng], { icon: depositoIcon })
      .addTo(mapInstance)
      .bindPopup('<strong>Depósito P&B</strong>')
    await updateMapMarkers()
    if (mapInterval) clearInterval(mapInterval)
    mapInterval = setInterval(updateMapMarkers, 30000)
  }

  const colors = ['#a78bfa','#52c452','#d4a830','#5aadee','#ff6b2b']

  async function updateMapMarkers() {
    if (!mapInstance) return
    const { data: recorridos } = await supabase.from('recorridos').select('*').eq('estado', 'en-ruta')
    const activos = recorridos || []
    const legend = el.querySelector('#map-legend')
    if (!legend) return
    mapMarkers.forEach(m => mapInstance.removeLayer(m))
    mapMarkers = []
    if (activos.length === 0) {
      legend.innerHTML = '<div style="font-size:12px;color:#2a2a2a;text-align:center;padding:12px">No hay vehículos en ruta ahora</div>'
      return
    }
    const { data: posiciones } = await supabase.from('gps_positions').select('*').in('operario', activos.map(r => r.operario))
    const posMap = {}
    ;(posiciones || []).forEach(p => { posMap[p.operario] = p })
    legend.innerHTML = ''
    activos.forEach((r, i) => {
      const color = colors[i % colors.length]
      const pos = posMap[r.operario]
      const lastUpdate = pos ? new Date(pos.updated_at).toTimeString().slice(0,5) : null
      if (pos) {
        const icon = L.divIcon({
          html: `<div style="background:${color};border:2px solid #fff;width:16px;height:16px;border-radius:50%;box-shadow:0 0 6px ${color}88;"></div>`,
          iconSize: [16,16], iconAnchor: [8,8], className: ''
        })
        const marker = L.marker([pos.lat, pos.lng], { icon })
          .addTo(mapInstance)
          .bindPopup(`<strong>${r.operario}</strong><br>${r.codigo}<br>GPS: ${lastUpdate}`)
        mapMarkers.push(marker)
      }
      legend.innerHTML += `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111;border:1px solid #1e1e1e;border-radius:2px;">
          <div style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;${pos ? 'box-shadow:0 0 6px ' + color + '88' : 'opacity:.4'}"></div>
          <div style="flex:1">
            <div style="font-size:13px;color:#ccc;font-weight:500">${r.operario} · ${r.vehiculo || '—'}</div>
            <div style="font-size:11px;color:#444;margin-top:2px">${r.codigo}${lastUpdate ? ' · GPS: ' + lastUpdate : ' · <span style="color:#555">Sin señal GPS</span>'}</div>
          </div>
        </div>`
    })
  }

  if (canEdit) {
    el.querySelector('#btn-new-rec').onclick = async () => {
      selectedPedidos = []
      el.querySelector('#ruta-preview').style.display = 'none'
      const optimizarBtn = el.querySelector('#optimizar-btn')
      optimizarBtn.innerHTML = '<i class="ti ti-route"></i> Optimizar y crear'
      optimizarBtn.disabled = false
      optimizarBtn.dataset.step = ''

      const { data: enRuta } = await supabase.from('recorrido_pedidos').select('nota_pedido')
      const notasEnRuta = (enRuta || []).map(p => p.nota_pedido)
      const { data: pk } = await supabase.from('picking').select('id, nota_pedido, cliente_nombre, cliente_id').eq('estado', 'habilitado')
      const disponiblesPk = (pk || []).filter(p => !notasEnRuta.includes(p.nota_pedido))

      if (disponiblesPk.length === 0) {
        el.querySelector('#pedidos-disponibles').innerHTML = '<div style="color:#2a2a2a;font-size:12px;padding:10px">Sin pedidos habilitados disponibles</div>'
      } else {
        const clienteIds = [...new Set(disponiblesPk.map(p => p.cliente_id).filter(Boolean))]
        let clientesMap = {}
        if (clienteIds.length > 0) {
          const { data: clientes } = await supabase.from('clientes').select('id, nombre, direccion, transporte_tipo, transporte_id').in('id', clienteIds)
          ;(clientes || []).forEach(c => { clientesMap[c.id] = c })
        }
        const transporteIds = [...new Set(Object.values(clientesMap).map(c => c.transporte_id).filter(Boolean))]
        let transportesMap = {}
        if (transporteIds.length > 0) {
          const { data: transportes } = await supabase.from('transportes').select('id, nombre, direccion, retira_deposito').in('id', transporteIds)
          ;(transportes || []).forEach(t => { transportesMap[t.id] = t })
        }
        const div = el.querySelector('#pedidos-disponibles')
        div.innerHTML = disponiblesPk.map(p => {
          const cliente = clientesMap[p.cliente_id] || {}
          const tipoTransporte = cliente.transporte_tipo || 'pyb'
          if (tipoTransporte === 'retira') return ''
          const transporte = transportesMap[cliente.transporte_id] || {}
          if (tipoTransporte === 'externo' && transporte.retira_deposito) return ''
          const esPyb = tipoTransporte === 'pyb'
          const direccion = esPyb ? (cliente.direccion || '') : (transporte.direccion || '')
          const tieneDir = !!direccion
          const tipoLabel = esPyb ? 'Entrega P&B' : 'Transp. ext.'
          return `<div data-pk="${p.id}" data-nota="${p.nota_pedido}" data-cliente="${p.cliente_nombre}" data-dir="${direccion}" data-tipo="${tipoTransporte}" data-transporte-nombre="${transporte.nombre || ''}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111;border:1px solid #1e1e1e;cursor:${tieneDir ? 'pointer' : 'not-allowed'};border-radius:2px;opacity:${tieneDir ? '1' : '0.4'}">
            <input type="checkbox" style="accent-color:#5aadee" ${tieneDir ? '' : 'disabled'}>
            <div>
              <div style="font-size:13px;color:#ccc;font-weight:500">${p.nota_pedido} — ${p.cliente_nombre}</div>
              <div style="font-size:11px;color:#444;margin-top:2px">${tipoLabel} · ${direccion || '<span style="color:#e05555">Sin dirección</span>'}</div>
            </div>
          </div>`
        }).join('')
        div.querySelectorAll('[data-pk]').forEach(item => {
          if (!item.dataset.dir) return
          item.onclick = () => {
            const id = item.dataset.pk
            const cb = item.querySelector('input[type=checkbox]')
            if (selectedPedidos.find(x => x.id === id)) {
              selectedPedidos = selectedPedidos.filter(x => x.id !== id)
              cb.checked = false
              item.style.borderColor = '#1e1e1e'
            } else {
              selectedPedidos.push({ id, nota: item.dataset.nota, cliente: item.dataset.cliente, dir: item.dataset.dir, tipo: item.dataset.tipo === 'pyb' ? 'pyb' : 'externo', transporteNombre: item.dataset.transporteNombre || null })
              cb.checked = true
              item.style.borderColor = '#5aadee'
            }
          }
        })
      }

      const { data: profiles } = await supabase.from('profiles').select('nombre,rol').eq('activo', true).in('rol', ['jefe','logistica','operario'])
      const sel = el.querySelector('#rec-operario')
      sel.innerHTML = '<option value="">— seleccionar —</option>' + (profiles || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')
      if (['logistica','operario'].includes(currentUser.rol)) sel.value = currentUser.nombre
      modal.classList.add('open')
    }

    let pedidosOrdenados = []

    el.querySelector('#optimizar-btn').onclick = async () => {
      const btn = el.querySelector('#optimizar-btn')
      if (btn.dataset.step === 'confirmar') {
        if (pedidosOrdenados.length === 0) return
        const operario = el.querySelector('#rec-operario').value
        if (!operario) { alert('Asigná un operario'); return }
        btn.innerHTML = 'Creando...'
        btn.disabled = true
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
        const { data: existing } = await supabase.from('recorridos').select('id').like('codigo', `RPT-${today}-%`)
        const num = String((existing?.length || 0) + 1).padStart(3, '0')
        const codigo = `RPT-${today}-${num}`
        const { data: rec, error: recError } = await supabase.from('recorridos').insert({ codigo, operario, estado: 'pendiente' }).select().single()
        if (recError || !rec) { alert('Error: ' + (recError?.message || 'desconocido')); btn.disabled = false; return }
        const pedidosInsert = pedidosOrdenados.map((p, i) => ({ recorrido_id: rec.id, nota_pedido: p.nota, cliente_nombre: p.cliente, direccion: p.dir || null, tipo: p.tipo, transporte_nombre: p.transporteNombre || null, orden: i + 1, estado: 'pendiente' }))
        const { error: pedError } = await supabase.from('recorrido_pedidos').insert(pedidosInsert)
        if (pedError) { alert('Error: ' + pedError.message); btn.disabled = false; return }
        modal.classList.remove('open')
        selectedPedidos = []
        pedidosOrdenados = []
        btn.dataset.step = ''
        await load()
        return
      }

      if (selectedPedidos.length === 0) { alert('Seleccioná al menos un pedido'); return }
      const operario = el.querySelector('#rec-operario').value
      if (!operario) { alert('Asigná un operario'); return }
      btn.innerHTML = '<i class="ti ti-loader"></i> Optimizando ruta...'
      btn.disabled = true
      const pedidosConCoords = await Promise.all(selectedPedidos.map(async p => {
        const coords = await geocodeAddress(p.dir)
        return { ...p, coords: coords || { lat: DEPOSITO.lat + Math.random()*0.01, lng: DEPOSITO.lng + Math.random()*0.01 } }
      }))
      pedidosOrdenados = pedidosConCoords.length > 1 ? await optimizeRoute(pedidosConCoords) : pedidosConCoords
      el.querySelector('#ruta-preview').style.display = 'block'
      el.querySelector('#ruta-steps').innerHTML = `
        <div style="padding:8px 12px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:2px;margin-bottom:4px;font-size:12px;color:#333">🏭 Depósito P&B — Punto de partida</div>
        ${pedidosOrdenados.map((p, i) => `
          <div style="padding:8px 12px;background:#0d1f2d;border:1px solid #1a3a52;border-radius:2px;margin-bottom:4px;display:flex;align-items:center;gap:10px;">
            <div style="width:20px;height:20px;border-radius:50%;background:#0d1f2d;border:1px solid #5aadee;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#5aadee;flex-shrink:0">${i+1}</div>
            <div><div style="font-size:12px;color:#ccc">${p.cliente}</div><div style="font-size:11px;color:#444">${p.dir}</div></div>
          </div>`).join('')}`
      btn.innerHTML = '<i class="ti ti-check"></i> Confirmar recorrido'
      btn.disabled = false
      btn.dataset.step = 'confirmar'
    }
  }

  if (['operario','logistica'].includes(currentUser.rol)) {
    async function updateGPS() {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(async pos => {
        await supabase.from('gps_positions').upsert({
          operario: currentUser.nombre,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updated_at: new Date().toISOString()
        }, { onConflict: 'operario' })
      }, () => {})
    }
    updateGPS()
    setInterval(updateGPS, 30000)
  }

  await load()
}