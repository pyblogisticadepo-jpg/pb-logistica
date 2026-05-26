export async function renderClientes(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica','vendedor'].includes(currentUser.rol)

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Clientes</span><span class="page-subtitle" id="clientes-count"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-new-client"><i class="ti ti-plus"></i> Nuevo cliente</button>' : ''}
    </div>
    ${isObserver ? '<div class="observer-badge"><i class="ti ti-eye"></i> Modo observador — solo lectura</div>' : ''}
    <div id="clientes-alert"></div>
    <div class="search-bar">
      <input class="search-input" id="client-search" placeholder="Buscar cliente...">
      <select class="filter-select" id="client-filter">
        <option value="">Todos</option>
        <option value="con">Con dirección</option>
        <option value="sin">Sin dirección</option>
      </select>
    </div>
    <div id="clientes-table-wrap"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-client">
      <div class="modal"><div class="modal-top-bar green"></div>
        <div class="modal-header"><span class="modal-title" id="modal-client-title">Nuevo cliente</span><button class="modal-close" id="close-client-modal"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">Nombre <span class="req">*</span></label><input class="form-input" id="c-nombre" placeholder="Nombre del cliente"></div>
          <div class="form-row-2">
            <div><label class="form-label">CUIT</label><input class="form-input" id="c-cuit" placeholder="Ej: 20-12345678-9"></div>
            <div><label class="form-label">Nº cliente Manager</label><input class="form-input" id="c-manager" placeholder="Ej: 4521"></div>
          </div>
          <div class="form-row"><label class="form-label">Dirección</label><input class="form-input" id="c-dir" placeholder="Dirección de entrega"><div class="form-hint">Requerida para habilitar reparto en Entrega P&B</div></div>
          <div class="form-row-2">
            <div><label class="form-label">Horario</label><input class="form-input" id="c-horario" placeholder="Lun–Vie 8–17hs"></div>
            <div><label class="form-label">Teléfono</label><input class="form-input" id="c-tel" placeholder="351-xxx-xxxx"></div>
          </div>
          <div class="form-row"><label class="form-label">Aclaraciones</label><textarea class="form-textarea" id="c-aclar" placeholder="Ej: Entrar por Italia..."></textarea></div>
          <div class="form-row">
            <label class="form-label">Transporte habitual</label>
            <select class="form-select" id="c-transporte-tipo">
              <option value="pyb">Entrega P&B</option>
              <option value="retira">Retira cliente</option>
              <option value="externo">Transporte externo</option>
            </select>
          </div>
          <div id="c-transporte-ext-wrap" style="display:none" class="form-row">
            <label class="form-label">Seleccionar transporte</label>
            <select class="form-select" id="c-transporte-id"></select>
            <div class="form-hint">Si el transporte no está en la lista, crealo primero en el módulo Transportes</div>
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-client-modal">Cancelar</button><button class="btn-confirm" id="save-client-btn">Guardar</button></div>
      </div>
    </div>`

  let editingId = null
  let allClientes = []
  let transportes = []

  const modal = el.querySelector('#modal-client')
  const tipoSel = el.querySelector('#c-transporte-tipo')

  tipoSel.onchange = () => {
    el.querySelector('#c-transporte-ext-wrap').style.display = tipoSel.value === 'externo' ? 'block' : 'none'
  }

  el.querySelector('#close-client-modal').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-client-modal').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  async function loadTransportes() {
    const { data } = await supabase.from('transportes').select('*').eq('activo', true).order('nombre')
    transportes = data || []
    const sel = el.querySelector('#c-transporte-id')
    if (transportes.length === 0) {
      sel.innerHTML = '<option value="">— Sin transportes cargados —</option>'
    } else {
      sel.innerHTML = transportes.map(t => `<option value="${t.id}">${t.nombre}${t.retira_deposito ? ' (retira en depósito)' : !t.direccion ? ' ⚠️ sin dirección' : ''}</option>`).join('')
    }
  }

  async function load() {
    await loadTransportes()
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    allClientes = data || []

    const transpIds = [...new Set(allClientes.map(c => c.transporte_id).filter(Boolean))]
    let transpMap = {}
    if (transpIds.length > 0) {
      const { data: transp } = await supabase.from('transportes').select('id, nombre, retira_deposito').in('id', transpIds)
      ;(transp || []).forEach(t => { transpMap[t.id] = t })
    }
    allClientes = allClientes.map(c => ({
      ...c,
      _transporte_nombre: transpMap[c.transporte_id]?.nombre || null,
      _retira_deposito: transpMap[c.transporte_id]?.retira_deposito || false
    }))

    renderTable(allClientes)
    checkIncompletos(allClientes)
  }

  function checkIncompletos(lista) {
    const sin = lista.filter(c => !c.direccion && c.transporte_tipo === 'pyb')
    const alertDiv = el.querySelector('#clientes-alert')
    if (sin.length === 0) { alertDiv.innerHTML = ''; return }
    alertDiv.innerHTML = `<div style="background:#1a1500;border:1px solid #2a2000;padding:12px 16px;border-radius:2px;font-size:12px;color:#6a5a00;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
      <i class="ti ti-alert-circle" style="color:#d4a830"></i>
      <span><strong>${sin.length} cliente${sin.length > 1 ? 's' : ''} sin dirección:</strong> ${sin.map(c => c.nombre).join(', ')} — no pueden asignarse a reparto P&B.</span>
    </div>`
  }

  function getTransporteLabel(c) {
    if (c.transporte_tipo === 'pyb') return 'Entrega P&B'
    if (c.transporte_tipo === 'retira') return 'Retira cliente'
    return c._transporte_nombre || 'Transp. externo'
  }

  function isHabilitado(c) {
    if (c.transporte_tipo === 'retira') return true
    if (c.transporte_tipo === 'pyb') return !!c.direccion
    if (c.transporte_tipo === 'externo') {
      if (c._retira_deposito) return true
      return !!c._transporte_nombre
    }
    return false
  }

  function renderTable(lista) {
    el.querySelector('#clientes-count').textContent = lista.length + ' registros'
    const wrap = el.querySelector('#clientes-table-wrap')
    if (lista.length === 0) { wrap.innerHTML = '<div class="empty-state">Sin clientes</div>'; return }
    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Cliente</th><th>Nº Manager</th><th>CUIT</th><th>Dirección</th><th>Transporte</th><th>Hab.</th>${canEdit ? '<th></th>' : ''}</tr></thead>
      <tbody>${lista.map(c => {
        const hab = isHabilitado(c)
        return `<tr>
          <td style="color:#ccc;font-weight:500">${c.nombre}</td>
          <td style="font-family:'DM Mono',monospace;color:#5aadee;font-size:12px">${c.nro_manager || '<span style="color:#2a2a2a">—</span>'}</td>
          <td style="font-family:'DM Mono',monospace;color:#555;font-size:12px">${c.cuit || '<span style="color:#2a2a2a">—</span>'}</td>
          <td>${c.direccion || '<span style="color:#2a2a2a;font-style:italic">Sin cargar</span>'}</td>
          <td style="color:#666;font-size:12px">${getTransporteLabel(c)}</td>
          <td>${hab ? '<span class="badge badge-ok">Habilitado</span>' : '<span class="badge badge-warn">Sin dirección</span>'}</td>
          ${canEdit ? `<td><button class="btn-sm" data-edit="${c.id}"><i class="ti ti-pencil"></i> Editar</button></td>` : ''}
        </tr>`
      }).join('')}
      </tbody></table>`

    wrap.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => openEdit(parseInt(btn.dataset.edit))
    })
  }

  function openEdit(id) {
    const c = allClientes.find(x => x.id === id)
    if (!c) return
    editingId = id
    el.querySelector('#modal-client-title').textContent = 'Editar — ' + c.nombre
    el.querySelector('#c-nombre').value = c.nombre
    el.querySelector('#c-cuit').value = c.cuit || ''
    el.querySelector('#c-manager').value = c.nro_manager || ''
    el.querySelector('#c-dir').value = c.direccion || ''
    el.querySelector('#c-horario').value = c.horario || ''
    el.querySelector('#c-tel').value = c.telefono || ''
    el.querySelector('#c-aclar').value = c.aclaraciones || ''
    tipoSel.value = c.transporte_tipo || 'pyb'
    tipoSel.dispatchEvent(new Event('change'))
    if (c.transporte_id) el.querySelector('#c-transporte-id').value = c.transporte_id
    modal.classList.add('open')
  }

  el.querySelector('#save-client-btn').onclick = async () => {
    const nombre = el.querySelector('#c-nombre').value.trim()
    if (!nombre) { alert('El nombre es obligatorio'); return }
    const tipo = tipoSel.value
    const transporteId = tipo === 'externo' ? parseInt(el.querySelector('#c-transporte-id').value) : null
    if (tipo === 'externo' && !transporteId) { alert('Seleccioná un transporte externo'); return }
    const payload = {
      nombre,
      cuit: el.querySelector('#c-cuit').value.trim() || null,
      nro_manager: el.querySelector('#c-manager').value.trim() || null,
      direccion: el.querySelector('#c-dir').value.trim() || null,
      horario: el.querySelector('#c-horario').value.trim() || null,
      telefono: el.querySelector('#c-tel').value.trim() || null,
      aclaraciones: el.querySelector('#c-aclar').value.trim() || null,
      transporte_tipo: tipo,
      transporte_id: transporteId,
      updated_at: new Date().toISOString()
    }
    if (editingId) {
      await supabase.from('clientes').update(payload).eq('id', editingId)
    } else {
      await supabase.from('clientes').insert(payload)
    }
    editingId = null
    modal.classList.remove('open')
    await load()
  }

  if (canEdit) {
    el.querySelector('#btn-new-client').onclick = () => {
      editingId = null
      el.querySelector('#modal-client-title').textContent = 'Nuevo cliente'
      ;['c-nombre','c-cuit','c-manager','c-dir','c-horario','c-tel','c-aclar'].forEach(id => { el.querySelector('#'+id).value = '' })
      tipoSel.value = 'pyb'
      tipoSel.dispatchEvent(new Event('change'))
      modal.classList.add('open')
    }
  }

  el.querySelector('#client-search').oninput = () => filter()
  el.querySelector('#client-filter').onchange = () => filter()

  function filter() {
    const q = el.querySelector('#client-search').value.toLowerCase()
    const f = el.querySelector('#client-filter').value
    renderTable(allClientes.filter(c =>
      (c.nombre.toLowerCase().includes(q) || (c.direccion || '').toLowerCase().includes(q) || (c.nro_manager || '').toLowerCase().includes(q) || (c.cuit || '').toLowerCase().includes(q)) &&
      (f === '' ? true : f === 'con' ? !!c.direccion : !c.direccion)
    ))
  }

  await load()
}