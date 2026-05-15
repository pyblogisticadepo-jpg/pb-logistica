export async function renderDespacho(el, { supabase, currentUser, isObserver }) {
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
              <option value="vehiculo-personal">🚗 Vehículo personal</option>
            </select>
          </div>
          <div class="form-row" id="salida-km-wrap">
            <label class="form-label">Km de salida <span class="req">*</span></label>
            <input class="form-input" id="salida-km" type="number" placeholder="Ej: 45820">
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
          <div class="form-row" id="regreso-km-wrap">
            <label class="form-label">Km de regreso <span class="req">*</span></label>
            <input class="form-input" id="regreso-km" type="number" placeholder="Ej: 45951">
          </div>
          <div id="km-diff-preview" style="font-size:12px;margin-top:8px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-regreso">Cancelar</button>
          <button class="btn-confirm" id="save-regreso"><i class="ti ti-home"></i> Confirmar regreso</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-no-entregado">
      <div class="modal"><div class="modal-top-bar" style="background:#e05555"></div>
        <div class="modal-header">
          <span class="modal-title">No se pudo entregar</span>
          <button class="modal-close" id="close-no-entregado"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="background:#1f0d0d;border:1px solid #3a1a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#8a3a3a;margin-bottom:20px;">
            El pedido volverá a estado <strong>habilitado</strong> y quedará disponible para asignar a un nuevo recorrido.
          </div>
          <div class="form-row">
            <label class="form-label">Motivo <span class="req">*</span></label>
            <select class="form-select" id="no-entregado-motivo">
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
            <textarea class="form-textarea" id="no-entregado-obs" placeholder="Detalle adicional..." style="min-height:60px;resize:none"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-no-entregado">Cancelar</button>
          <button class="btn-confirm" style="background:#e05555" id="save-no-entregado"><i class="ti ti-arrow-back"></i> Registrar y devolver</button>
        </div>
      </div>
    </div>`

  const modalSalida = el.querySelector('#modal-salida')
  const modalRegreso = el.querySelector('#modal-regreso')
  const modalNoEntregado = el.querySelector('#modal-no-entregado')
  let activeRecorridoId = null
  let activePedidoId = null
  let currentRecorridos = []

  ;['close-salida','cancel-salida'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalSalida.classList.remove('open')
  })
  ;['close-regreso','cancel-regreso'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalRegreso.classList.remove('open')
  })
  ;['close-no-entregado','cancel-no-entregado'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalNoEntregado.classList.remove('open')
  })
  modalSalida.onclick = (e) => { if (e.target === modalSalida) modalSalida.classList.remove('open') }
  modalRegreso.onclick = (e) => { if (e.target === modalRegreso) modalRegreso.classList.remove('open') }
  modalNoEntregado.onclick = (e) => { if (e.target === modalNoEntregado) modalNoEntregado.classList.remove('open') }

  // Ocultar km cuando es vehículo personal
  el.querySelector('#salida-vehiculo').onchange = () => {
    const esPersonal = el.querySelector('#salida-vehiculo').value === 'vehiculo-personal'
    el.querySelector('#salida-km-wrap').style.display = esPersonal ? 'none' : 'block'
  }

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
    if (!vehiculo) { alert('Seleccioná un vehículo'); return }
    const esPersonal = vehiculo === 'vehiculo-personal'
    const km = esPersonal ? null : parseInt(el.querySelector('#salida-km').value)
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

  el.querySelector('#save-regreso').onclick = async () => {
    const r = currentRecorridos.find(x => x.id === activeRecorridoId)
    const esPersonal = r?.vehiculo === 'Vehículo personal'
    const km = esPersonal ? null : parseInt(el.querySelector('#regreso-km').value)
    if (!esPersonal && (!km || km <= r.km_salida)) { alert('Ingresá un km de regreso válido'); return }
    const { error } = await supabase.from('recorridos').update({ estado: 'completado', km_regreso: km }).eq('id', activeRecorridoId)
    if (error) { alert('Error: ' + error.message); return }
    if (!esPersonal && r.vehiculo) await supabase.from('vehiculos').update({ en_uso: false, km_actual: km }).eq('nombre', r.vehiculo)
    modalRegreso.classList.remove('open')
    await load()
  }

  el.querySelector('#save-no-entregado').onclick = async () => {
    const motivo = el.querySelector('#no-entregado-motivo').value
    if (!motivo) { alert('Seleccioná un motivo'); return }
    const obs = el.querySelector('#no-entregado-obs').value.trim()
    await supabase.from('recorrido_pedidos').update({
      estado: 'pendiente',
      observaciones: motivo + (obs ? ': ' + obs : '')
    }).eq('id', activePedidoId)
    modalNoEntregado.classList.remove('open')
    await load()
  }

  el.querySelector('#despacho-content').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-salida], button[data-regreso], button[data-entregar], button[data-no-entregar], button[data-marcar-retiro]')
    if (!btn) return

    if (btn.dataset.salida) {
      activeRecorridoId = parseInt(btn.dataset.salida)
      const r = currentRecorridos.find(x => x.id === activeRecorridoId)
      if (!r) return
      el.querySelector('#salida-title').textContent = 'Confirmar salida — ' + r.codigo
      el.querySelector('#salida-vehiculo').value = ''
      el.querySelector('#salida-km').value = ''
      el.querySelector('#salida-km-wrap').style.display = 'block'
      modalSalida.classList.add('open')
      return
    }

    if (btn.dataset.regreso) {
      activeRecorridoId = parseInt(btn.dataset.regreso)
      const r = currentRecorridos.find(x => x.id === activeRecorridoId)
      if (!r) return
      const esPersonal = r.vehiculo === 'Vehículo personal'
      el.querySelector('#regreso-resumen').innerHTML = `
        <strong style="color:#ccc">${r.codigo}</strong><br>
        Operario: ${r.operario} · Vehículo: ${r.vehiculo || '—'}<br>
        Salida: ${r.hora_salida || '—'} · Km salida: ${r.km_salida || '—'}`
      el.querySelector('#regreso-km').value = ''
      el.querySelector('#km-diff-preview').innerHTML = ''
      el.querySelector('#regreso-km-wrap').style.display = esPersonal ? 'none' : 'block'
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
      el.querySelector('#no-entregado-motivo').value = ''
      el.querySelector('#no-entregado-obs').value = ''
      modalNoEntregado.classList.add('open')
      return
    }

    if (btn.dataset.marcarRetiro) {
      const pickingId = parseInt(btn.dataset.marcarRetiro)
      const hora = new Date().toTimeString().slice(0,5)
      const fecha = new Date().toISOString().split('T')[0]
      const { data: pk } = await supabase.from('picking').select('nota_pedido, cliente_nombre, documentacion').eq('id', pickingId).single()
      if (!pk) return
      await supabase.from('retiras').insert({
        nota_pedido: pk.nota_pedido,
        cliente_nombre: pk.cliente_nombre,
        documentacion: pk.documentacion,
        estado: 'retirado',
        hora_retiro: hora,
        fecha
      })
      await load()
    }
  })

  async function load() {
    let query = supabase.from('recorridos').select(`*, recorrido_pedidos(*)`).order('created_at', { ascending: false })
    if (currentUser.rol === 'operario') query = query.eq('operario', currentUser.nombre)
    const { data: recData } = await query
    currentRecorridos = recData || []

    const { data: allPicking } = await supabase.from('picking').select('*, clientes(transporte_tipo, transporte_id)').eq('estado', 'habilitado')
    const notasEnRecorrido = currentRecorridos.flatMap(r => r.recorrido_pedidos.map(p => p.nota_pedido))

    const pedidosRetiro = (allPicking || []).filter(p => {
      if (notasEnRecorrido.includes(p.nota_pedido)) return false
      const tipo = p.clientes?.transporte_tipo
      if (tipo === 'retira') return true
      return false
    })

    const today = new Date().toISOString().split('T')[0]
    const { data: retirasHoy } = await supabase.from('retiras').select('*').eq('fecha', today)
    const notasYaRetiradas = (retirasHoy || []).map(r => r.nota_pedido)
    const pendientesRetiro = pedidosRetiro.filter(p => !notasYaRetiradas.includes(p.nota_pedido))
    const despachadosRetiro = retirasHoy || []

    const content = el.querySelector('#despacho-content')
    el.querySelector('#despacho-sub').textContent = currentRecorridos.length + ' recorrido' + (currentRecorridos.length !== 1 ? 's' : '')

    let html = ''

    if (currentRecorridos.length === 0 && pendientesRetiro.length === 0 && despachadosRetiro.length === 0) {
      html = '<div class="empty-state" style="padding:60px">Sin actividad de despacho hoy</div>'
    }

    html += currentRecorridos.map(r => {
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
            ${!isObserver && r.estado === 'pendiente' ? `<button class="btn-sm orange" data-salida="${r.id}"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>` : ''}
            ${!isObserver && r.estado === 'en-ruta' && ent === tot && tot > 0 ? `<button class="btn-sm green" data-regreso="${r.id}"><i class="ti ti-home"></i> Confirmar regreso</button>` : ''}
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
                ${p.observaciones ? `<div style="font-size:11px;color:#e05555;margin-top:3px"><i class="ti ti-alert-circle" style="font-size:10px"></i> ${p.observaciones}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                ${!isObserver && p.estado === 'pendiente' && r.estado === 'en-ruta' ? `
                  <button class="btn-sm green" data-entregar="${p.id}"><i class="ti ti-check"></i> Entregado</button>
                  <button class="btn-sm" style="border-color:#3a1a1a;color:#e05555" data-no-entregar="${p.id}"><i class="ti ti-x"></i> No entregado</button>
                ` : p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>` : ''}
              </div>
            </div>
            ${p.estado === 'entregado' ? `<div class="pedido-entregado-info"><span style="color:#52c452;font-family:'DM Mono',monospace;font-size:11px"><i class="ti ti-clock" style="font-size:10px"></i> Entregado ${p.hora_entrega || ''}</span></div>` : ''}
          </div>`).join('')}
      </div>`
    }).join('')

    if (pendientesRetiro.length > 0) {
      html += `<div class="section-label" style="margin-top:24px">Retiros pendientes</div>`
      html += pendientesRetiro.map(p => {
        const tipo = p.clientes?.transporte_tipo
        const esRetiraCliente = tipo === 'retira'
        const label = esRetiraCliente ? 'Retira cliente' : 'Retira transporte'
        const color = esRetiraCliente ? '#4dd4d4' : '#d4a830'
        const borderColor = esRetiraCliente ? '#1a3636' : '#2c2400'
        return `<div style="background:#111;border:1px solid ${borderColor};padding:14px 16px;margin-bottom:8px;border-radius:2px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1">
            <div style="font-size:13px;color:#ccc;font-weight:500">${p.cliente_nombre} <span style="font-size:10px;color:${color};margin-left:6px">${label}</span></div>
            <div style="font-size:11px;color:#444;margin-top:2px">${p.nota_pedido} · Doc: ${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion || '—'}</div>
          </div>
          ${!isObserver ? `<button class="btn-sm green" data-marcar-retiro="${p.id}"><i class="ti ti-check"></i> Marcar retirado</button>` : ''}
        </div>`
      }).join('')
    }

    if (despachadosRetiro.length > 0) {
      html += `<div class="section-label" style="margin-top:24px">Retirados hoy</div>`
      html += despachadosRetiro.map(r => `
        <div style="background:#0d1e0d;border:1px solid #1a361a;padding:12px 16px;margin-bottom:8px;border-radius:2px;display:flex;align-items:center;gap:12px;opacity:.8">
          <div style="flex:1">
            <div style="font-size:13px;color:#52c452;font-weight:500">${r.cliente_nombre}</div>
            <div style="font-size:11px;color:#2a5a2a;margin-top:2px">${r.nota_pedido} · Retirado: ${r.hora_retiro || '—'}</div>
          </div>
          <span class="badge badge-ok" style="font-size:9px">✓ Retirado</span>
        </div>`).join('')
    }

    content.innerHTML = html
  }

  await load()
}