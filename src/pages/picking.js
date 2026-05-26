export async function renderPicking(el, { supabase, currentUser, isObserver }) {
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Picking</span><span class="page-subtitle" id="picking-count"></span></div>
      ${!isObserver ? '<button class="btn-add" id="btn-new-picking"><i class="ti ti-plus"></i> Nuevo picking</button>' : ''}
    </div>
    <div class="search-bar">
      <input class="search-input" id="pk-search" placeholder="Buscar por cliente, nota o código...">
      <select class="filter-select" id="pk-filter">
        <option value="">Todos los estados</option>
        <option value="preparacion">En preparación</option>
        <option value="armado">Armado</option>
        <option value="habilitado">Habilitado</option>
        <option value="cancelado">Cancelados</option>
      </select>
      <input type="date" class="date-picker-input" id="pk-fecha" placeholder="Fecha">
      <button class="btn-sm" id="pk-limpiar-fecha" style="display:none"><i class="ti ti-x"></i> Hoy</button>
    </div>
    <div id="pk-resumen-dia" style="display:none;margin-bottom:16px;"></div>
    <div id="picking-table-wrap"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-pk1">
      <div class="modal"><div class="modal-top-bar orange"></div>
        <div class="modal-header"><span class="modal-title">Nuevo picking — Apertura</span><button class="modal-close" id="close-pk1"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div class="step-indicator">
            <div class="step active"><div class="step-num">1</div><span>Apertura</span></div>
            <div class="step-divider"></div>
            <div class="step pending"><div class="step-num">2</div><span>Armado</span></div>
            <div class="step-divider"></div>
            <div class="step pending"><div class="step-num">3</div><span>Documentación</span></div>
          </div>
          <div class="form-row-2">
            <div><label class="form-label">NP del sistema <span class="req">*</span></label><input class="form-input" id="s1-nota" placeholder="Ej: 22478"></div>
            <div><label class="form-label">Líneas <span class="req">*</span></label><input class="form-input" id="s1-lineas" type="number" min="1" placeholder="Ej: 12"></div>
          </div>
          <div class="form-row">
            <label class="form-label">Cliente <span class="req">*</span></label>
            <input class="form-input" id="s1-cliente-search" placeholder="Buscar cliente..." autocomplete="off">
            <div id="s1-cliente-dropdown" style="display:none;background:#141414;border:1px solid #222;border-top:none;max-height:200px;overflow-y:auto;border-radius:0 0 2px 2px;"></div>
            <input type="hidden" id="s1-cliente-id">
            <input type="hidden" id="s1-cliente-nombre">
            <div class="form-hint">Buscá un cliente existente o escribí uno nuevo</div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-pk1">Cancelar</button><button class="btn-confirm" id="save-pk1">Registrar — En preparación</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-pk2">
      <div class="modal"><div class="modal-top-bar orange"></div>
        <div class="modal-header"><span class="modal-title" id="pk2-title">Completar armado</span><button class="modal-close" id="close-pk2"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div class="step-indicator">
            <div class="step done"><div class="step-num"><i class="ti ti-check" style="font-size:11px"></i></div><span>Apertura</span></div>
            <div class="step-divider"></div>
            <div class="step active"><div class="step-num">2</div><span>Armado</span></div>
            <div class="step-divider"></div>
            <div class="step pending"><div class="step-num">3</div><span>Documentación</span></div>
          </div>
          <div class="form-row-2">
            <div><label class="form-label">Operario que arma <span class="req">*</span></label><select class="form-select" id="s2-arma"></select></div>
            <div><label class="form-label">Operario que controla <span class="req">*</span></label><select class="form-select" id="s2-controla"></select></div>
          </div>
          <div class="error-msg" id="error-mismo-op">El operario que controla no puede ser el mismo que arma.</div>
          <div class="form-row-2">
            <div><label class="form-label">Hora inicio</label><input class="form-input" id="s2-inicio" type="time"></div>
            <div><label class="form-label">Hora fin</label><input class="form-input" id="s2-fin" type="time"></div>
          </div>
          <div id="tiempo-calculado" style="font-size:12px;color:#5aadee;margin-top:-10px;margin-bottom:10px;display:none">
            <i class="ti ti-clock" style="font-size:11px"></i> Tiempo calculado: <span id="tiempo-label"></span>
          </div>
          <div class="form-row-2">
            <div><label class="form-label">¿Hubo errores?</label>
              <select class="form-select" id="s2-error-yn"><option value="no">No</option><option value="si">Sí</option></select>
            </div>
            <div id="s2-err-count-wrap" style="display:none"><label class="form-label">Cantidad</label><input class="form-input" id="s2-err-count" type="number" min="1" placeholder="Ej: 1"></div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-pk2">Cancelar</button><button class="btn-confirm" id="save-pk2">Guardar — Armado</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-pk3">
      <div class="modal"><div class="modal-top-bar green"></div>
        <div class="modal-header"><span class="modal-title" id="pk3-title">Confirmar documentación</span><button class="modal-close" id="close-pk3"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div class="step-indicator">
            <div class="step done"><div class="step-num"><i class="ti ti-check" style="font-size:11px"></i></div><span>Apertura</span></div>
            <div class="step-divider"></div>
            <div class="step done"><div class="step-num"><i class="ti ti-check" style="font-size:11px"></i></div><span>Armado</span></div>
            <div class="step-divider"></div>
            <div class="step active"><div class="step-num">3</div><span>Documentación</span></div>
          </div>
          <div class="form-row">
            <label class="form-label">Documentación recibida <span class="req">*</span></label>
            <select class="form-select" id="s3-doc">
              <option value="">— seleccionar —</option>
              <option value="fac_remito">Factura y Remito ✅ Habilita despacho</option>
              <option value="fac_etiqueta">Factura y Etiqueta ✅ Habilita despacho</option>
              <option value="remito">Remito solo ⚠️ No habilita despacho</option>
            </select>
          </div>
          <div id="s3-warn" style="display:none;font-size:12px;color:#888;padding:10px 14px;background:#1a1a1a;border:1px solid #222;border-radius:2px;margin-bottom:12px;">
            Con solo Remito el pedido no podrá asignarse a reparto hasta recibir la factura.
          </div>
          <div class="form-row">
            <label class="form-label">Cantidad de bultos <span class="req">*</span></label>
            <input class="form-input" id="s3-bultos" type="number" min="1" placeholder="Ej: 3">
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-pk3">Cancelar</button><button class="btn-confirm" id="save-pk3">Confirmar documentación</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-pk-detalle">
      <div class="modal"><div class="modal-top-bar" style="background:#5aadee"></div>
        <div class="modal-header">
          <span class="modal-title" id="pk-detalle-title">Detalle del picking</span>
          <button class="modal-close" id="close-pk-detalle"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" id="pk-detalle-body"></div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-pk-detalle">Cerrar</button>
          <button class="btn-confirm" style="background:#1a3a1a;color:#52c452;display:none" id="btn-avanzar-paso"><i class="ti ti-arrow-right"></i> <span id="btn-avanzar-label">Completar armado</span></button>
          <button class="btn-confirm" style="background:#e05555;display:none" id="btn-cancelar-picking"><i class="ti ti-ban"></i> Cancelar pedido</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-confirmar-cancel">
      <div class="modal"><div class="modal-top-bar" style="background:#e05555"></div>
        <div class="modal-header">
          <span class="modal-title">¿Cancelar este pedido?</span>
          <button class="modal-close" id="close-confirmar-cancel"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="background:#1f0d0d;border:1px solid #3a1a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#8a3a3a;margin-bottom:20px;">
            Esta acción marca el pedido como <strong>cancelado</strong>. No se puede deshacer desde la app.
          </div>
          <div class="form-row">
            <label class="form-label">Motivo <span class="req">*</span></label>
            <select class="form-select" id="cancel-motivo">
              <option value="">— seleccionar —</option>
              <option value="Pedido duplicado">Pedido duplicado</option>
              <option value="Error de carga">Error de carga</option>
              <option value="Cliente canceló">Cliente canceló</option>
              <option value="Mercadería no disponible">Mercadería no disponible</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Observaciones</label>
            <textarea class="form-textarea" id="cancel-obs" placeholder="Detalle adicional..." style="min-height:60px;resize:none"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-confirmar-cancel">Volver</button>
          <button class="btn-confirm" style="background:#e05555" id="save-cancel-picking"><i class="ti ti-ban"></i> Sí, cancelar pedido</button>
        </div>
      </div>
    </div>`

  let allPicking = []
  let editingId = null
  let cancelingId = null
  let clientes = []
  let profiles = []
  let clienteSeleccionado = null

  const DOC_LABEL = { fac_remito: 'Fac. y Remito', fac_etiqueta: 'Fac. y Etiqueta', remito: 'Remito solo' }
  const ESTADO_HTML = {
    preparacion: '<span class="badge badge-preparacion">En preparación</span>',
    armado: '<span class="badge badge-armado">Armado</span>',
    habilitado: '<span class="badge badge-habilitado">Habilitado ✓</span>',
    cancelado: '<span class="badge" style="background:#2a0a0a;color:#e05555">Cancelado</span>'
  }

  const setupModal = (modalId, closeIds) => {
    const modal = el.querySelector('#' + modalId)
    closeIds.forEach(id => { el.querySelector('#' + id).onclick = () => modal.classList.remove('open') })
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }
    return modal
  }

  const m1 = setupModal('modal-pk1', ['close-pk1','cancel-pk1'])
  const m2 = setupModal('modal-pk2', ['close-pk2','cancel-pk2'])
  const m3 = setupModal('modal-pk3', ['close-pk3','cancel-pk3'])
  const mDetalle = setupModal('modal-pk-detalle', ['close-pk-detalle','cancel-pk-detalle'])
  const mCancel = setupModal('modal-confirmar-cancel', ['close-confirmar-cancel','cancel-confirmar-cancel'])

  el.querySelector('#s2-error-yn').onchange = () => {
    el.querySelector('#s2-err-count-wrap').style.display = el.querySelector('#s2-error-yn').value === 'si' ? 'block' : 'none'
  }
  el.querySelector('#s3-doc').onchange = () => {
    el.querySelector('#s3-warn').style.display = el.querySelector('#s3-doc').value === 'remito' ? 'block' : 'none'
  }

  el.querySelector('#btn-avanzar-paso').onclick = () => {
    const p = allPicking.find(x => x.id === editingId)
    if (!p) return
    mDetalle.classList.remove('open')
    if (p.estado === 'preparacion') openStep2(p)
    else if (p.estado === 'armado') openStep3(p)
  }

  el.querySelector('#btn-cancelar-picking').onclick = () => {
    cancelingId = editingId
    el.querySelector('#cancel-motivo').value = ''
    el.querySelector('#cancel-obs').value = ''
    mDetalle.classList.remove('open')
    mCancel.classList.add('open')
  }

  el.querySelector('#save-cancel-picking').onclick = async () => {
    const motivo = el.querySelector('#cancel-motivo').value
    if (!motivo) { alert('Seleccioná un motivo'); return }
    const obs = el.querySelector('#cancel-obs').value.trim()
    await supabase.from('picking').update({
      estado: 'cancelado',
      observaciones_cancelado: motivo + (obs ? ': ' + obs : '')
    }).eq('id', cancelingId)
    mCancel.classList.remove('open')
    cancelingId = null
    await load()
  }

  const searchInput = el.querySelector('#s1-cliente-search')
  const dropdown = el.querySelector('#s1-cliente-dropdown')

  searchInput.oninput = () => {
    const q = searchInput.value.toLowerCase().trim()
    clienteSeleccionado = null
    el.querySelector('#s1-cliente-id').value = ''
    el.querySelector('#s1-cliente-nombre').value = searchInput.value
    if (q.length < 1) { dropdown.style.display = 'none'; return }
    const filtrados = clientes.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 8)
    if (filtrados.length === 0) {
      dropdown.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:#555">No encontrado — se creará como nuevo cliente</div>`
    } else {
      dropdown.innerHTML = filtrados.map(c => `
        <div data-id="${c.id}" data-nombre="${c.nombre}" style="padding:10px 14px;font-size:13px;color:#ccc;cursor:pointer;border-bottom:1px solid #1e1e1e;">
          ${c.nombre}
          ${c.direccion ? `<div style="font-size:11px;color:#666;margin-top:2px">${c.direccion}</div>` : '<div style="font-size:11px;color:#555;margin-top:2px">Sin dirección</div>'}
        </div>`).join('')
    }
    dropdown.style.display = 'block'
    dropdown.querySelectorAll('[data-id]').forEach(item => {
      item.onmouseenter = () => item.style.background = '#1a1a1a'
      item.onmouseleave = () => item.style.background = 'transparent'
      item.onclick = () => {
        clienteSeleccionado = { id: item.dataset.id, nombre: item.dataset.nombre }
        searchInput.value = item.dataset.nombre
        el.querySelector('#s1-cliente-id').value = item.dataset.id
        el.querySelector('#s1-cliente-nombre').value = item.dataset.nombre
        dropdown.style.display = 'none'
      }
    })
  }

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none'
  })

  function calcularTiempo() {
    const inicio = el.querySelector('#s2-inicio').value
    const fin = el.querySelector('#s2-fin').value
    const div = el.querySelector('#tiempo-calculado')
    const label = el.querySelector('#tiempo-label')
    if (!inicio || !fin) { div.style.display = 'none'; return 0 }
    const [ih, im] = inicio.split(':').map(Number)
    const [fh, fm] = fin.split(':').map(Number)
    let secs = (fh * 3600 + fm * 60) - (ih * 3600 + im * 60)
    if (secs <= 0) { div.style.display = 'none'; return 0 }
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
    label.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    div.style.display = 'block'
    return secs
  }

  el.querySelector('#s2-inicio').oninput = calcularTiempo
  el.querySelector('#s2-fin').oninput = calcularTiempo

  async function generarCodigoInterno() {
    const { data } = await supabase.from('picking').select('id').order('id', { ascending: false }).limit(1)
    const lastId = data?.[0]?.id || 0
    return 'PYB-' + String(lastId + 1).padStart(4, '0')
  }

  async function load() {
    const [{ data: pk }, { data: cl }, { data: pr }] = await Promise.all([
      supabase.from('picking').select('*').order('hora_registro', { ascending: false }),
      supabase.from('clientes').select('id,nombre,direccion').order('nombre'),
      supabase.from('profiles').select('nombre,rol').eq('activo', true)
    ])
    allPicking = pk || []
    clientes = cl || []
    profiles = pr || []
    filter()
  }

  function formatTiempo(secs) {
    if (!secs || secs === 0) return '—'
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  function renderResumenDia(lista) {
    const resumenDiv = el.querySelector('#pk-resumen-dia')
    const fecha = el.querySelector('#pk-fecha').value
    if (!fecha) { resumenDiv.style.display = 'none'; return }
    const activos = lista.filter(p => p.estado !== 'cancelado')
    const totalLineas = activos.reduce((a, p) => a + (p.lineas || 0), 0)
    const totalBultos = activos.reduce((a, p) => a + (p.bultos || 0), 0)
    const habilitados = activos.filter(p => p.estado === 'habilitado').length
    const cancelados = lista.filter(p => p.estado === 'cancelado').length
    resumenDiv.style.display = 'block'
    resumenDiv.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Pedidos</div>
          <div class="stat-value" style="font-size:22px">${activos.length}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Líneas</div>
          <div class="stat-value" style="font-size:22px">${totalLineas}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Bultos</div>
          <div class="stat-value" style="font-size:22px;color:#d4a830">${totalBultos || '—'}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Habilitados</div>
          <div class="stat-value" style="font-size:22px;color:#52c452">${habilitados}</div>
        </div>
        ${cancelados > 0 ? `<div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Cancelados</div>
          <div class="stat-value" style="font-size:22px;color:#e05555">${cancelados}</div>
        </div>` : ''}
      </div>`
  }

  function renderTable(lista) {
    el.querySelector('#picking-count').textContent = lista.length + ' registros'
    const wrap = el.querySelector('#picking-table-wrap')
    if (lista.length === 0) { wrap.innerHTML = '<div class="empty-state">Sin registros</div>'; return }
    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Código</th><th>NP Sistema</th><th>Cliente</th><th>Estado</th><th>Doc.</th><th>Líneas</th><th>Bultos</th><th>Operario</th><th>Tiempo</th><th>Fecha</th><th></th></tr></thead>
      <tbody>${lista.map(p => {
        const tiempo = formatTiempo(p.timer_secs)
        const cancelado = p.estado === 'cancelado'
        return `<tr style="${cancelado ? 'opacity:0.5' : ''}">
          <td style="font-family:'DM Mono',monospace;color:${cancelado ? '#555' : '#5aadee'};font-size:11px;font-weight:600">${p.codigo_interno || '—'}</td>
          <td style="font-family:'DM Mono',monospace;color:#666;font-size:11px">${p.nota_pedido}</td>
          <td style="color:${cancelado ? '#555' : '#ccc'}">${p.cliente_nombre}</td>
          <td>${ESTADO_HTML[p.estado] || p.estado}</td>
          <td>${p.documentacion ? `<span class="badge badge-armado" style="font-size:9px">${DOC_LABEL[p.documentacion]}</span>` : '<span style="color:#444">—</span>'}</td>
          <td style="font-family:'DM Mono',monospace">${p.lineas}</td>
          <td style="font-family:'DM Mono',monospace;color:${p.bultos ? '#d4a830' : '#444'}">${p.bultos || '—'}</td>
          <td style="color:#888;font-size:12px">${p.operario_arma || '<span style="color:#444">—</span>'}</td>
          <td style="font-family:'DM Mono',monospace;color:#d4a830;font-size:12px">${tiempo}</td>
          <td style="font-size:11px;color:#888">${p.fecha || new Date(p.hora_registro).toLocaleDateString('es-AR')}</td>
          <td><button class="btn-sm primary" data-id="${p.id}"><i class="ti ti-eye"></i></button></td>
        </tr>`}).join('')}
      </tbody></table>`
    wrap.querySelectorAll('[data-id]').forEach(btn => {
      btn.onclick = () => openAction(parseInt(btn.dataset.id))
    })
  }

  async function openAction(id) {
    const p = allPicking.find(x => x.id === id)
    if (!p) return
    editingId = id
    mostrarDetallePicking(p)
  }

  async function mostrarDetallePicking(p) {
    const cancelado = p.estado === 'cancelado'
    const puedeCancel = !cancelado && !isObserver

    let yaFinalizado = false
    if (puedeCancel && p.codigo_interno) {
      const [{ data: entregado }, { data: retirado }] = await Promise.all([
        supabase.from('recorrido_pedidos').select('id').eq('estado', 'entregado').eq('codigo_interno', p.codigo_interno).maybeSingle(),
        supabase.from('retiras').select('id').eq('codigo_interno', p.codigo_interno).maybeSingle()
      ])
      if (entregado || retirado) yaFinalizado = true
    }

    el.querySelector('#pk-detalle-title').textContent = (p.codigo_interno || p.nota_pedido) + ' — ' + p.cliente_nombre
    const lpm = p.timer_secs > 0 ? (p.lineas / (p.timer_secs / 60)).toFixed(1) : '—'

    el.querySelector('#pk-detalle-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Código interno</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${p.codigo_interno || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">NP Sistema</div><div style="font-family:'DM Mono',monospace;color:#888">${p.nota_pedido}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Estado</div><div>${ESTADO_HTML[p.estado] || p.estado}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Líneas</div><div style="font-family:'DM Mono',monospace;color:#ccc;font-size:18px">${p.lineas}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:18px">${p.bultos || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Documentación</div><div>${p.documentacion ? `<span class="badge badge-armado" style="font-size:9px">${DOC_LABEL[p.documentacion]}</span>` : '<span style="color:#444">—</span>'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Operario arma</div><div style="color:#ccc">${p.operario_arma || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Operario controla</div><div style="color:#ccc">${p.operario_controla || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora inicio</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.hora_inicio || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora fin</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.hora_fin || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Tiempo total</div><div style="font-family:'DM Mono',monospace;color:#d4a830">${formatTiempo(p.timer_secs)}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Líneas/min</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${lpm}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Errores</div><div style="font-family:'DM Mono',monospace;color:${p.error_count > 0 ? '#ff6b2b' : '#444'}">${p.error_count || 0}</div></div>
      </div>
      ${p.observaciones_cancelado ? `<div style="background:#1f0d0d;border:1px solid #3a1a1a;padding:10px 14px;border-radius:2px;font-size:12px;color:#e05555;margin-bottom:12px"><i class="ti ti-ban" style="font-size:11px"></i> ${p.observaciones_cancelado}</div>` : ''}
      <div style="font-size:11px;color:#555;border-top:1px solid #1e1e1e;padding-top:10px">
        Registrado: ${new Date(p.hora_registro).toLocaleString('es-AR')}
      </div>`

    const btnAvanzar = el.querySelector('#btn-avanzar-paso')
    const btnAvanzarLabel = el.querySelector('#btn-avanzar-label')
    if (!cancelado && !isObserver && (p.estado === 'preparacion' || p.estado === 'armado')) {
      btnAvanzar.style.display = 'block'
      btnAvanzarLabel.textContent = p.estado === 'preparacion' ? 'Completar armado' : 'Confirmar documentación'
    } else {
      btnAvanzar.style.display = 'none'
    }

    const btnCancel = el.querySelector('#btn-cancelar-picking')
    if (puedeCancel && !yaFinalizado) {
      btnCancel.style.display = 'block'
    } else {
      btnCancel.style.display = 'none'
    }

    mDetalle.classList.add('open')
  }

  function openStep2(p) {
    el.querySelector('#pk2-title').textContent = 'Completar armado — ' + (p.codigo_interno || p.nota_pedido)
    const ops = profiles.filter(u => ['jefe','logistica','operario'].includes(u.rol))
    ;['s2-arma','s2-controla'].forEach(id => {
      const sel = el.querySelector('#' + id)
      sel.innerHTML = '<option value="">— seleccionar —</option>' + ops.map(o => `<option value="${o.nombre}">${o.nombre}</option>`).join('')
    })
    el.querySelector('#s2-inicio').value = ''
    el.querySelector('#s2-fin').value = ''
    el.querySelector('#s2-error-yn').value = 'no'
    el.querySelector('#s2-err-count-wrap').style.display = 'none'
    el.querySelector('#error-mismo-op').style.display = 'none'
    el.querySelector('#tiempo-calculado').style.display = 'none'
    m2.classList.add('open')
  }

  function openStep3(p) {
    el.querySelector('#pk3-title').textContent = 'Confirmar doc. — ' + (p.codigo_interno || p.nota_pedido)
    el.querySelector('#s3-doc').value = ''
    el.querySelector('#s3-warn').style.display = 'none'
    el.querySelector('#s3-bultos').value = ''
    m3.classList.add('open')
  }

  if (!isObserver) {
    el.querySelector('#btn-new-picking').onclick = () => {
      el.querySelector('#s1-nota').value = ''
      el.querySelector('#s1-lineas').value = ''
      searchInput.value = ''
      el.querySelector('#s1-cliente-id').value = ''
      el.querySelector('#s1-cliente-nombre').value = ''
      dropdown.style.display = 'none'
      clienteSeleccionado = null
      m1.classList.add('open')
    }
  }

  el.querySelector('#save-pk1').onclick = async () => {
    const nota = el.querySelector('#s1-nota').value.trim()
    const lineas = parseInt(el.querySelector('#s1-lineas').value)
    const clienteNombre = el.querySelector('#s1-cliente-nombre').value.trim() || searchInput.value.trim()
    const clienteIdExistente = el.querySelector('#s1-cliente-id').value
    if (!nota || !clienteNombre || !lineas) { alert('Completá todos los campos'); return }
    let clienteId = clienteIdExistente || null
    if (!clienteId) {
      const { data } = await supabase.from('clientes').insert({ nombre: clienteNombre }).select().single()
      clienteId = data?.id
      clientes.push({ id: clienteId, nombre: clienteNombre, direccion: null })
    }
    const codigoInterno = await generarCodigoInterno()
    await supabase.from('picking').insert({
      nota_pedido: '#' + nota,
      codigo_interno: codigoInterno,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      lineas,
      estado: 'preparacion'
    })
    m1.classList.remove('open')
    await load()
  }

  el.querySelector('#save-pk2').onclick = async () => {
    const arma = el.querySelector('#s2-arma').value
    const controla = el.querySelector('#s2-controla').value
    if (!arma || !controla) { alert('Seleccioná ambos operarios'); return }
    if (arma === controla) { el.querySelector('#error-mismo-op').style.display = 'block'; return }
    const errorYn = el.querySelector('#s2-error-yn').value === 'si'
    const errorCount = errorYn ? parseInt(el.querySelector('#s2-err-count').value) || 0 : 0
    const timerSecs = calcularTiempo()
    await supabase.from('picking').update({
      operario_arma: arma, operario_controla: controla,
      hora_inicio: el.querySelector('#s2-inicio').value || null,
      hora_fin: el.querySelector('#s2-fin').value || null,
      timer_secs: timerSecs, error_yn: errorYn, error_count: errorCount,
      estado: 'armado'
    }).eq('id', editingId)
    m2.classList.remove('open')
    await load()
  }

  el.querySelector('#save-pk3').onclick = async () => {
    const doc = el.querySelector('#s3-doc').value
    const bultos = parseInt(el.querySelector('#s3-bultos').value)
    if (!doc) { alert('Seleccioná el tipo de documentación'); return }
    if (!bultos || bultos < 1) { alert('Ingresá la cantidad de bultos'); return }
    const habilita = doc !== 'remito'
    await supabase.from('picking').update({
      documentacion: doc, bultos, estado: habilita ? 'habilitado' : 'armado'
    }).eq('id', editingId)
    m3.classList.remove('open')
    await load()
  }

  // Filtro de fecha
  el.querySelector('#pk-fecha').onchange = () => {
    const fecha = el.querySelector('#pk-fecha').value
    el.querySelector('#pk-limpiar-fecha').style.display = fecha ? 'flex' : 'none'
    filter()
  }

  el.querySelector('#pk-limpiar-fecha').onclick = () => {
    el.querySelector('#pk-fecha').value = ''
    el.querySelector('#pk-limpiar-fecha').style.display = 'none'
    filter()
  }

  el.querySelector('#pk-search').oninput = filter
  el.querySelector('#pk-filter').onchange = filter

  function filter() {
    const q = el.querySelector('#pk-search').value.toLowerCase()
    const f = el.querySelector('#pk-filter').value
    const fecha = el.querySelector('#pk-fecha').value

    let lista = allPicking.filter(p => {
      const matchQ = p.nota_pedido.toLowerCase().includes(q) || p.cliente_nombre.toLowerCase().includes(q) || (p.codigo_interno || '').toLowerCase().includes(q)
      const matchF = f === '' ? p.estado !== 'cancelado' : p.estado === f
      const matchFecha = !fecha ? true : (p.fecha === fecha || new Date(p.hora_registro).toISOString().split('T')[0] === fecha)
      return matchQ && matchF && matchFecha
    })

    renderResumenDia(lista)
    renderTable(lista)
  }

  await load()
}