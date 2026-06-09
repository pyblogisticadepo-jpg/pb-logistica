// VEHICULOS
export async function renderVehiculos(el, { supabase, currentUser, isObserver }) {
  const canManageFlota = currentUser.rol === 'jefe'
  const canUsar = ['jefe','logistica','operario','vendedor'].includes(currentUser.rol)
  el.innerHTML = `
    <div class="page-header"><div class="page-title-group"><span class="page-title">Vehículos</span></div></div>
    ${isObserver ? '<div class="observer-badge"><i class="ti ti-eye"></i> Modo observador — solo lectura</div>' : ''}
    <div class="tabs">
      <button class="tab-btn active" data-tab="flota">Flota</button>
      ${canUsar ? '<button class="tab-btn" data-tab="uso">Registrar uso</button>' : ''}
      <button class="tab-btn" data-tab="historial">Historial</button>
    </div>
    <div class="tab-content active" id="tab-flota"></div>
    ${canUsar ? `<div class="tab-content" id="tab-uso">
      <div id="uso-pendiente-wrap"></div>
      <div style="background:#111;border:1px solid #1e1e1e;padding:20px;border-radius:2px;max-width:420px;" id="uso-form-wrap">
        <div class="section-label" style="margin-top:0">Registrar salida</div>
        <div class="form-row"><label class="form-label">Vehículo <span class="req">*</span></label>
          <select class="form-select" id="uso-veh"></select>
        </div>
        <div class="form-row">
          <label class="form-label">Km salida <span class="req">*</span></label>
          <input class="form-input" id="uso-km-sal" type="number" placeholder="Ej: 45820">
        </div>
        <div class="form-row"><label class="form-label">Motivo</label>
          <select class="form-select" id="uso-motivo"><option value="Reparto">Reparto</option><option value="Visita a cliente">Visita a cliente</option><option value="Otro">Otro</option></select>
        </div>
        <button class="btn-confirm" style="width:100%" id="save-uso">Registrar salida</button>
      </div>
    </div>` : '<div class="tab-content" id="tab-uso"></div>'}
    <div class="tab-content" id="tab-historial">
      <div class="date-picker-row">
        <select class="filter-select" id="hist-veh-filter"><option value="">Todos los vehículos</option></select>
        <select class="filter-select" id="hist-usr-filter"><option value="">Todos los usuarios</option></select>
      </div>
      <div id="hist-table-wrap"></div>
    </div>`

  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      el.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
      btn.classList.add('active')
      el.querySelector('#tab-' + btn.dataset.tab).classList.add('active')
      if (btn.dataset.tab === 'historial') loadHistorial()
      if (btn.dataset.tab === 'uso') loadUsoPendiente()
    }
  })

  async function loadFlota() {
    const { data } = await supabase.from('vehiculos').select('*').eq('activo', true)
    const flota = data || []
    const disponibles = flota.filter(v => !v.en_uso)
    const sel = el.querySelector('#uso-veh')
    if (sel) {
      sel.innerHTML = disponibles.length === 0
        ? '<option value="">— Sin vehículos disponibles —</option>'
        : disponibles.map(v => `<option value="${v.nombre}">${v.nombre}</option>`).join('')
    }
    el.querySelector('#hist-veh-filter').innerHTML = '<option value="">Todos los vehículos</option>' + flota.map(v => `<option>${v.nombre}</option>`).join('')
    const tab = el.querySelector('#tab-flota')
    tab.innerHTML = flota.map(v => `
      <div style="background:#111;border:1px solid ${v.en_uso ? '#1a3a52' : '#1e1e1e'};padding:16px 18px;margin-bottom:10px;border-radius:2px;display:flex;align-items:center;gap:16px;">
        <div style="width:40px;height:40px;background:#1a1a1a;border:1px solid #222;border-radius:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="ti ti-car" style="font-size:20px;color:${v.en_uso ? '#5aadee' : '#444'}"></i>
        </div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <div style="font-size:14px;color:#ccc;font-weight:600">${v.nombre}</div>
            ${v.en_uso ? '<span class="badge badge-en-ruta" style="font-size:9px">En uso</span>' : '<span style="font-size:10px;color:#333;letter-spacing:1px">Disponible</span>'}
          </div>
          <div style="font-size:11px;color:#444;font-family:\'DM Mono\',monospace">${v.patente || '—'}</div>
          <div style="font-size:12px;color:#333;margin-top:4px">Km actuales: <span style="font-family:\'DM Mono\',monospace;color:#666">${(v.km_actual || 0).toLocaleString()}</span></div>
        </div>
        ${canManageFlota && !v.en_uso ? `<button class="btn-sm primary" data-edit-veh="${v.id}" data-km="${v.km_actual}"><i class="ti ti-pencil"></i></button>` : ''}
      </div>`).join('')

    if (canManageFlota) {
      tab.querySelectorAll('[data-edit-veh]').forEach(btn => {
        btn.onclick = async () => {
          const km = parseInt(prompt(`Actualizar km (actual: ${btn.dataset.km}):`))
          if (!isNaN(km) && km > 0) {
            await supabase.from('vehiculos').update({ km_actual: km }).eq('id', btn.dataset.editVeh)
            loadFlota()
          }
        }
      })
    }
  }

  async function loadUsoPendiente() {
    const wrap = el.querySelector('#uso-pendiente-wrap')
    if (!wrap) return
    const { data } = await supabase.from('vehiculos_uso').select('*')
      .eq('usuario', currentUser.nombre).is('km_regreso', null).order('created_at', { ascending: false })
    const pendientes = data || []
    if (pendientes.length === 0) { wrap.innerHTML = ''; return }
    wrap.innerHTML = pendientes.map(u => `
      <div style="background:#0d1f2d;border:1px solid #1a3a52;padding:14px 16px;margin-bottom:12px;border-radius:2px;max-width:420px;">
        <div style="font-size:13px;color:#5aadee;font-weight:500;margin-bottom:8px"><i class="ti ti-truck-delivery"></i> Uso pendiente de cierre — ${u.vehiculo_nombre}</div>
        <div style="font-size:12px;color:#444;margin-bottom:12px">Km salida: <span style="font-family:'DM Mono',monospace;color:#888">${u.km_salida?.toLocaleString()}</span> · Motivo: ${u.motivo || '—'}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="form-input" id="regreso-km-${u.id}" type="number" placeholder="Km de regreso" style="max-width:180px">
          <button class="btn-confirm" style="padding:9px 14px;font-size:12px" data-cerrar-uso="${u.id}" data-veh="${u.vehiculo_nombre}">Registrar regreso</button>
        </div>
      </div>`).join('')

    wrap.querySelectorAll('[data-cerrar-uso]').forEach(btn => {
      btn.onclick = async () => {
        const km = parseInt(el.querySelector('#regreso-km-' + btn.dataset.cerrarUso).value)
        const uso = pendientes.find(u => u.id === parseInt(btn.dataset.cerrarUso))
        if (!km || km <= uso.km_salida) { alert('Km de regreso inválido'); return }
        await supabase.from('vehiculos_uso').update({ km_regreso: km }).eq('id', btn.dataset.cerrarUso)
        await supabase.from('vehiculos').update({ km_actual: km, en_uso: false, uso_actual_id: null }).eq('nombre', btn.dataset.veh)
        await loadUsoPendiente()
        await loadFlota()
      }
    })
  }

  const saveUsoBtn = el.querySelector('#save-uso')
  if (saveUsoBtn) {
    saveUsoBtn.onclick = async () => {
      const veh = el.querySelector('#uso-veh').value
      const kmSal = parseInt(el.querySelector('#uso-km-sal').value)
      const motivo = el.querySelector('#uso-motivo').value
      if (!veh || !kmSal) { alert('Completá vehículo y km de salida'); return }
      const { data: uso } = await supabase.from('vehiculos_uso').insert({
        vehiculo_nombre: veh, usuario: currentUser.nombre, motivo, km_salida: kmSal
      }).select().single()
      await supabase.from('vehiculos').update({ en_uso: true, uso_actual_id: uso?.id }).eq('nombre', veh)
      el.querySelector('#uso-km-sal').value = ''
      await loadFlota()
      await loadUsoPendiente()
      alert('✓ Salida registrada')
    }
  }

  async function loadHistorial() {
    const vFil = el.querySelector('#hist-veh-filter').value
    const uFil = el.querySelector('#hist-usr-filter').value
    let q = supabase.from('vehiculos_uso').select('*').order('created_at', { ascending: false })
    if (vFil) q = q.eq('vehiculo_nombre', vFil)
    if (uFil) q = q.eq('usuario', uFil)
    const { data } = await q
    const lista = data || []
    el.querySelector('#hist-table-wrap').innerHTML = `<table class="data-table">
      <thead><tr><th>Fecha</th><th>Vehículo</th><th>Usuario</th><th>Motivo</th><th>Km salida</th><th>Km regreso</th><th>Km recorridos</th></tr></thead>
      <tbody>${lista.map(h => {
        const diff = h.km_salida && h.km_regreso ? h.km_regreso - h.km_salida : null
        return `<tr>
          <td>${new Date(h.created_at).toLocaleDateString('es-AR')}</td>
          <td>${h.vehiculo_nombre}</td>
          <td style="color:#ccc">${h.usuario}</td>
          <td style="color:#555">${h.motivo || '—'}</td>
          <td style="font-family:'DM Mono',monospace">${h.km_salida?.toLocaleString()}</td>
          <td style="font-family:'DM Mono',monospace">${h.km_regreso ? h.km_regreso.toLocaleString() : '<span style="color:#e05555">Pendiente</span>'}</td>
          <td style="font-family:'DM Mono',monospace;color:${diff ? '#52c452' : '#2a2a2a'}">${diff ? diff + ' km' : '—'}</td>
        </tr>`}).join('')}
      </tbody></table>`
  }

  el.querySelector('#hist-veh-filter').onchange = loadHistorial
  el.querySelector('#hist-usr-filter').onchange = loadHistorial

  const { data: profiles } = await supabase.from('profiles').select('nombre').eq('activo', true)
  el.querySelector('#hist-usr-filter').innerHTML = '<option value="">Todos los usuarios</option>' + (profiles || []).map(p => `<option>${p.nombre}</option>`).join('')

  await loadFlota()
}

