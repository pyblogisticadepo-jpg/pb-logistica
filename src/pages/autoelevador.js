export async function renderAutoelevador(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)
  const today = new Date().toISOString().split('T')[0]
  const mesActual = today.substring(0, 7)

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Autoelevador</span><span class="page-subtitle" id="auto-sub"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-new-auto"><i class="ti ti-plus"></i> Registrar retiro</button>' : ''}
    </div>
    ${isObserver ? '<div class="observer-badge"><i class="ti ti-eye"></i> Solo lectura</div>' : ''}

    <div id="auto-abiertos-wrap"></div>

    <div class="section-label" style="margin-top:16px">Historial</div>
    <div class="date-picker-row" style="margin-bottom:12px;">
      <span class="date-picker-label">Mes</span>
      <input type="month" class="date-picker-input" id="auto-mes" value="${mesActual}">
    </div>
    <div id="auto-stats" style="margin-bottom:16px;"></div>
    <div id="auto-historial"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-auto">
      <div class="modal"><div class="modal-top-bar" style="background:#d4a830"></div>
        <div class="modal-header">
          <span class="modal-title">Registrar retiro de autoelevador</span>
          <button class="modal-close" id="close-auto"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label class="form-label">Empresa <span class="req">*</span></label>
            <input class="form-input" id="auto-empresa" placeholder="Nombre de la empresa">
          </div>
          <div class="form-row">
            <label class="form-label">Quien retira <span class="req">*</span></label>
            <input class="form-input" id="auto-retira" placeholder="Nombre de la persona">
          </div>
          <div class="form-row">
            <label class="form-label">Observaciones</label>
            <textarea class="form-textarea" id="auto-obs" placeholder="Opcional..." style="min-height:50px;resize:none"></textarea>
          </div>
          <div style="background:#1a1500;border:1px solid #2a2000;padding:10px 14px;border-radius:2px;font-size:12px;color:#d4a830;">
            <i class="ti ti-clock" style="font-size:11px"></i> La hora de retiro se registra automáticamente al guardar.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-auto">Cancelar</button>
          <button class="btn-confirm" style="background:#d4a830;color:#000" id="save-auto"><i class="ti ti-forklift"></i> Registrar retiro</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-devolucion">
      <div class="modal"><div class="modal-top-bar green"></div>
        <div class="modal-header">
          <span class="modal-title" id="devolucion-title">Registrar devolución</span>
          <button class="modal-close" id="close-devolucion"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div id="devolucion-resumen" style="background:#111;border:1px solid #1e1e1e;padding:14px 16px;border-radius:2px;margin-bottom:16px;font-size:13px;color:#666;line-height:1.8;"></div>
          <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:10px 14px;border-radius:2px;font-size:12px;color:#3a6a3a;">
            <i class="ti ti-clock" style="font-size:11px"></i> La hora de devolución se registra automáticamente al confirmar.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-devolucion">Cancelar</button>
          <button class="btn-confirm" id="save-devolucion"><i class="ti ti-check"></i> Confirmar devolución</button>
        </div>
      </div>
    </div>`

  const modal = el.querySelector('#modal-auto')
  const modalDev = el.querySelector('#modal-devolucion')
  let activoId = null

  el.querySelector('#close-auto').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-auto').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }
  el.querySelector('#close-devolucion').onclick = () => modalDev.classList.remove('open')
  el.querySelector('#cancel-devolucion').onclick = () => modalDev.classList.remove('open')
  modalDev.onclick = (e) => { if (e.target === modalDev) modalDev.classList.remove('open') }

  if (canEdit) {
    el.querySelector('#btn-new-auto').onclick = () => {
      el.querySelector('#auto-empresa').value = ''
      el.querySelector('#auto-retira').value = ''
      el.querySelector('#auto-obs').value = ''
      modal.classList.add('open')
    }

    el.querySelector('#save-auto').onclick = async () => {
      const empresa = el.querySelector('#auto-empresa').value.trim()
      const retira = el.querySelector('#auto-retira').value.trim()
      if (!empresa || !retira) { alert('Completá empresa y quien retira'); return }
      const now = new Date()
      await supabase.from('autoelevador').insert({
        empresa,
        retira,
        fecha: now.toISOString().split('T')[0],
        hora_retiro: now.toTimeString().slice(0,5),
        observaciones: el.querySelector('#auto-obs').value.trim() || null,
        usuario_registro: currentUser.nombre
      })
      modal.classList.remove('open')
      await load()
    }

    el.querySelector('#save-devolucion').onclick = async () => {
      const now = new Date()
      const horaDevolucion = now.toTimeString().slice(0,5)
      const { data: registro } = await supabase.from('autoelevador').select('*').eq('id', activoId).single()
      if (!registro) return
      // Calcular minutos
      const [hR, mR] = registro.hora_retiro.split(':').map(Number)
      const [hD, mD] = horaDevolucion.split(':').map(Number)
      let minutos = (hD * 60 + mD) - (hR * 60 + mR)
      if (minutos < 0) minutos += 24 * 60 // cruzó medianoche
      await supabase.from('autoelevador').update({
        hora_devolucion: horaDevolucion,
        minutos_total: minutos,
        usuario_devolucion: currentUser.nombre
      }).eq('id', activoId)
      modalDev.classList.remove('open')
      activoId = null
      await load()
    }
  }

  el.querySelector('#auto-mes').onchange = () => loadHistorial(el.querySelector('#auto-mes').value)

  async function load() {
    await loadAbiertos()
    await loadHistorial(el.querySelector('#auto-mes').value)
  }

  async function loadAbiertos() {
    const { data } = await supabase
      .from('autoelevador').select('*')
      .is('hora_devolucion', null)
      .order('created_at', { ascending: false })
    const abiertos = data || []
    const wrap = el.querySelector('#auto-abiertos-wrap')

    if (abiertos.length === 0) {
      wrap.innerHTML = `
        <div style="background:#111;border:1px solid #1e1e1e;padding:16px 18px;border-radius:2px;display:flex;align-items:center;gap:12px;">
          <i class="ti ti-forklift" style="font-size:24px;color:#333"></i>
          <span style="color:#444;font-size:13px">Autoelevador disponible — sin retiros activos</span>
        </div>`
      el.querySelector('#auto-sub').textContent = 'Disponible'
      return
    }

    el.querySelector('#auto-sub').textContent = `${abiertos.length} retiro${abiertos.length > 1 ? 's' : ''} activo${abiertos.length > 1 ? 's' : ''}`
    wrap.innerHTML = `
      <div class="section-label" style="margin-top:0">Retiros activos</div>
      ${abiertos.map(a => `
        <div style="background:#1a1500;border:1px solid #2a2000;padding:16px 18px;margin-bottom:10px;border-radius:2px;display:flex;align-items:center;gap:12px;">
          <i class="ti ti-forklift" style="font-size:24px;color:#d4a830;flex-shrink:0"></i>
          <div style="flex:1">
            <div style="font-size:14px;color:#d4a830;font-weight:600;margin-bottom:3px">${a.empresa}</div>
            <div style="font-size:12px;color:#666">Retira: <strong style="color:#888">${a.retira}</strong> · Desde: <span style="font-family:'DM Mono',monospace;color:#d4a830">${a.hora_retiro}</span> · Fecha: ${a.fecha}</div>
            ${a.observaciones ? `<div style="font-size:11px;color:#555;margin-top:4px">${a.observaciones}</div>` : ''}
          </div>
          ${canEdit ? `<button class="btn-sm green" data-devolver="${a.id}" data-empresa="${a.empresa}" data-retira="${a.retira}" data-hora="${a.hora_retiro}"><i class="ti ti-check"></i> Devuelto</button>` : '<span class="badge badge-reparto">En uso</span>'}
        </div>`).join('')}`

    if (canEdit) {
      wrap.querySelectorAll('[data-devolver]').forEach(btn => {
        btn.onclick = () => {
          activoId = parseInt(btn.dataset.devolver)
          el.querySelector('#devolucion-title').textContent = 'Devolución — ' + btn.dataset.empresa
          el.querySelector('#devolucion-resumen').innerHTML = `
            <strong style="color:#ccc">${btn.dataset.empresa}</strong><br>
            Retira: ${btn.dataset.retira}<br>
            Hora de retiro: <span style="font-family:'DM Mono',monospace;color:#d4a830">${btn.dataset.hora}</span>`
          modalDev.classList.add('open')
        }
      })
    }
  }

  async function loadHistorial(mes) {
    const desde = mes + '-01'
    const hasta = mes + '-31'
    const { data } = await supabase
      .from('autoelevador').select('*')
      .gte('fecha', desde).lte('fecha', hasta)
      .not('hora_devolucion', 'is', null)
      .order('fecha', { ascending: false }).order('hora_retiro', { ascending: false })
    const lista = data || []

    const totalMinutos = lista.reduce((a, r) => a + (r.minutos_total || 0), 0)
    const totalHoras = Math.floor(totalMinutos / 60)
    const totalMins = totalMinutos % 60

    el.querySelector('#auto-stats').innerHTML = lista.length === 0 ? '' : `
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div class="stat-card" style="flex:1;min-width:120px;padding:14px 18px;">
          <div class="stat-label">Registros</div>
          <div class="stat-value" style="font-size:22px">${lista.length}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:120px;padding:14px 18px;">
          <div class="stat-label">Total horas mes</div>
          <div class="stat-value" style="font-size:22px;color:#d4a830">${totalHoras}h ${totalMins}m</div>
        </div>
      </div>`

    const wrap = el.querySelector('#auto-historial')
    if (lista.length === 0) {
      wrap.innerHTML = '<div class="empty-state">Sin registros para este mes</div>'
      return
    }

    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Fecha</th><th>Empresa</th><th>Retira</th><th>Hora retiro</th><th>Hora devolución</th><th>Duración</th><th>Registró</th></tr></thead>
      <tbody>${lista.map(r => {
        const h = Math.floor((r.minutos_total || 0) / 60)
        const m = (r.minutos_total || 0) % 60
        return `<tr>
          <td style="font-family:'DM Mono',monospace;color:#888;font-size:11px">${r.fecha}</td>
          <td style="color:#ccc;font-weight:500">${r.empresa}</td>
          <td style="color:#888">${r.retira}</td>
          <td style="font-family:'DM Mono',monospace;color:#d4a830">${r.hora_retiro}</td>
          <td style="font-family:'DM Mono',monospace;color:#52c452">${r.hora_devolucion}</td>
          <td style="font-family:'DM Mono',monospace;color:#5aadee">${h}h ${m}m</td>
          <td style="color:#555;font-size:11px">${r.usuario_registro || '—'}</td>
        </tr>`
      }).join('')}
      </tbody></table>`
  }

  await load()
}