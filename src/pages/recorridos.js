const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjIwOTM5ZWM0NzVhYzRmZjA5ZjQ1NWVlODk3OWIyMTk0IiwiaCI6Im11cm11cjY0In0='
const DEPOSITO = { lat: -31.4493549, lng: -64.1171403, nombre: 'Depósito P&B' }
const SUPABASE_URL = 'https://edkwmethipkowetivbbu.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVka3dtZXRoaXBrb3dldGl2YmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDA0MTMsImV4cCI6MjA2MjcxNjQxM30.oVLBlEjPQDMGoJkBuq6VCB6sMvHzEk1j3C2LJ_9b9I8'

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

function generarLinkMaps(pedidos) {
  const origen = `${DEPOSITO.lat},${DEPOSITO.lng}`
  const paradas = pedidos.map(p => encodeURIComponent(p.dir)).join('/')
  return `https://www.google.com/maps/dir/${origen}/${paradas}`
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

async function subirFotoRemito(supabase, file, codigoOref) {
  const ext = file.name.split('.').pop() || 'jpg'
  const nombreArchivo = `${codigoOref}_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('Remitos').upload(nombreArchivo, file)
  if (error) return null
  const { data } = supabase.storage.from('Remitos').getPublicUrl(nombreArchivo)
  return data?.publicUrl || null
}

export async function renderRecorridos(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)
  const isOperario = currentUser.rol === 'operario'

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
      <div style="font-size:11px;color:#444;margin-top:8px;text-align:center">GPS se actualiza cada 30s · El operario debe tener la app abierta</div>
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
            <div id="maps-link-wrap" style="margin-top:12px;display:none;">
              <a id="maps-link" href="#" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0d1f0d;border:1px solid #1a3a1a;border-radius:2px;color:#52c452;font-size:12px;text-decoration:none;">
                <i class="ti ti-map-2" style="font-size:16px"></i>
                <span>Abrir recorrido en Google Maps</span>
                <i class="ti ti-external-link" style="font-size:12px;margin-left:auto;color:#2a5a2a"></i>
              </a>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-new-rec">Cancelar</button>
          <button class="btn-confirm" id="optimizar-btn"><i class="ti ti-route"></i> Optimizar y crear</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-salida-rec">
      <div class="modal"><div class="modal-top-bar orange"></div>
        <div class="modal-header">
          <span class="modal-title" id="salida-rec-title">Confirmar salida</span>
          <button class="modal-close" id="close-salida-rec"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#3a6a3a;margin-bottom:20px;display:flex;gap:10px;">
            <i class="ti ti-info-circle" style="color:#52c452;flex-shrink:0"></i>
            <span>Al confirmar la salida los pedidos pasan a <strong>En reparto</strong>.</span>
          </div>
          <div class="form-row">
            <label class="form-label">Vehículo <span class="req">*</span></label>
            <select class="form-select" id="salida-rec-vehiculo">
              <option value="">— seleccionar —</option>
              <option>Berlingo blanca</option>
              <option>Kangoo blanca</option>
              <option>Sprinter verde</option>
              <option>Saveiro</option>
              <option value="vehiculo-personal">🚗 Vehículo personal</option>
            </select>
          </div>
          <div class="form-row" id="salida-rec-km-wrap">
            <label class="form-label">Km de salida <span class="req">*</span></label>
            <input class="form-input" id="salida-rec-km" type="number" placeholder="Ej: 45820">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-salida-rec">Cancelar</button>
          <button class="btn-confirm" id="save-salida-rec"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-regreso-rec">
      <div class="modal"><div class="modal-top-bar green"></div>
        <div class="modal-header">
          <span class="modal-title">Confirmar regreso</span>
          <button class="modal-close" id="close-regreso-rec"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div id="regreso-rec-resumen" style="background:#111;border:1px solid #1e1e1e;padding:14px 16px;border-radius:2px;margin-bottom:20px;font-size:13px;color:#666;line-height:1.8;"></div>
          <div id="regreso-rec-faltan-fotos" style="display:none;background:#1f0d0d;border:1px solid #3a1a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#e05555;margin-bottom:16px;"></div>
          <div class="form-row" id="regreso-rec-km-wrap">
            <label class="form-label">Km de regreso <span class="req">*</span></label>
            <input class="form-input" id="regreso-rec-km" type="number" placeholder="Ej: 45951">
          </div>
          <div id="regreso-rec-km-diff" style="font-size:12px;margin-top:8px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-regreso-rec">Cancelar</button>
          <button class="btn-confirm" id="save-regreso-rec"><i class="ti ti-home"></i> Confirmar regreso</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-no-entregado-rec">
      <div class="modal"><div class="modal-top-bar" style="background:#e05555"></div>
        <div class="modal-header">
          <span class="modal-title">No se pudo entregar</span>
          <button class="modal-close" id="close-no-entregado-rec"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="background:#1f0d0d;border:1px solid #3a1a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#8a3a3a;margin-bottom:20px;">
            El pedido volverá a estado <strong>habilitado</strong> y quedará disponible para un nuevo recorrido.
          </div>
          <div class="form-row">
            <label class="form-label">Motivo <span class="req">*</span></label>
            <select class="form-select" id="no-entregado-rec-motivo">
              <option value="">— seleccionar —</option>
              <option value="Cliente ausente">Cliente ausente</option>
              <option value="Local cerrado">Local cerrado</option>
              <option value="Rechazó el pedido">Rechazó el pedido</option>
              <option value="Dirección incorrecta">Dirección incorrecta</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Observaciones</label>
            <textarea class="form-textarea" id="no-entregado-rec-obs" placeholder="Detalle adicional..." style="min-height:60px;resize:none"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-no-entregado-rec">Cancelar</button>
          <button class="btn-confirm" style="background:#e05555" id="save-no-entregado-rec"><i class="ti ti-arrow-back"></i> Registrar y devolver</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-ficha-cliente">
      <div class="modal"><div class="modal-top-bar" style="background:#a78bfa"></div>
        <div class="modal-header">
          <span class="modal-title" id="ficha-cliente-title">Ficha del cliente</span>
          <button class="modal-close" id="close-ficha-cliente"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" id="ficha-cliente-body"></div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-ficha-cliente">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-fotos-remito">
      <div class="modal"><div class="modal-top-bar" style="background:#5aadee"></div>
        <div class="modal-header">
          <span class="modal-title" id="fotos-remito-title">Fotos del remito</span>
          <button class="modal-close" id="close-fotos-remito"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <input type="file" accept="image/*" capture="environment" id="fotos-remito-input" style="display:none">
          <button class="btn-confirm" style="width:100%;margin-bottom:14px" id="fotos-remito-tomar"><i class="ti ti-camera"></i> Tomar / subir foto</button>
          <div id="fotos-remito-lista" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-confirm" id="cerrar-fotos-remito">Listo</button>
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
  let activeRecorridoId = null
  let activePedidoId = null
  let currentRecorridos = []
  let pedidoFotosActivo = null

  const modal = el.querySelector('#modal-new-rec')
  el.querySelector('#close-new-rec').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-new-rec').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  const modalSalida = el.querySelector('#modal-salida-rec')
  ;['close-salida-rec','cancel-salida-rec'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalSalida.classList.remove('open')
  })
  modalSalida.onclick = (e) => { if (e.target === modalSalida) modalSalida.classList.remove('open') }

  const modalRegreso = el.querySelector('#modal-regreso-rec')
  ;['close-regreso-rec','cancel-regreso-rec'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalRegreso.classList.remove('open')
  })
  modalRegreso.onclick = (e) => { if (e.target === modalRegreso) modalRegreso.classList.remove('open') }

  const modalNoEntregado = el.querySelector('#modal-no-entregado-rec')
  ;['close-no-entregado-rec','cancel-no-entregado-rec'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalNoEntregado.classList.remove('open')
  })
  modalNoEntregado.onclick = (e) => { if (e.target === modalNoEntregado) modalNoEntregado.classList.remove('open') }

  const modalFicha = el.querySelector('#modal-ficha-cliente')
  el.querySelector('#close-ficha-cliente').onclick = () => modalFicha.classList.remove('open')
  el.querySelector('#cancel-ficha-cliente').onclick = () => modalFicha.classList.remove('open')
  modalFicha.onclick = (e) => { if (e.target === modalFicha) modalFicha.classList.remove('open') }

  const modalFotos = el.querySelector('#modal-fotos-remito')
  el.querySelector('#close-fotos-remito').onclick = () => { modalFotos.classList.remove('open'); load() }
  el.querySelector('#cerrar-fotos-remito').onclick = () => { modalFotos.classList.remove('open'); load() }
  modalFotos.onclick = (e) => { if (e.target === modalFotos) { modalFotos.classList.remove('open'); load() } }

  el.querySelector('#salida-rec-vehiculo').onchange = () => {
    const esPersonal = el.querySelector('#salida-rec-vehiculo').value === 'vehiculo-personal'
    el.querySelector('#salida-rec-km-wrap').style.display = esPersonal ? 'none' : 'block'
  }

  el.querySelector('#regreso-rec-km').oninput = () => {
    const km = parseInt(el.querySelector('#regreso-rec-km').value)
    const r = currentRecorridos.find(x => x.id === activeRecorridoId)
    const preview = el.querySelector('#regreso-rec-km-diff')
    if (r && km && r.km_salida) {
      const diff = km - r.km_salida
      preview.innerHTML = diff > 0
        ? `<span style="color:#52c452">Km recorridos: ${diff} km</span>`
        : `<span style="color:#e05555">El km de regreso debe ser mayor al de salida</span>`
    }
  }

  el.querySelector('#save-salida-rec').onclick = async () => {
    const vehiculo = el.querySelector('#salida-rec-vehiculo').value
    if (!vehiculo) { alert('Seleccioná un vehículo'); return }
    const esPersonal = vehiculo === 'vehiculo-personal'
    const km = esPersonal ? null : parseInt(el.querySelector('#salida-rec-km').value)
    if (!esPersonal && !km) { alert('Ingresá el km de salida'); return }
    const hora = new Date().toTimeString().slice(0,5)
    const vehiculoLabel = esPersonal ? 'Vehículo personal' : vehiculo
    const { error } = await supabase.from('recorridos').update({
      estado: 'en-ruta', hora_salida: hora, vehiculo: vehiculoLabel, km_salida: km
    }).eq('id', activeRecorridoId)
    if (error) { alert('Error: ' + error.message); return }
    if (!esPersonal) await supabase.from('vehiculos').update({ en_uso: true }).eq('nombre', vehiculo)
    modalSalida.classList.remove('open')
    await load()
  }

  function pedidosSinFoto(r) {
    return r.recorrido_pedidos.filter(p => p.estado === 'entregado' && !p.foto_remito)
  }

  el.querySelector('#save-regreso-rec').onclick = async () => {
    const r = currentRecorridos.find(x => x.id === activeRecorridoId)
    const faltantes = pedidosSinFoto(r)
    if (faltantes.length > 0) {
      const wrap = el.querySelector('#regreso-rec-faltan-fotos')
      wrap.style.display = 'block'
      wrap.innerHTML = `<i class="ti ti-camera-off" style="font-size:13px"></i> Faltan fotos del remito en: ${faltantes.map(p => p.cliente_nombre).join(', ')}. Cargalas antes de cerrar el recorrido.`
      return
    }
    const esPersonal = r?.vehiculo === 'Vehículo personal'
    const km = esPersonal ? null : parseInt(el.querySelector('#regreso-rec-km').value)
    if (!esPersonal && (!km || km <= r.km_salida)) { alert('Ingresá un km de regreso válido'); return }
    const { error } = await supabase.from('recorridos').update({ estado: 'completado', km_regreso: km }).eq('id', activeRecorridoId)
    if (error) { alert('Error: ' + error.message); return }
    if (!esPersonal && r.vehiculo) await supabase.from('vehiculos').update({ en_uso: false, km_actual: km }).eq('nombre', r.vehiculo)
    const rechazados = r.recorrido_pedidos.filter(p => p.estado === 'pendiente' && p.observaciones)
    for (const p of rechazados) {
      if (p.codigo_interno) {
        await supabase.from('picking').update({ estado: 'habilitado' }).eq('codigo_interno', p.codigo_interno)
      } else {
        await supabase.from('picking').update({ estado: 'habilitado' }).eq('nota_pedido', p.nota_pedido)
      }
    }
    modalRegreso.classList.remove('open')
    await load()
  }

  el.querySelector('#save-no-entregado-rec').onclick = async () => {
    const motivo = el.querySelector('#no-entregado-rec-motivo').value
    if (!motivo) { alert('Seleccioná un motivo'); return }
    const obs = el.querySelector('#no-entregado-rec-obs').value.trim()
    await supabase.from('recorrido_pedidos').update({
      estado: 'pendiente',
      observaciones: motivo + (obs ? ': ' + obs : '')
    }).eq('id', activePedidoId)
    modalNoEntregado.classList.remove('open')
    await load()
  }

  async function mostrarFichaCliente(clienteNombre, clienteId) {
    el.querySelector('#ficha-cliente-title').textContent = clienteNombre
    el.querySelector('#ficha-cliente-body').innerHTML = '<div class="loading">Cargando...</div>'
    modalFicha.classList.add('open')

    let cliente = null
    if (clienteId) {
      const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
      cliente = data
    } else {
      const { data } = await supabase.from('clientes').select('*').ilike('nombre', clienteNombre).limit(1).single()
      cliente = data
    }

    if (!cliente) {
      el.querySelector('#ficha-cliente-body').innerHTML = '<div class="empty-state">Sin datos del cliente</div>'
      return
    }

    el.querySelector('#ficha-cliente-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="grid-column:span 2"><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Cliente</div><div style="color:#ccc;font-weight:600;font-size:15px">${cliente.nombre}</div></div>
        ${cliente.direccion ? `<div style="grid-column:span 2"><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Dirección</div><div style="color:#aaa">${cliente.direccion}</div></div>` : ''}
        ${cliente.horario ? `<div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Horario</div><div style="color:#52c452;font-size:13px">${cliente.horario}</div></div>` : ''}
        ${cliente.telefono ? `<div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Teléfono</div><div style="color:#5aadee;font-size:13px">${cliente.telefono}</div></div>` : ''}
        ${cliente.cuit ? `<div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">CUIT</div><div style="font-family:'DM Mono',monospace;color:#888">${cliente.cuit}</div></div>` : ''}
        ${cliente.nro_manager ? `<div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Nº Manager</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${cliente.nro_manager}</div></div>` : ''}
      </div>
      ${cliente.aclaraciones ? `
        <div style="background:#1a1500;border:1px solid #2a2000;padding:14px 16px;border-radius:2px;">
          <div style="font-size:9px;letter-spacing:2px;color:#d4a830;text-transform:uppercase;margin-bottom:8px;font-weight:500"><i class="ti ti-alert-circle" style="font-size:11px"></i> Aclaraciones de entrega</div>
          <div style="font-size:13px;color:#d4a830;line-height:1.6">${cliente.aclaraciones}</div>
        </div>` : `
        <div style="font-size:12px;color:#444;text-align:center;padding:16px">Sin aclaraciones de entrega</div>`}`
  }

  async function abrirFotosRemito(pedidoId) {
    pedidoFotosActivo = pedidoId
    const { data: p } = await supabase.from('recorrido_pedidos').select('*').eq('id', pedidoId).single()
    el.querySelector('#fotos-remito-title').textContent = 'Fotos del remito — ' + (p?.cliente_nombre || '')
    renderListaFotos(p)
    modalFotos.classList.add('open')
  }

  function renderListaFotos(p) {
    const urls = (p?.foto_remito || '').split(',').filter(Boolean)
    const lista = el.querySelector('#fotos-remito-lista')
    if (urls.length === 0) {
      lista.innerHTML = '<div style="color:#444;font-size:12px;text-align:center;padding:10px">Sin fotos cargadas todavía</div>'
      return
    }
    lista.innerHTML = urls.map((url, i) => `
      <div style="display:flex;align-items:center;gap:10px;background:#111;border:1px solid #1e1e1e;padding:8px 10px;border-radius:2px;">
        <img src="${url}" style="width:48px;height:48px;object-fit:cover;border-radius:2px;border:1px solid #222;">
        <span style="flex:1;font-size:12px;color:#888">Foto ${i + 1}</span>
        <a href="${url}" download target="_blank" class="btn-sm primary"><i class="ti ti-download"></i></a>
      </div>`).join('')
  }

  el.querySelector('#fotos-remito-tomar').onclick = () => el.querySelector('#fotos-remito-input').click()
  el.querySelector('#fotos-remito-input').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file || !pedidoFotosActivo) return
    const { data: p } = await supabase.from('recorrido_pedidos').select('*').eq('id', pedidoFotosActivo).single()
    const codigoRef = p?.codigo_interno || p?.nota_pedido || pedidoFotosActivo
    const url = await subirFotoRemito(supabase, file, codigoRef)
    if (!url) { alert('No se pudo subir la foto. Revisá tu conexión.'); return }
    const urlsActuales = (p?.foto_remito || '').split(',').filter(Boolean)
    urlsActuales.push(url)
    await supabase.from('recorrido_pedidos').update({ foto_remito: urlsActuales.join(',') }).eq('id', pedidoFotosActivo)
    const { data: pActualizado } = await supabase.from('recorrido_pedidos').select('*').eq('id', pedidoFotosActivo).single()
    renderListaFotos(pActualizado)
    e.target.value = ''
  }

  el.querySelector('#rec-list').addEventListener('click', async (e) => {
    const btnFicha = e.target.closest('button[data-ficha-cliente]')
    if (btnFicha) {
      await mostrarFichaCliente(btnFicha.dataset.fichaCliente, btnFicha.dataset.clienteId || null)
      return
    }

    const btnFoto = e.target.closest('button[data-fotos-pedido]')
    if (btnFoto) {
      await abrirFotosRemito(parseInt(btnFoto.dataset.fotosPedido))
      return
    }

    const btn = e.target.closest('button[data-salida], button[data-regreso], button[data-entregar], button[data-no-entregar]')
    if (!btn) return

    if (btn.dataset.salida) {
      activeRecorridoId = parseInt(btn.dataset.salida)
      const r = currentRecorridos.find(x => x.id === activeRecorridoId)
      if (!r) return
      el.querySelector('#salida-rec-title').textContent = 'Confirmar salida — ' + r.codigo
      el.querySelector('#salida-rec-vehiculo').value = ''
      el.querySelector('#salida-rec-km').value = ''
      el.querySelector('#salida-rec-km-wrap').style.display = 'block'
      modalSalida.classList.add('open')
      return
    }

    if (btn.dataset.regreso) {
      activeRecorridoId = parseInt(btn.dataset.regreso)
      const r = currentRecorridos.find(x => x.id === activeRecorridoId)
      if (!r) return
      const esPersonal = r.vehiculo === 'Vehículo personal'
      const rechazados = r.recorrido_pedidos.filter(p => p.estado === 'pendiente' && p.observaciones).length
      el.querySelector('#regreso-rec-resumen').innerHTML = `
        <strong style="color:#ccc">${r.codigo}</strong><br>
        Operario: ${r.operario} · Vehículo: ${r.vehiculo || '—'}<br>
        Salida: ${r.hora_salida || '—'} · Km salida: ${r.km_salida || '—'}
        ${rechazados > 0 ? `<br><span style="color:#e05555;font-size:12px"><i class="ti ti-alert-circle"></i> ${rechazados} pedido${rechazados > 1 ? 's' : ''} no entregado${rechazados > 1 ? 's' : ''} — volverán a entregas pendientes</span>` : ''}`
      el.querySelector('#regreso-rec-faltan-fotos').style.display = 'none'
      el.querySelector('#regreso-rec-km').value = ''
      el.querySelector('#regreso-rec-km-diff').innerHTML = ''
      el.querySelector('#regreso-rec-km-wrap').style.display = esPersonal ? 'none' : 'block'
      modalRegreso.classList.add('open')
      return
    }

    if (btn.dataset.entregar) {
      const hora = new Date().toTimeString().slice(0,5)
      const { error } = await supabase.from('recorrido_pedidos').update({
        estado: 'entregado', hora_entrega: hora
      }).eq('id', parseInt(btn.dataset.entregar))
      if (error) { alert('Error: ' + error.message); return }
      await load()
      return
    }

    if (btn.dataset.noEntregar) {
      activePedidoId = parseInt(btn.dataset.noEntregar)
      el.querySelector('#no-entregado-rec-motivo').value = ''
      el.querySelector('#no-entregado-rec-obs').value = ''
      modalNoEntregado.classList.add('open')
      return
    }
  })

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    let query = supabase.from('recorridos').select(`*, recorrido_pedidos(*)`).or(`fecha.eq.${today},estado.eq.en-ruta`).order('created_at', { ascending: false })
    if (isOperario) query = query.eq('operario', currentUser.nombre)
    const { data } = await query
    currentRecorridos = data || []
    el.querySelector('#rec-sub').textContent = currentRecorridos.length + ' recorridos'
    const list = el.querySelector('#rec-list')
    if (currentRecorridos.length === 0) { list.innerHTML = '<div class="empty-state">Sin recorridos</div>'; return }

    const codigosInternos = [...new Set(currentRecorridos.flatMap(r => r.recorrido_pedidos.map(p => p.codigo_interno).filter(Boolean)))]
    let pickingClienteMap = {}
    if (codigosInternos.length > 0) {
      const { data: pks } = await supabase.from('picking').select('codigo_interno, cliente_id').in('codigo_interno', codigosInternos)
      ;(pks || []).forEach(p => { if (p.codigo_interno) pickingClienteMap[p.codigo_interno] = p.cliente_id })
    }

    list.innerHTML = currentRecorridos.map(r => {
      const ent = r.recorrido_pedidos.filter(p => p.estado === 'entregado').length
      const tot = r.recorrido_pedidos.length
      const rechazados = r.recorrido_pedidos.filter(p => p.estado === 'pendiente' && p.observaciones).length
      const listoParaRegresar = r.estado === 'en-ruta' && (ent + rechazados === tot) && tot > 0
      const estBadge = r.estado === 'en-ruta' ? '<span class="badge badge-en-ruta">En ruta</span>' : r.estado === 'completado' ? '<span class="badge badge-completado">Completado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'
      const pedidosConDir = r.recorrido_pedidos.filter(p => p.direccion)
      const mapsUrl = pedidosConDir.length > 0 ? generarLinkMaps(pedidosConDir.map(p => ({ dir: p.direccion }))) : null
      const puedeOperar = !isObserver && (canEdit || (isOperario && r.operario === currentUser.nombre))

      return `<div style="background:#111;border:1px solid #1e1e1e;padding:16px 18px;margin-bottom:16px;border-radius:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:#fff;margin-bottom:4px">${r.codigo}</div>
            <div style="font-size:12px;color:#555">${estBadge} · Operario: <strong style="color:#888">${r.operario}</strong> · ${ent}/${tot} entregas${rechazados > 0 ? ` · <span style="color:#e05555">${rechazados} rechazado${rechazados > 1 ? 's' : ''}</span>` : ''}${r.vehiculo ? ' · ' + r.vehiculo : ''}</div>
            <div style="font-size:11px;color:#444;margin-top:3px">Km salida: <span style="font-family:'DM Mono',monospace">${r.km_salida || '—'}</span> · Km regreso: <span style="font-family:'DM Mono',monospace">${r.km_regreso || '—'}</span>${r.km_salida && r.km_regreso ? ' · <span style="color:#52c452;font-family:\'DM Mono\',monospace">' + (r.km_regreso - r.km_salida) + ' km</span>' : ''}${r.hora_salida ? ' · Salida: ' + r.hora_salida : ''}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" style="display:flex;align-items:center;gap:4px;padding:6px 10px;background:#0d1f0d;border:1px solid #1a3a1a;border-radius:2px;color:#52c452;font-size:11px;text-decoration:none;white-space:nowrap"><i class="ti ti-map-2"></i> Maps</a>` : ''}
            ${puedeOperar && r.estado === 'pendiente' ? `<button class="btn-sm orange" data-salida="${r.id}"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>` : ''}
            ${puedeOperar && listoParaRegresar ? `<button class="btn-sm green" data-regreso="${r.id}"><i class="ti ti-home"></i> Confirmar regreso</button>` : ''}
          </div>
        </div>
        ${r.estado === 'pendiente' && puedeOperar ? `
          <div style="background:#1a1500;border:1px solid #2a2000;padding:10px 14px;border-radius:2px;font-size:12px;color:#d4a830;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
            <i class="ti ti-alert-triangle" style="font-size:14px"></i>
            <span>Confirmá la salida antes de registrar entregas</span>
          </div>` : ''}
        ${tot === 0 ? '<div style="color:#444;font-size:12px;padding:8px 0">Sin pedidos en este recorrido</div>' :
        r.recorrido_pedidos.map(p => {
          const clienteId = pickingClienteMap[p.codigo_interno] || null
          const cantFotos = (p.foto_remito || '').split(',').filter(Boolean).length
          return `
          <div class="pedido-card ${p.estado === 'entregado' ? 'entregado' : p.observaciones ? 'rechazado' : ''}">
            <div class="pedido-card-header">
              <div class="pedido-orden ${p.tipo || 'pyb'}">${p.orden}</div>
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap">
                  <div style="font-size:13px;font-weight:600;color:#fff">${p.cliente_nombre}</div>
                  <button class="btn-sm" style="border-color:#2d1a52;color:#a78bfa;padding:3px 8px;font-size:10px" data-ficha-cliente="${p.cliente_nombre}" data-cliente-id="${clienteId || ''}"><i class="ti ti-info-circle" style="font-size:11px"></i> Ficha</button>
                  ${p.estado === 'entregado' && puedeOperar ? `<button class="btn-sm" style="border-color:${cantFotos > 0 ? '#1a3a1a' : '#3a2a0a'};color:${cantFotos > 0 ? '#52c452' : '#d4a830'};padding:3px 8px;font-size:10px" data-fotos-pedido="${p.id}"><i class="ti ti-camera" style="font-size:11px"></i> ${cantFotos > 0 ? cantFotos + ' foto' + (cantFotos > 1 ? 's' : '') : 'Foto remito'}</button>` : ''}
                  ${p.estado === 'entregado' && !puedeOperar && cantFotos > 0 ? `<button class="btn-sm" style="border-color:#1a3a1a;color:#52c452;padding:3px 8px;font-size:10px" data-fotos-pedido="${p.id}"><i class="ti ti-camera" style="font-size:11px"></i> ${cantFotos} foto${cantFotos > 1 ? 's' : ''}</button>` : ''}
                </div>
                <div style="font-size:11px;color:#555">
                  ${p.codigo_interno ? `<span style="font-family:'DM Mono',monospace;color:#5aadee;font-size:10px">${p.codigo_interno}</span> · ` : ''}
                  <i class="ti ti-map-pin" style="font-size:10px"></i> ${p.direccion || '—'} · ${p.nota_pedido}${p.tipo === 'externo' ? ' · ' + (p.transporte_nombre || '') : ''}
                </div>
                ${p.observaciones ? `<div style="font-size:11px;color:#e05555;margin-top:3px"><i class="ti ti-alert-circle" style="font-size:10px"></i> ${p.observaciones}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                ${puedeOperar && p.estado === 'pendiente' && !p.observaciones && r.estado === 'en-ruta' ? `
                  <button class="btn-sm green" data-entregar="${p.id}"><i class="ti ti-check"></i> Entregado</button>
                  <button class="btn-sm" style="border-color:#3a1a1a;color:#e05555" data-no-entregar="${p.id}"><i class="ti ti-x"></i> No entregado</button>
                ` : puedeOperar && p.estado === 'pendiente' && !p.observaciones && r.estado === 'pendiente' ? `
                  <span style="font-size:10px;color:#d4a830;text-align:right;line-height:1.6">⚠️ Confirmá<br>la salida<br>primero</span>
                ` : p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>`
                  : p.observaciones ? `<span class="badge" style="background:#2a0a0a;color:#e05555;font-size:9px">✗ Rechazado</span>` : ''}
              </div>
            </div>
            ${p.estado === 'entregado' ? `<div class="pedido-entregado-info"><span style="color:#52c452;font-family:'DM Mono',monospace;font-size:11px"><i class="ti ti-clock" style="font-size:10px"></i> Entregado ${p.hora_entrega || ''}</span></div>` : ''}
          </div>`
        }).join('')}
      </div>`
    }).join('')
  }

  async function initMap() {
    const mapContainer = el.querySelector('#map-container')
    if (!mapContainer) return
    await loadLeaflet()
    if (mapInstance) { mapInstance.remove(); mapInstance = null }
    mapInstance = L.map(mapContainer).setView([DEPOSITO.lat, DEPOSITO.lng], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance)
    const depositoIcon = L.divIcon({
      html: `<div style="background:#fff;border:2px solid #555;width:14px;height:14px;border-radius:2px;"></div>`,
      iconSize: [14,14], iconAnchor: [7,7], className: ''
    })
    L.marker([DEPOSITO.lat, DEPOSITO.lng], { icon: depositoIcon }).addTo(mapInstance).bindPopup('<strong>Depósito P&B</strong>')
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
      legend.innerHTML = '<div style="font-size:12px;color:#444;text-align:center;padding:12px">No hay vehículos en ruta ahora</div>'
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
        const marker = L.marker([pos.lat, pos.lng], { icon }).addTo(mapInstance).bindPopup(`<strong>${r.operario}</strong><br>${r.codigo}<br>GPS: ${lastUpdate}`)
        mapMarkers.push(marker)
      }
      legend.innerHTML += `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#141414;border:1px solid #222;border-radius:2px;">
          <div style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;${pos ? 'box-shadow:0 0 6px ' + color + '88' : 'opacity:.4'}"></div>
          <div style="flex:1">
            <div style="font-size:13px;color:#ccc;font-weight:500">${r.operario} · ${r.vehiculo || '—'}</div>
            <div style="font-size:11px;color:#666;margin-top:2px">${r.codigo}${lastUpdate ? ' · GPS: ' + lastUpdate : ' · <span style="color:#555">Sin señal GPS</span>'}</div>
          </div>
        </div>`
    })
  }

  if (canEdit) {
    el.querySelector('#btn-new-rec').onclick = async () => {
      selectedPedidos = []
      el.querySelector('#ruta-preview').style.display = 'none'
      el.querySelector('#maps-link-wrap').style.display = 'none'
      const optimizarBtn = el.querySelector('#optimizar-btn')
      optimizarBtn.innerHTML = '<i class="ti ti-route"></i> Optimizar y crear'
      optimizarBtn.disabled = false
      optimizarBtn.dataset.step = ''

      const { data: recorridosActivos } = await supabase.from('recorridos').select('id').neq('estado', 'completado')
      const idsActivos = (recorridosActivos || []).map(r => r.id)
      const { data: enRutaActiva } = idsActivos.length > 0
        ? await supabase.from('recorrido_pedidos').select('codigo_interno, nota_pedido').in('recorrido_id', idsActivos)
        : { data: [] }
      const codigosEnRutaActiva = new Set((enRutaActiva || []).map(p => p.codigo_interno).filter(Boolean))
      const notasEnRutaActiva = new Set((enRutaActiva || []).map(p => p.nota_pedido).filter(Boolean))

      const { data: yaEntregados } = await supabase.from('recorrido_pedidos').select('codigo_interno, nota_pedido').eq('estado', 'entregado')
      const codigosYaEntregados = new Set((yaEntregados || []).map(p => p.codigo_interno).filter(Boolean))
      const notasYaEntregadas = new Set((yaEntregados || []).map(p => p.nota_pedido).filter(Boolean))

      const { data: pk } = await supabase.from('picking').select('id, nota_pedido, cliente_nombre, cliente_id, codigo_interno').eq('estado', 'habilitado')
      const disponiblesPk = (pk || []).filter(p => {
        if (p.codigo_interno) return !codigosEnRutaActiva.has(p.codigo_interno) && !codigosYaEntregados.has(p.codigo_interno)
        return !notasEnRutaActiva.has(p.nota_pedido) && !notasYaEntregadas.has(p.nota_pedido)
      })

      if (disponiblesPk.length === 0) {
        el.querySelector('#pedidos-disponibles').innerHTML = '<div style="color:#444;font-size:12px;padding:10px">Sin pedidos habilitados disponibles</div>'
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
          const label = p.codigo_interno ? `${p.codigo_interno} — ${p.nota_pedido}` : p.nota_pedido
          return `<div data-pk="${p.id}" data-nota="${p.nota_pedido}" data-codigo="${p.codigo_interno || ''}" data-cliente="${p.cliente_nombre}" data-dir="${direccion}" data-tipo="${tipoTransporte}" data-transporte-nombre="${transporte.nombre || ''}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111;border:1px solid #1e1e1e;cursor:${tieneDir ? 'pointer' : 'not-allowed'};border-radius:2px;opacity:${tieneDir ? '1' : '0.4'}">
            <input type="checkbox" style="accent-color:#5aadee" ${tieneDir ? '' : 'disabled'}>
            <div>
              <div style="font-size:13px;color:#ccc;font-weight:500">${label} — ${p.cliente_nombre}</div>
              <div style="font-size:11px;color:#666;margin-top:2px">${tipoLabel} · ${direccion || '<span style="color:#e05555">Sin dirección</span>'}</div>
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
              selectedPedidos.push({ id, nota: item.dataset.nota, codigo: item.dataset.codigo || null, cliente: item.dataset.cliente, dir: item.dataset.dir, tipo: item.dataset.tipo === 'pyb' ? 'pyb' : 'externo', transporteNombre: item.dataset.transporteNombre || null })
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
        const pedidosInsert = pedidosOrdenados.map((p, i) => ({ recorrido_id: rec.id, nota_pedido: p.nota, codigo_interno: p.codigo || null, cliente_nombre: p.cliente, direccion: p.dir || null, tipo: p.tipo, transporte_nombre: p.transporteNombre || null, orden: i + 1, estado: 'pendiente' }))
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

      const mapsLink = generarLinkMaps(pedidosOrdenados)
      el.querySelector('#maps-link').href = mapsLink
      el.querySelector('#maps-link-wrap').style.display = 'block'

      el.querySelector('#ruta-preview').style.display = 'block'
      el.querySelector('#ruta-steps').innerHTML = `
        <div style="padding:8px 12px;background:#0a0a0a;border:1px solid #1a1a1a;border-radius:2px;margin-bottom:4px;font-size:12px;color:#444">🏭 Depósito P&B — Punto de partida</div>
        ${pedidosOrdenados.map((p, i) => `
          <div style="padding:8px 12px;background:#0d1f2d;border:1px solid #1a3a52;border-radius:2px;margin-bottom:4px;display:flex;align-items:center;gap:10px;">
            <div style="width:20px;height:20px;border-radius:50%;background:#0d1f2d;border:1px solid #5aadee;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#5aadee;flex-shrink:0">${i+1}</div>
            <div>
              ${p.codigo ? `<div style="font-size:10px;font-family:'DM Mono',monospace;color:#5aadee;margin-bottom:2px">${p.codigo}</div>` : ''}
              <div style="font-size:12px;color:#ccc">${p.cliente}</div>
              <div style="font-size:11px;color:#666">${p.dir}</div>
            </div>
          </div>`).join('')}`
      btn.innerHTML = '<i class="ti ti-check"></i> Confirmar recorrido'
      btn.disabled = false
      btn.dataset.step = 'confirmar'
    }
  }

  if (['operario','logistica'].includes(currentUser.rol)) {
    const startGPS = async () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'START_GPS',
          data: { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY, operario: currentUser.nombre }
        })
      } else {
        if (!navigator.geolocation) return
        const updateGPS = async () => {
          navigator.geolocation.getCurrentPosition(async pos => {
            await supabase.from('gps_positions').upsert({
              operario: currentUser.nombre, lat: pos.coords.latitude, lng: pos.coords.longitude, updated_at: new Date().toISOString()
            }, { onConflict: 'operario' })
          }, () => {})
        }
        updateGPS()
        setInterval(updateGPS, 30000)
      }
    }
    if (navigator.serviceWorker.controller) { startGPS() } else { navigator.serviceWorker.ready.then(startGPS) }
  }

  await load()
}