// RECEPCION
export async function renderRecepcion(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica','operario'].includes(currentUser.rol)

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Recepción</span><span class="page-subtitle" id="rec-count"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-new-rec"><i class="ti ti-plus"></i> Nueva recepción</button>' : ''}
    </div>
    ${isObserver ? '<div class="observer-badge"><i class="ti ti-eye"></i> Modo observador — solo lectura</div>' : ''}
    <div class="search-bar">
      <input class="search-input" id="rec-search" placeholder="Buscar por proveedor, transporte...">
    </div>
    <div class="date-picker-row" style="margin-bottom:16px;">
      <span class="date-picker-label">Desde</span>
      <input type="date" class="date-picker-input" id="rec-desde">
      <span class="date-picker-label">Hasta</span>
      <input type="date" class="date-picker-input" id="rec-hasta">
      <button class="btn-sm" id="rec-limpiar"><i class="ti ti-x"></i> Limpiar</button>
    </div>
    <div id="rec-list"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-rec">
      <div class="modal"><div class="modal-top-bar"></div>
        <div class="modal-header"><span class="modal-title" id="modal-rec-title">Nueva recepción</span><button class="modal-close" id="close-rec"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">Proveedor <span class="req">*</span></label><input class="form-input" id="r-prov" placeholder="Nombre del proveedor"></div>
          <div class="form-row-2">
            <div><label class="form-label">Transporte</label><input class="form-input" id="r-trans" placeholder="Quién trajo la mercadería"></div>
            <div><label class="form-label">Bultos <span class="req">*</span></label><input class="form-input" id="r-bultos" type="number" min="1" placeholder="Ej: 24"></div>
          </div>
          <div class="form-row"><label class="form-label">Quién controló <span class="req">*</span></label>
            <select class="form-select" id="r-controla"></select>
          </div>
          <div class="form-row"><label class="form-label">Observaciones</label>
            <textarea class="form-textarea" id="r-obs" placeholder="Estado de la mercadería, faltantes..." style="min-height:60px;resize:none"></textarea>
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-rec">Cancelar</button><button class="btn-confirm" id="save-rec">Registrar</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-rec-detalle">
      <div class="modal"><div class="modal-top-bar"></div>
        <div class="modal-header">
          <span class="modal-title" id="rec-detalle-title">Detalle recepción</span>
          <button class="modal-close" id="close-rec-detalle"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" id="rec-detalle-body"></div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-rec-detalle">Cerrar</button></div>
      </div>
    </div>`

  const modal = el.querySelector('#modal-rec')
  const modalDetalle = el.querySelector('#modal-rec-detalle')
  el.querySelector('#close-rec').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-rec').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }
  el.querySelector('#close-rec-detalle').onclick = () => modalDetalle.classList.remove('open')
  el.querySelector('#cancel-rec-detalle').onclick = () => modalDetalle.classList.remove('open')
  modalDetalle.onclick = (e) => { if (e.target === modalDetalle) modalDetalle.classList.remove('open') }

  const { data: profiles } = await supabase.from('profiles').select('nombre').eq('activo', true).in('rol', ['jefe','logistica','operario'])
  el.querySelector('#r-controla').innerHTML = '<option value="">— seleccionar —</option>' + (profiles || []).map(p => `<option>${p.nombre}</option>`).join('')

  let allRecepciones = []
  const today = new Date().toISOString().split('T')[0]

  // Setear fecha de hoy por defecto
  el.querySelector('#rec-hasta').value = today
  const monthStart = today.substring(0, 8) + '01'
  el.querySelector('#rec-desde').value = monthStart

  async function load() {
    const { data } = await supabase.from('recepciones').select('*').order('fecha', { ascending: false }).order('hora', { ascending: false })
    allRecepciones = data || []
    filter()
  }

  function filter() {
    const q = el.querySelector('#rec-search').value.toLowerCase()
    const desde = el.querySelector('#rec-desde').value
    const hasta = el.querySelector('#rec-hasta').value

    const lista = allRecepciones.filter(r => {
      const matchQ = !q ||
        (r.proveedor || '').toLowerCase().includes(q) ||
        (r.transporte || '').toLowerCase().includes(q) ||
        (r.controla || '').toLowerCase().includes(q) ||
        (r.observaciones || '').toLowerCase().includes(q)
      const matchDesde = !desde ? true : r.fecha >= desde
      const matchHasta = !hasta ? true : r.fecha <= hasta
      return matchQ && matchDesde && matchHasta
    })

    renderTable(lista)
  }

  function renderTable(lista) {
    el.querySelector('#rec-count').textContent = lista.length + ' registros'
    const div = el.querySelector('#rec-list')
    if (lista.length === 0) { div.innerHTML = '<div class="empty-state">Sin recepciones</div>'; return }
    div.innerHTML = `<table class="data-table">
      <thead><tr><th>Fecha</th><th>Proveedor</th><th>Transporte</th><th>Bultos</th><th>Controló</th><th>Hora</th><th></th></tr></thead>
      <tbody>${lista.map(r => `
        <tr>
          <td style="font-family:'DM Mono',monospace;color:#888;font-size:11px">${r.fecha || '—'}</td>
          <td style="color:#ccc;font-weight:500">${r.proveedor}</td>
          <td style="color:#888">${r.transporte || '—'}</td>
          <td style="font-family:'DM Mono',monospace;color:#d4a830">${r.bultos}</td>
          <td style="color:#888;font-size:12px">${r.controla}</td>
          <td style="font-family:'DM Mono',monospace;color:#555;font-size:11px">${r.hora || '—'}</td>
          <td><button class="btn-sm primary" data-detalle='${JSON.stringify(r).replace(/'/g, "&#39;")}' ><i class="ti ti-eye"></i></button></td>
        </tr>`).join('')}
      </tbody></table>`

    div.querySelectorAll('[data-detalle]').forEach(btn => {
      btn.onclick = () => {
        const r = JSON.parse(btn.dataset.detalle.replace(/&#39;/g, "'"))
        mostrarDetalle(r)
      }
    })
  }

  function mostrarDetalle(r) {
    el.querySelector('#rec-detalle-title').textContent = r.proveedor + ' — ' + r.fecha
    el.querySelector('#rec-detalle-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Proveedor</div><div style="color:#ccc;font-weight:500">${r.proveedor}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Fecha</div><div style="font-family:'DM Mono',monospace;color:#888">${r.fecha || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Transporte</div><div style="color:#aaa">${r.transporte || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora</div><div style="font-family:'DM Mono',monospace;color:#888">${r.hora || '—'}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:22px">${r.bultos}</div></div>
        <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Controló</div><div style="color:#ccc">${r.controla}</div></div>
      </div>
      ${r.observaciones ? `<div style="background:#1a1500;border:1px solid #2a2000;padding:10px 14px;border-radius:2px;font-size:12px;color:#d4a830"><i class="ti ti-note" style="font-size:11px"></i> ${r.observaciones}</div>` : ''}`
    modalDetalle.classList.add('open')
  }

  el.querySelector('#rec-search').oninput = filter
  el.querySelector('#rec-desde').onchange = filter
  el.querySelector('#rec-hasta').onchange = filter
  el.querySelector('#rec-limpiar').onclick = () => {
    el.querySelector('#rec-search').value = ''
    el.querySelector('#rec-desde').value = ''
    el.querySelector('#rec-hasta').value = ''
    filter()
  }

  if (canEdit) {
    el.querySelector('#btn-new-rec').onclick = () => {
      ;['r-prov','r-trans','r-bultos','r-obs'].forEach(id => { el.querySelector('#'+id).value = '' })
      el.querySelector('#r-controla').value = ''
      modal.classList.add('open')
    }
    el.querySelector('#save-rec').onclick = async () => {
      const prov = el.querySelector('#r-prov').value.trim()
      const bultos = parseInt(el.querySelector('#r-bultos').value)
      const controla = el.querySelector('#r-controla').value
      if (!prov || !bultos || !controla) { alert('Completá los campos obligatorios'); return }
      const now = new Date()
      await supabase.from('recepciones').insert({
        proveedor: prov, transporte: el.querySelector('#r-trans').value.trim() || null,
        bultos, controla, observaciones: el.querySelector('#r-obs').value.trim() || null,
        fecha: now.toISOString().split('T')[0], hora: now.toTimeString().slice(0,5)
      })
      modal.classList.remove('open')
      await load()
    }
  }

  await load()
}

