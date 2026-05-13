export async function renderDespacho(el, { supabase, currentUser }) {
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Despacho</span><span class="page-subtitle" id="despacho-sub"></span></div>
    </div>
    <div id="despacho-content"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-salida">
      <div class="modal"><div class="modal-top-bar orange"></div>
        <div class="modal-header">
          <span class="modal-title" id="salida-title">Confirmar salida</span>
          <button class="modal-close" id="close-salida"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#3a6a3a;margin-bottom:20px;display:flex;gap:10px;">
            <i class="ti ti-info-circle" style="color:#52c452;flex-shrink:0"></i>
            <span>Al confirmar la salida los pedidos pasan a <strong>En reparto</strong> y queda registrada la hora de egreso.</span>
          </div>
          <div class="form-row">
            <label class="form-label">Vehículo <span class="req">*</span></label>
            <select class="form-select" id="salida-vehiculo">
              <option value="">— seleccionar —</option>
              <option>Berlingo blanca</option>
              <option>Partner gris</option>
              <option>Sprinter verde</option>
              <option>Saveiro</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Km de salida <span class="req">*</span></label>
            <input class="form-input" id="salida-km" type="number" placeholder="Ej: 45820">
            <div class="form-hint">Kilometraje actual del vehículo al salir</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-salida">Cancelar</button>
          <button class="btn-confirm" id="save-salida"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-regreso">
      <div class="modal"><div class="modal-top-bar green"></div>
        <div class="modal-header">
          <span class="modal-title">Confirmar regreso</span>
          <button class="modal-close" id="close-regreso"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div id="regreso-resumen" style="background:#111;border:1px solid #1e1e1e;padding:14px 16px;border-radius:2px;margin-bottom:20px;font-size:13px;color:#666;line-height:1.8;"></div>
          <div class="form-row">
            <label class="form-label">Km de regreso <span class="req">*</span></label>
            <input class="form-input" id="regreso-km" type="number" placeholder="Ej: 45951">
            <div class="form-hint">Kilometraje del vehículo al regresar</div>
          </div>
          <div id="km-diff-preview" style="font-size:12px;margin-top:8px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-regreso">Cancelar</button>
          <button class="btn-confirm" id="save-regreso"><i class="ti ti-home"></i> Confirmar regreso</button>
        </div>
      </div>
    </div>`

  const modalSalida = el.querySelector('#modal-salida')
  const modalRegreso = el.querySelector('#modal-regreso')
  let activeRecorridoId = null
  let currentRecorridos = []

  ;['close-salida','cancel-salida'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalSalida.classList.remove('open')
  })
  ;['close-regreso','cancel-regreso'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalRegreso.classList.remove('open')
  })
  modalSalida.onclick = (e) => { if (e.target === modalSalida) modalSalida.classList.remove('open') }
  modalRegreso.onclick = (e) => { if (e.target === modalRegreso) modalRegreso.classList.remove('open') }

  el.querySelector('#regreso-km').oninput = () => {
    const km = parseInt(el.querySelector('#regreso-km').value)
    const preview = el.querySelector('#km-diff-preview')
    const r = currentRecorridos.find(x => x.id === activeRecorridoId)
    if (r && km && r.km_salida) {
      const diff = km - r.km_salida
      preview.innerHTML = diff > 0
        ? `<span style="color:#52c452">Km recorridos: ${diff} km</span>`
        : `<span style="color:#e05555">El km de regreso debe ser mayor al de salida</span>`
    }
  }

  el.querySelector('#save-salida').onclick = async () => {
    const vehiculo = el.querySelector('#salida-vehiculo').value
    const km = parseInt(el.querySelector('#salida-km').value)
    if (!vehiculo || !km) { alert('Completá vehículo y km de salida'); return }
    const hora = new Date().toTimeString().slice(0,5)
    const { error } = await supabase.from('recorridos').update({
      estado: 'en-ruta', hora_salida: hora, vehiculo, km_salida: km
    }).eq('id', activeRecorridoId)
    if (error) { alert('Error: ' + error.message); return }
    modalSalida.classList.remove('open')
    await load()
  }

  el.querySelector('#save-regreso').onclick = async () => {
    const km = parseInt(el.querySelector('#regreso-km').value)
    const r = currentRecorridos.find(x => x.id === activeRecorridoId)
    if (!km || !r || km <= r.km_salida) { alert('Ingresá un km de regreso válido'); return }
    const { error } = await supabase.from('recorridos').update({ estado: 'completado', km_regreso: km }).eq('id', activeRecorridoId)
    if (error) { alert('Error: ' + error.message); return }
    modalRegreso.classList.remove('open')
    await load()
  }

  el.querySelector('#despacho-content').addEventListener('click', async (e) => {
    const btn = e.target.closest('button')
    if (!btn) return

    if (btn.dataset.salida) {
      activeRecorridoId = parseInt(btn.dataset.salida)
      const r = currentRecorridos.find(x => x.id === activeRecorridoId)
      if (!r) return
      el.querySelector('#salida-title').textContent = 'Confirmar salida — ' + r.codigo
      el.querySelector('#salida-vehiculo').value = ''
      el.querySelector('#salida-km').value = ''
      modalSalida.classList.add('open')
      return
    }

    if (btn.dataset.regreso) {
      activeRecorridoId = parseInt(btn.dataset.regreso)
      const r = currentRecorridos.find(x => x.id === activeRecorridoId)
      if (!r) return
      el.querySelector('#regreso-resumen').innerHTML = `
        <strong style="color:#ccc">${r.codigo}</strong><br>
        Operario: ${r.operario} · Vehículo: ${r.vehiculo || '—'}<br>
        Salida: ${r.hora_salida || '—'} · Km salida: ${r.km_salida || '—'}`
      el.querySelector('#regreso-km').value = ''
      el.querySelector('#km-diff-preview').innerHTML = ''
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
    }
  })

  async function load() {
    let query = supabase.from('recorridos').select(`*, recorrido_pedidos(*)`).order('created_at', { ascending: false })
    if (currentUser.rol === 'operario') query = query.eq('operario', currentUser.nombre)
    const { data, error } = await query
    if (error) { console.error(error); return }
    currentRecorridos = data || []
    el.querySelector('#despacho-sub').textContent = currentRecorridos.length + ' recorrido' + (currentRecorridos.length !== 1 ? 's' : '')
    const content = el.querySelector('#despacho-content')
    if (currentRecorridos.length === 0) {
      content.innerHTML = '<div class="empty-state" style="padding:60px">Sin recorridos asignados hoy</div>'
      return
    }
    content.innerHTML = currentRecorridos.map(r => {
      const ent = r.recorrido_pedidos.filter(p => p.estado === 'entregado').length
      const tot = r.recorrido_pedidos.length
      const estBadge = r.estado === 'en-ruta' ? '<span class="badge badge-en-ruta">En ruta</span>' : r.estado === 'completado' ? '<span class="badge badge-completado">Completado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'
      return `<div style="background:#111;border:1px solid #1e1e1e;padding:16px 18px;margin-bottom:16px;border-radius:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:#fff;margin-bottom:4px">${r.codigo}</div>
            <div style="font-size:12px;color:#444">${estBadge} · Operario: <strong style="color:#666">${r.operario}</strong> · ${ent}/${tot} entregas${r.vehiculo ? ' · ' + r.vehiculo : ''}</div>
            <div style="font-size:11px;color:#333;margin-top:3px">Km salida: <span style="font-family:'DM Mono',monospace">${r.km_salida || '—'}</span> · Km regreso: <span style="font-family:'DM Mono',monospace">${r.km_regreso || '—'}</span>${r.km_salida && r.km_regreso ? ' · <span style="color:#52c452;font-family:\'DM Mono\',monospace">' + (r.km_regreso - r.km_salida) + ' km</span>' : ''}${r.hora_salida ? ' · Salida: ' + r.hora_salida : ''}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${r.estado === 'pendiente' ? `<button class="btn-sm orange" data-salida="${r.id}"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>` : ''}
            ${r.estado === 'en-ruta' && ent === tot && tot > 0 ? `<button class="btn-sm green" data-regreso="${r.id}"><i class="ti ti-home"></i> Confirmar regreso</button>` : ''}
          </div>
        </div>
        ${tot === 0 ? '<div style="color:#2a2a2a;font-size:12px;padding:8px 0">Sin pedidos en este recorrido</div>' :
        r.recorrido_pedidos.map(p => `
          <div class="pedido-card ${p.estado === 'entregado' ? 'entregado' : ''}">
            <div class="pedido-card-header">
              <div class="pedido-orden ${p.tipo || 'pyb'}">${p.orden}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px">${p.cliente_nombre}</div>
                <div style="font-size:11px;color:#444"><i class="ti ti-map-pin" style="font-size:10px"></i> ${p.direccion || '—'} · ${p.nota_pedido}${p.tipo === 'externo' ? ' · ' + (p.transporte_nombre || '') : ''}</div>
              </div>
              <div>${p.estado === 'pendiente' && r.estado === 'en-ruta' ? `<button class="btn-sm green" data-entregar="${p.id}"><i class="ti ti-check"></i> Entregado</button>` : p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>` : ''}</div>
            </div>
            ${p.estado === 'entregado' ? `<div class="pedido-entregado-info"><span style="color:#52c452;font-family:'DM Mono',monospace;font-size:11px"><i class="ti ti-clock" style="font-size:10px"></i> Entregado ${p.hora_entrega || ''}</span></div>` : ''}
          </div>`).join('')}
      </div>`
    }).join('')
  }

  await load()
}