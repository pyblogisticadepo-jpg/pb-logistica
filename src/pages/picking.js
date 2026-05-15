export async function renderPicking(el, { supabase, currentUser, isObserver }) {
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Picking</span><span class="page-subtitle" id="picking-count"></span></div>
      ${!isObserver ? '<button class="btn-add" id="btn-new-picking"><i class="ti ti-plus"></i> Nuevo picking</button>' : ''}
    </div>
    <div class="search-bar">
      <input class="search-input" id="pk-search" placeholder="Buscar por cliente o nota...">
      <select class="filter-select" id="pk-filter">
        <option value="">Todos</option>
        <option value="preparacion">En preparación</option>
        <option value="armado">Armado</option>
        <option value="habilitado">Habilitado</option>
      </select>
    </div>
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
            <div><label class="form-label">Nota de pedido <span class="req">*</span></label><input class="form-input" id="s1-nota" placeholder="Ej: 10050"></div>
            <div><label class="form-label">Líneas <span class="req">*</span></label><input class="form-input" id="s1-lineas" type="number" min="1" placeholder="Ej: 12"></div>
          </div>
          <div class="form-row">
            <label class="form-label">Cliente <span class="req">*</span></label>
            <input class="form-input" id="s1-cliente" placeholder="Nombre del cliente" list="s1-client-list">
            <datalist id="s1-client-list"></datalist>
            <div class="form-hint">Si no existe se creará automáticamente</div>
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
          <div id="s3-warn" style="display:none;font-size:12px;color:#888;padding:10px 14px;background:#1a1a1a;border:1px solid #222;border-radius:2px;">
            Con solo Remito el pedido no podrá asignarse a reparto hasta recibir la factura.
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-pk3">Cancelar</button><button class="btn-confirm" id="save-pk3">Confirmar documentación</button></div>
      </div>
    </div>`

  let allPicking = []
  let editingId = null
  let clientes = []
  let profiles = []

  const DOC_LABEL = { fac_remito: 'Fac. y Remito', fac_etiqueta: 'Fac. y Etiqueta', remito: 'Remito solo' }
  const ESTADO_HTML = {
    preparacion: '<span class="badge badge-preparacion">En preparación</span>',
    armado: '<span class="badge badge-armado">Armado</span>',
    habilitado: '<span class="badge badge-habilitado">Habilitado ✓</span>'
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

  el.querySelector('#s2-error-yn').onchange = () => {
    el.querySelector('#s2-err-count-wrap').style.display = el.querySelector('#s2-error-yn').value === 'si' ? 'block' : 'none'
  }
  el.querySelector('#s3-doc').onchange = () => {
    el.querySelector('#s3-warn').style.display = el.querySelector('#s3-doc').value === 'remito' ? 'block' : 'none'
  }

  // Calcular tiempo cuando se cargan hora inicio y fin
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
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    label.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    div.style.display = 'block'
    return secs
  }

  el.querySelector('#s2-inicio').oninput = calcularTiempo
  el.querySelector('#s2-fin').oninput = calcularTiempo

  async function load() {
    const [{ data: pk }, { data: cl }, { data: pr }] = await Promise.all([
      supabase.from('picking').select('*').order('hora_registro', { ascending: false }),
      supabase.from('clientes').select('id,nombre').order('nombre'),
      supabase.from('profiles').select('nombre,rol').eq('activo', true)
    ])
    allPicking = pk || []
    clientes = cl || []
    profiles = pr || []
    renderTable(allPicking)
    const dl = el.querySelector('#s1-client-list')
    dl.innerHTML = clientes.map(c => `<option value="${c.nombre}">`).join('')
  }

  function renderTable(lista) {
    el.querySelector('#picking-count').textContent = lista.length + ' registros'
    const wrap = el.querySelector('#picking-table-wrap')
    if (lista.length === 0) { wrap.innerHTML = '<div class="empty-state">Sin registros</div>'; return }
    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Nota</th><th>Cliente</th><th>Estado</th><th>Documentación</th><th>Líneas</th><th>Operario arma</th><th>Tiempo</th><th>Fecha</th><th></th></tr></thead>
      <tbody>${lista.map(p => {
        const h = Math.floor((p.timer_secs||0)/3600)
        const m = Math.floor(((p.timer_secs||0)%3600)/60)
        const s = (p.timer_secs||0)%60
        const tiempo = p.timer_secs > 0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : '<span style="color:#2a2a2a">—</span>'
        return `<tr>
          <td style="font-family:'DM Mono',monospace;color:#555;font-size:12px">${p.nota_pedido}</td>
          <td style="color:#ccc">${p.cliente_nombre}</td>
          <td>${ESTADO_HTML[p.estado] || p.estado}</td>
          <td>${p.documentacion ? `<span class="badge badge-armado" style="font-size:9px">${DOC_LABEL[p.documentacion]}</span>` : '<span style="color:#2a2a2a">—</span>'}</td>
          <td style="font-family:'DM Mono',monospace">${p.lineas}</td>
          <td style="color:#666">${p.operario_arma || '<span style="color:#2a2a2a">—</span>'}</td>
          <td style="font-family:'DM Mono',monospace;color:#d4a830;font-size:12px">${tiempo}</td>
          <td style="font-size:11px;color:#444">${p.fecha || new Date(p.hora_registro).toLocaleDateString('es-AR')}</td>
          <td>${!isObserver ? `<button class="btn-sm primary" data-detail="${p.id}"><i class="ti ti-eye"></i></button>` : ''}</td>
        </tr>`}).join('')}
      </tbody></table>`
    if (!isObserver) {
      wrap.querySelectorAll('[data-detail]').forEach(btn => { btn.onclick = () => openDetail(parseInt(btn.dataset.detail)) })
    }
  }

  function openDetail(id) {
    const p = allPicking.find(x => x.id === id)
    if (!p) return
    editingId = id
    if (p.estado === 'preparacion') { openStep2(p) }
    else if (p.estado === 'armado') { openStep3(p) }
  }

  function openStep2(p) {
    el.querySelector('#pk2-title').textContent = 'Completar armado — ' + p.nota_pedido
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
    el.querySelector('#pk3-title').textContent = 'Confirmar doc. — ' + p.nota_pedido
    el.querySelector('#s3-doc').value = ''
    el.querySelector('#s3-warn').style.display = 'none'
    m3.classList.add('open')
  }

  if (!isObserver) {
    el.querySelector('#btn-new-picking').onclick = () => {
      el.querySelector('#s1-nota').value = ''
      el.querySelector('#s1-lineas').value = ''
      el.querySelector('#s1-cliente').value = ''
      m1.classList.add('open')
    }
  }

  el.querySelector('#save-pk1').onclick = async () => {
    const nota = el.querySelector('#s1-nota').value.trim()
    const clienteNombre = el.querySelector('#s1-cliente').value.trim()
    const lineas = parseInt(el.querySelector('#s1-lineas').value)
    if (!nota || !clienteNombre || !lineas) { alert('Completá todos los campos'); return }
    let clienteId = clientes.find(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase())?.id
    if (!clienteId) {
      const { data } = await supabase.from('clientes').insert({ nombre: clienteNombre }).select().single()
      clienteId = data?.id
      clientes.push({ id: clienteId, nombre: clienteNombre })
    }
    await supabase.from('picking').insert({ nota_pedido: '#' + nota, cliente_id: clienteId, cliente_nombre: clienteNombre, lineas, estado: 'preparacion' })
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
      operario_arma: arma,
      operario_controla: controla,
      hora_inicio: el.querySelector('#s2-inicio').value || null,
      hora_fin: el.querySelector('#s2-fin').value || null,
      timer_secs: timerSecs,
      error_yn: errorYn,
      error_count: errorCount,
      estado: 'armado'
    }).eq('id', editingId)
    m2.classList.remove('open')
    await load()
  }

  el.querySelector('#save-pk3').onclick = async () => {
    const doc = el.querySelector('#s3-doc').value
    if (!doc) { alert('Seleccioná el tipo de documentación'); return }
    const habilita = doc !== 'remito'
    await supabase.from('picking').update({ documentacion: doc, estado: habilita ? 'habilitado' : 'armado' }).eq('id', editingId)
    m3.classList.remove('open')
    await load()
  }

  el.querySelector('#pk-search').oninput = filter
  el.querySelector('#pk-filter').onchange = filter
  function filter() {
    const q = el.querySelector('#pk-search').value.toLowerCase()
    const f = el.querySelector('#pk-filter').value
    renderTable(allPicking.filter(p =>
      (p.nota_pedido.toLowerCase().includes(q) || p.cliente_nombre.toLowerCase().includes(q)) &&
      (f === '' ? true : p.estado === f)
    ))
  }

  await load()
}