// PRODUCTIVIDAD
export async function renderProductividad(el, { supabase }) {
  el.innerHTML = `
    <div class="page-header"><div class="page-title-group"><span class="page-title">Productividad</span></div></div>
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
      <select class="filter-select" id="prod-op"><option value="">Todos los operarios</option></select>
      <input type="date" class="date-picker-input" id="prod-desde">
      <input type="date" class="date-picker-input" id="prod-hasta">
      <button class="btn-sm primary" id="prod-filtrar">Filtrar</button>
    </div>
    <div class="stat-grid" id="prod-stats" style="margin-bottom:24px"></div>
    <div class="section-label">Productividad por operario</div>
    <div id="prod-bars" style="margin-bottom:24px"></div>
    <div class="section-label">Detalle de registros</div>
    <div id="prod-table"><div class="loading">Cargando...</div></div>`

  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.substring(0, 8) + '01'
  el.querySelector('#prod-desde').value = monthStart
  el.querySelector('#prod-hasta').value = today

  const { data: profiles } = await supabase.from('profiles').select('nombre').in('rol', ['jefe','logistica','operario'])
  el.querySelector('#prod-op').innerHTML = '<option value="">Todos los operarios</option>' + (profiles || []).map(p => `<option>${p.nombre}</option>`).join('')

  async function load() {
    const op = el.querySelector('#prod-op').value
    const desde = el.querySelector('#prod-desde').value
    const hasta = el.querySelector('#prod-hasta').value
    let q = supabase.from('picking').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).order('hora_registro', { ascending: false })
    if (op) q = q.eq('operario_arma', op)
    const { data } = await q
    const lista = data || []
    const totalLineas = lista.reduce((a, p) => a + (p.lineas || 0), 0)
    const totalSecs = lista.reduce((a, p) => a + (p.timer_secs || 0), 0)
    const totalErr = lista.reduce((a, p) => a + (p.error_count || 0), 0)
    const avgLpm = totalSecs > 0 ? (totalLineas / (totalSecs / 60)).toFixed(1) : 0
    el.querySelector('#prod-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Pedidos armados</div><div class="stat-value">${lista.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total líneas</div><div class="stat-value">${totalLineas}</div></div>
      <div class="stat-card"><div class="stat-label">Prom. l/min</div><div class="stat-value">${avgLpm}</div></div>
      <div class="stat-card"><div class="stat-label">Errores</div><div class="stat-value" style="color:${totalErr > 0 ? '#ff6b2b' : '#52c452'}">${totalErr}</div></div>`
    const operarios = [...new Set(lista.map(p => p.operario_arma).filter(Boolean))]
    const maxLpm = Math.max(...operarios.map(o => {
      const d = lista.filter(p => p.operario_arma === o)
      const s = d.reduce((a, p) => a + (p.timer_secs || 0), 0)
      const l = d.reduce((a, p) => a + (p.lineas || 0), 0)
      return s > 0 ? parseFloat((l / (s / 60)).toFixed(1)) : 0
    }), 0)
    const colors = ['#5aadee','#52c452','#d4a830','#a78bfa','#ff6b2b']
    el.querySelector('#prod-bars').innerHTML = operarios.map((o, i) => {
      const d = lista.filter(p => p.operario_arma === o)
      const s = d.reduce((a, p) => a + (p.timer_secs || 0), 0)
      const l = d.reduce((a, p) => a + (p.lineas || 0), 0)
      const val = s > 0 ? parseFloat((l / (s / 60)).toFixed(1)) : 0
      const pct = maxLpm > 0 ? Math.round(val / maxLpm * 100) : 0
      return `<div class="prod-bar-row"><div class="prod-bar-label">${o}</div><div class="prod-bar-track"><div class="prod-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div><div class="prod-bar-value">${val} l/min</div></div>`
    }).join('')
    el.querySelector('#prod-table').innerHTML = `<table class="data-table">
      <thead><tr><th>Fecha</th><th>Nota</th><th>Cliente</th><th>Operario arma</th><th>Controla</th><th>Líneas</th><th>Tiempo</th><th>L/min</th><th>Errores</th></tr></thead>
      <tbody>${lista.map(p => {
        const h = Math.floor((p.timer_secs||0)/3600), m = Math.floor(((p.timer_secs||0)%3600)/60), s = (p.timer_secs||0)%60
        const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        const lpm = p.timer_secs > 0 ? (p.lineas/(p.timer_secs/60)).toFixed(1) : '—'
        return `<tr><td>${p.fecha||'—'}</td><td style="font-family:'DM Mono',monospace">${p.nota_pedido}</td><td>${p.cliente_nombre}</td><td style="color:#ccc">${p.operario_arma||'—'}</td><td>${p.operario_controla||'—'}</td><td style="font-family:'DM Mono',monospace">${p.lineas}</td><td style="font-family:'DM Mono',monospace;color:#d4a830">${t}</td><td style="font-family:'DM Mono',monospace;color:#5aadee">${lpm}</td><td style="color:${p.error_count>0?'#ff6b2b':'#2a2a2a'}">${p.error_count||0}</td></tr>`
      }).join('')}</tbody></table>`
  }
  el.querySelector('#prod-filtrar').onclick = load
  await load()
}

