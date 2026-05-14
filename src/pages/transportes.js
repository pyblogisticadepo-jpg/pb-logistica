export async function renderTransportes(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Transportes externos</span><span class="page-subtitle" id="transp-count"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-new-transp"><i class="ti ti-plus"></i> Nuevo transporte</button>' : ''}
    </div>
    ${isObserver ? '<div class="observer-badge"><i class="ti ti-eye"></i> Modo observador — solo lectura</div>' : ''}
    <div class="search-bar">
      <input class="search-input" id="transp-search" placeholder="Buscar transporte...">
      <select class="filter-select" id="transp-filter">
        <option value="">Todos</option>
        <option value="con">Con dirección</option>
        <option value="sin">Sin dirección</option>
      </select>
    </div>
    <div id="transp-list"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-transp">
      <div class="modal"><div class="modal-top-bar"></div>
        <div class="modal-header">
          <span class="modal-title" id="modal-transp-title">Nuevo transporte</span>
          <button class="modal-close" id="close-transp"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">Nombre <span class="req">*</span></label><input class="form-input" id="t-nombre" placeholder="Ej: Transporte Rápido SA"></div>
          <div class="form-row">
            <label class="form-label">Dirección <span class="req">*</span></label>
            <input class="form-input" id="t-direccion" placeholder="Dirección del depósito del transporte">
            <div class="form-hint">Requerida para incluir en recorridos</div>
          </div>
          <div class="form-row-2">
            <div><label class="form-label">Teléfono</label><input class="form-input" id="t-telefono" placeholder="351-xxx-xxxx"></div>
            <div><label class="form-label">Contacto</label><input class="form-input" id="t-contacto" placeholder="Nombre de contacto"></div>
          </div>
          <div class="form-row"><label class="form-label">Observaciones</label><textarea class="form-textarea" id="t-obs" placeholder="Horarios, aclaraciones..." style="min-height:60px;resize:none"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-transp">Cancelar</button>
          <button class="btn-confirm" id="save-transp">Guardar</button>
        </div>
      </div>
    </div>`

  let allTransportes = []
  let editingId = null

  const modal = el.querySelector('#modal-transp')
  el.querySelector('#close-transp').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-transp').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  async function load() {
    const { data } = await supabase.from('transportes').select('*').order('nombre')
    allTransportes = data || []
    renderList(allTransportes)
  }

  function renderList(lista) {
    el.querySelector('#transp-count').textContent = lista.length + ' registros'
    const div = el.querySelector('#transp-list')
    if (lista.length === 0) { div.innerHTML = '<div class="empty-state">Sin transportes registrados</div>'; return }
    div.innerHTML = lista.map(t => `
      <div style="background:#111;border:1px solid ${t.direccion ? '#1e1e1e' : '#2a1a00'};padding:16px 18px;margin-bottom:10px;border-radius:2px;display:flex;align-items:flex-start;gap:14px;">
        <div style="width:36px;height:36px;background:#1a1a1a;border:1px solid #222;border-radius:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
          <i class="ti ti-truck" style="font-size:18px;color:#444"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:14px;color:#ccc;font-weight:600;margin-bottom:4px">${t.nombre}</div>
          <div style="font-size:12px;color:#444;margin-bottom:2px">
            <i class="ti ti-map-pin" style="font-size:11px"></i>
            ${t.direccion || '<span style="color:#e05555">Sin dirección — no puede incluirse en recorridos</span>'}
          </div>
          ${t.telefono ? `<div style="font-size:12px;color:#333"><i class="ti ti-phone" style="font-size:11px"></i> ${t.telefono}${t.contacto ? ' · ' + t.contacto : ''}</div>` : ''}
          ${t.observaciones ? `<div style="font-size:11px;color:#2a2a2a;margin-top:6px;border-top:1px solid #1a1a1a;padding-top:6px">${t.observaciones}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
          ${t.direccion ? '<span class="badge badge-ok" style="font-size:9px">Hab. reparto</span>' : '<span class="badge badge-warn" style="font-size:9px">Sin dirección</span>'}
          ${canEdit ? `<button class="btn-sm primary" data-edit="${t.id}"><i class="ti ti-pencil"></i> Editar</button>` : ''}
        </div>
      </div>`).join('')

    div.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => openEdit(parseInt(btn.dataset.edit))
    })
  }

  function openEdit(id) {
    const t = allTransportes.find(x => x.id === id)
    if (!t) return
    editingId = id
    el.querySelector('#modal-transp-title').textContent = 'Editar — ' + t.nombre
    el.querySelector('#t-nombre').value = t.nombre || ''
    el.querySelector('#t-direccion').value = t.direccion || ''
    el.querySelector('#t-telefono').value = t.telefono || ''
    el.querySelector('#t-contacto').value = t.contacto || ''
    el.querySelector('#t-obs').value = t.observaciones || ''
    modal.classList.add('open')
  }

  if (canEdit) {
    el.querySelector('#btn-new-transp').onclick = () => {
      editingId = null
      el.querySelector('#modal-transp-title').textContent = 'Nuevo transporte'
      ;['t-nombre','t-direccion','t-telefono','t-contacto','t-obs'].forEach(id => { el.querySelector('#' + id).value = '' })
      modal.classList.add('open')
    }
  }

  el.querySelector('#save-transp').onclick = async () => {
    const nombre = el.querySelector('#t-nombre').value.trim()
    const direccion = el.querySelector('#t-direccion').value.trim()
    if (!nombre) { alert('El nombre es obligatorio'); return }
    const payload = {
      nombre,
      direccion: direccion || null,
      telefono: el.querySelector('#t-telefono').value.trim() || null,
      contacto: el.querySelector('#t-contacto').value.trim() || null,
      observaciones: el.querySelector('#t-obs').value.trim() || null,
      activo: true
    }
    if (editingId) {
      await supabase.from('transportes').update(payload).eq('id', editingId)
    } else {
      await supabase.from('transportes').insert(payload)
    }
    editingId = null
    modal.classList.remove('open')
    await load()
  }

  el.querySelector('#transp-search').oninput = filter
  el.querySelector('#transp-filter').onchange = filter

  function filter() {
    const q = el.querySelector('#transp-search').value.toLowerCase()
    const f = el.querySelector('#transp-filter').value
    renderList(allTransportes.filter(t =>
      (t.nombre.toLowerCase().includes(q) || (t.direccion || '').toLowerCase().includes(q)) &&
      (f === '' ? true : f === 'con' ? !!t.direccion : !t.direccion)
    ))
  }

  await load()
}