// USUARIOS
export async function renderUsuarios(el, { supabase }) {
  const ROLES_LABEL = { jefe:'Jefe de área', logistica:'Logística junior', operario:'Operario', vendedor:'Vendedor', observador:'Observador' }
  const ROLES_CLASS = { jefe:'role-jefe', logistica:'role-logistica', operario:'role-operario', vendedor:'role-vendedor', observador:'role-directivo' }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Usuarios</span></div>
      <button class="btn-add" id="btn-new-user"><i class="ti ti-user-plus"></i> Nuevo usuario</button>
    </div>
    <div id="users-table-wrap"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-user">
      <div class="modal"><div class="modal-top-bar"></div>
        <div class="modal-header"><span class="modal-title">Nuevo usuario</span><button class="modal-close" id="close-user"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">Nombre completo <span class="req">*</span></label><input class="form-input" id="u-nombre" placeholder="Ej: Juan Pérez"></div>
          <div class="form-row"><label class="form-label">Email <span class="req">*</span></label><input class="form-input" id="u-email" type="email" placeholder="juan@pyblogistica.com"></div>
          <div class="form-row"><label class="form-label">Contraseña <span class="req">*</span></label><input class="form-input" id="u-pass" type="password" placeholder="Mínimo 6 caracteres"></div>
          <div class="form-row"><label class="form-label">Rol <span class="req">*</span></label>
            <select class="form-select" id="u-rol">
              <option value="logistica">Logística junior</option>
              <option value="operario">Operario</option>
              <option value="vendedor">Vendedor</option>
              <option value="observador">Observador</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-user">Cancelar</button>
          <button class="btn-confirm" id="save-user">Crear usuario</button>
        </div>
      </div>
    </div>`

  const modal = el.querySelector('#modal-user')
  el.querySelector('#close-user').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-user').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('nombre')
    const users = data || []
    const wrap = el.querySelector('#users-table-wrap')
    wrap.innerHTML = `<table class="users-table">
      <thead><tr><th></th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td><span class="${u.activo ? 'user-status-active' : 'user-status-inactive'}"></span></td>
        <td style="color:#bbb;font-weight:500">${u.nombre}</td>
        <td><span class="role-tag ${ROLES_CLASS[u.rol] || 'role-directivo'}">${ROLES_LABEL[u.rol] || u.rol}</span></td>
        <td>${u.activo ? '<span style="color:#52c452;font-size:12px">Activo</span>' : '<span style="color:#444;font-size:12px">Inactivo</span>'}</td>
        <td style="display:flex;gap:6px">
          ${u.rol !== 'jefe' ? `
            <select class="role-select" data-uid="${u.id}">
              ${['logistica','operario','vendedor','observador'].map(r => `<option value="${r}" ${u.rol===r?'selected':''}>${ROLES_LABEL[r]}</option>`).join('')}
            </select>
            <button class="btn-sm ${u.activo ? '' : 'green'}" data-toggle="${u.id}" data-activo="${u.activo}">${u.activo ? '<i class="ti ti-user-off"></i> Dar de baja' : '<i class="ti ti-user-check"></i> Reactivar'}</button>
          ` : '<span style="color:#2a2a2a;font-size:12px">—</span>'}
        </td>
      </tr>`).join('')}
      </tbody></table>`

    wrap.querySelectorAll('.role-select').forEach(sel => {
      sel.onchange = async () => { await supabase.from('profiles').update({ rol: sel.value }).eq('id', sel.dataset.uid) }
    })
    wrap.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.onclick = async () => {
        const newActivo = btn.dataset.activo === 'true' ? false : true
        await supabase.from('profiles').update({ activo: newActivo }).eq('id', btn.dataset.toggle)
        await load()
      }
    })
  }

  el.querySelector('#btn-new-user').onclick = () => {
    ;['u-nombre','u-email','u-pass'].forEach(id => { el.querySelector('#'+id).value = '' })
    modal.classList.add('open')
  }

  el.querySelector('#save-user').onclick = async () => {
    const nombre = el.querySelector('#u-nombre').value.trim()
    const email = el.querySelector('#u-email').value.trim()
    const pass = el.querySelector('#u-pass').value
    const rol = el.querySelector('#u-rol').value
    if (!nombre || !email || !pass) { alert('Completá todos los campos'); return }
    if (pass.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return }
    const { data: authData, error } = await supabase.auth.admin.createUser({ email, password: pass, email_confirm: true })
    if (error) { alert('Error: ' + error.message); return }
    await supabase.from('profiles').insert({ id: authData.user.id, nombre, username: email, rol, activo: true })
    modal.classList.remove('open')
    await load()
  }

  await load()
}