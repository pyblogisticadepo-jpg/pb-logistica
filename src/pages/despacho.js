export async function renderDespacho(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Despacho</span><span class="page-subtitle" id="despacho-sub"></span></div>
    </div>
    ${!canEdit ? '<div class="observer-badge"><i class="ti ti-eye"></i> Solo lectura</div>' : ''}
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
              <option>Kangoo blanca</option>
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
      const rechazados = r.recorrido_pedidos.filter(p => p.estado === 'pendiente' && p.observaciones).length
      el.querySelector('#regreso-resumen').innerHTML = `
        <strong style="color:#ccc">${r.codigo}</strong><br>
        Operario: ${r.operario} · Vehículo: ${r.vehiculo || '—'}<br>
        Salida: ${r.hora_salida || '—'} · Km salida: ${r.km_salida || '—'}
        ${rechazados > 0 ? `<br><span style="color:#e05555;font-size:12px"><i class="ti ti-alert-circle"></i> ${rechazados} pedido${rechazados > 1 ? 's' : ''} no entregado${rechazados > 1 ? 's' : ''} — volverán a entregas pendientes</span>` : ''}`
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
      const { data: pk } = await supabase.from('picking').select('nota_pedido, cliente_nombre, documentacion, cliente_id, codigo_interno').eq('id', pickingId).single()
      if (!pk) return
      let yaRetirado = null
      if (pk.codigo_interno) {
        const { data } = await supabase.from('retiras').select('id').eq('codigo_interno', pk.codigo_interno).maybeSingle()
        yaRetirado = data
      } else {
        const { data } = await supabase.from('retiras').select('id').eq('nota_pedido', pk.nota_pedido).maybeSingle()
        yaRetirado = data
      }
      if (yaRetirado) { alert('Este pedido ya fue marcado como retirado anteriormente'); return }

      let transporteNombre = null
      if (pk.cliente_id) {
        const { data: cliente } = await supabase.from('clientes').select('transporte_tipo, transporte_id').eq('id', pk.cliente_id).single()
        if (cliente?.transporte_tipo === 'externo' && cliente?.transporte_id) {
          const { data: transp } = await supabase.from('transportes').select('nombre').eq('id', cliente.transporte_id).single()
          transporteNombre = transp?.nombre || null
        }
      }

      await supabase.from('retiras').insert({
        nota_pedido: pk.nota_pedido,
        codigo_interno: pk.codigo_interno || null,
        cliente_nombre: pk.cliente_nombre,
        documentacion: pk.documentacion,
        estado: 'retirado',
        hora_retiro: hora,
        fecha,
        transporte_nombre: transporteNombre
      })
      await load()
    }
  })

  async function limpiarRechazadosHuerfanos() {
    const { data: recCompletados } = await supabase.from('recorridos').select('id').eq('estado', 'completado')
    if (!recCompletados || recCompletados.length === 0) return
    const idsCompletados = recCompletados.map(r => r.id)
    const { data: rechazadosHuerfanos } = await supabase
      .from('recorrido_pedidos').select('id, nota_pedido, codigo_interno')
      .eq('estado', 'pendiente').not('observaciones', 'is', null).in('recorrido_id', idsCompletados)
    if (!rechazadosHuerfanos || rechazadosHuerfanos.length === 0) return
    for (const p of rechazadosHuerfanos) {
      if (p.codigo_interno) {
        await supabase.from('picking').update({ estado: 'habilitado' }).eq('codigo_interno', p.codigo_interno)
      } else {
        await supabase.from('picking').update({ estado: 'habilitado' }).eq('nota_pedido', p.nota_pedido)
      }
    }
  }

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    await limpiarRechazadosHuerfanos()

    const { data: recData } = await supabase
      .from('recorridos').select(`*, recorrido_pedidos(*)`)
      .or(`fecha.eq.${today},estado.eq.en-ruta`)
      .order('created_at', { ascending: false })
    currentRecorridos = recData || []

    // Pedidos sin documentos (preparacion o armado)
    const { data: sinDocs } = await supabase
      .from('picking')
      .select('id, nota_pedido, codigo_interno, cliente_nombre, estado, lineas')
      .in('estado', ['preparacion', 'armado'])
      .order('hora_registro', { ascending: false })

    const { data: allPicking } = await supabase
      .from('picking').select('id, nota_pedido, codigo_interno, cliente_nombre, cliente_id, documentacion')
      .eq('estado', 'habilitado')

    const clienteIds = [...new Set((allPicking || []).map(p => p.cliente_id).filter(Boolean))]
    let clientesMap = {}
    if (clienteIds.length > 0) {
      const { data: clientes } = await supabase.from('clientes').select('id, transporte_tipo, transporte_id').in('id', clienteIds)
      ;(clientes || []).forEach(c => { clientesMap[c.id] = c })
    }

    const { data: transportesRetira } = await supabase.from('transportes').select('id, nombre').eq('retira_deposito', true)
    const idsRetiraDeposito = new Set((transportesRetira || []).map(t => t.id))
    const transportesRetiraMap = {}
    ;(transportesRetira || []).forEach(t => { transportesRetiraMap[t.id] = t.nombre })

    const { data: todosEntregados } = await supabase.from('recorrido_pedidos').select('nota_pedido, codigo_interno').eq('estado', 'entregado')
    const codigosYaEntregados = new Set((todosEntregados || []).map(p => p.codigo_interno).filter(Boolean))
    const notasYaEntregadas = new Set((todosEntregados || []).map(p => p.nota_pedido).filter(Boolean))

    const notasEnRecorridoActivo = currentRecorridos.filter(r => r.estado !== 'completado').flatMap(r => r.recorrido_pedidos.map(p => p.nota_pedido))
    const codigosEnRecorridoActivo = new Set(currentRecorridos.filter(r => r.estado !== 'completado').flatMap(r => r.recorrido_pedidos.map(p => p.codigo_interno).filter(Boolean)))

    const { data: todasRetiras } = await supabase.from('retiras').select('nota_pedido, codigo_interno')
    const codigosYaRetirados = new Set((todasRetiras || []).map(r => r.codigo_interno).filter(Boolean))
    const notasYaRetiradas = new Set((todasRetiras || []).map(r => r.nota_pedido).filter(Boolean))

    const retirosPendientes = []
    const entregasPendientes = []

    ;(allPicking || []).forEach(p => {
      if (p.codigo_interno ? codigosYaEntregados.has(p.codigo_interno) : notasYaEntregadas.has(p.nota_pedido)) return
      if (p.codigo_interno ? codigosEnRecorridoActivo.has(p.codigo_interno) : notasEnRecorridoActivo.includes(p.nota_pedido)) return
      if (p.codigo_interno ? codigosYaRetirados.has(p.codigo_interno) : notasYaRetiradas.has(p.nota_pedido)) return
      const cliente = clientesMap[p.cliente_id]
      if (!cliente) return
      const tipo = cliente.transporte_tipo
      if (tipo === 'retira') {
        retirosPendientes.push({ ...p, _label: 'Retira cliente', _color: '#4dd4d4', _border: '#1a3636' })
      } else if (tipo === 'externo' && idsRetiraDeposito.has(cliente.transporte_id)) {
        retirosPendientes.push({ ...p, _label: `Retira ${transportesRetiraMap[cliente.transporte_id] || 'transporte'}`, _color: '#d4a830', _border: '#2c2400' })
      } else if (tipo === 'pyb' || tipo === 'externo') {
        entregasPendientes.push({ ...p, _label: tipo === 'pyb' ? 'Entrega P&B' : 'Transp. ext.', _color: '#a78bfa', _border: '#2d1a52' })
      }
    })

    const { data: retirasHoy } = await supabase.from('retiras').select('*').eq('fecha', today)
    const despachadosRetiro = retirasHoy || []

    const content = el.querySelector('#despacho-content')
    const totalPendientes = retirosPendientes.length + entregasPendientes.length
    el.querySelector('#despacho-sub').textContent = `${currentRecorridos.length} recorrido${currentRecorridos.length !== 1 ? 's' : ''} · ${totalPendientes} pendiente${totalPendientes !== 1 ? 's' : ''}`

    let html = ''

    // SECCION SIN DOCUMENTOS
    if (sinDocs && sinDocs.length > 0) {
      html += `<div class="section-label" style="margin-top:0">Sin documentos</div>`
      html += sinDocs.map(p => {
        const estadoLabel = p.estado === 'preparacion'
          ? '<span class="badge badge-preparacion">En preparación</span>'
          : '<span class="badge badge-armado">Armado</span>'
        const faltaLabel = p.estado === 'preparacion'
          ? 'Falta completar armado y documentos'
          : 'Falta documentación para habilitar'
        return `<div style="background:#111;border:1px solid #1a1a1a;padding:12px 16px;margin-bottom:8px;border-radius:2px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1">
            <div style="font-size:13px;color:#ccc;font-weight:500">${p.cliente_nombre} ${estadoLabel}</div>
            <div style="font-size:11px;color:#555;margin-top:2px">
              ${p.codigo_interno ? `<span style="font-family:'DM Mono',monospace;color:#5aadee">${p.codigo_interno}</span> · ` : ''}
              ${p.nota_pedido} · ${p.lineas} líneas
            </div>
          </div>
          <span style="font-size:10px;color:#555;text-align:right;line-height:1.5">${faltaLabel}</span>
        </div>`
      }).join('')
    }

    if (entregasPendientes.length > 0) {
      html += `<div class="section-label" style="margin-top:${sinDocs?.length > 0 ? '24px' : '0'}">Entregas pendientes de recorrido</div>`
      html += entregasPendientes.map(p => `
        <div style="background:#111;border:1px solid ${p._border};padding:14px 16px;margin-bottom:8px;border-radius:2px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1">
            <div style="font-size:13px;color:#ccc;font-weight:500">${p.cliente_nombre} <span style="font-size:10px;color:${p._color};margin-left:6px">${p._label}</span></div>
            <div style="font-size:11px;color:#555;margin-top:2px">
              ${p.codigo_interno ? `<span style="font-family:'DM Mono',monospace;color:#5aadee">${p.codigo_interno}</span> · ` : ''}
              ${p.nota_pedido} · Doc: ${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion || '—'}
            </div>
          </div>
          <span style="font-size:10px;color:#555;letter-spacing:1px">Sin recorrido</span>
        </div>`).join('')
    }

    if (retirosPendientes.length > 0) {
      html += `<div class="section-label" style="margin-top:${entregasPendientes.length > 0 || sinDocs?.length > 0 ? '24px' : '0'}">Retiros pendientes</div>`
      html += retirosPendientes.map(p => `
        <div style="background:#111;border:1px solid ${p._border};padding:14px 16px;margin-bottom:8px;border-radius:2px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1">
            <div style="font-size:13px;color:#ccc;font-weight:500">${p.cliente_nombre} <span style="font-size:10px;color:${p._color};margin-left:6px">${p._label}</span></div>
            <div style="font-size:11px;color:#555;margin-top:2px">
              ${p.codigo_interno ? `<span style="font-family:'DM Mono',monospace;color:#5aadee">${p.codigo_interno}</span> · ` : ''}
              ${p.nota_pedido} · Doc: ${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion || '—'}
            </div>
          </div>
          ${canEdit ? `<button class="btn-sm green" data-marcar-retiro="${p.id}"><i class="ti ti-check"></i> Marcar retirado</button>` : ''}
        </div>`).join('')
    }

    if (despachadosRetiro.length > 0) {
      html += `<div class="section-label" style="margin-top:${retirosPendientes.length > 0 || entregasPendientes.length > 0 || sinDocs?.length > 0 ? '24px' : '0'}">Retirados hoy</div>`
      html += despachadosRetiro.map(r => `
        <div style="background:#0d1e0d;border:1px solid #1a361a;padding:12px 16px;margin-bottom:8px;border-radius:2px;display:flex;align-items:center;gap:12px;opacity:.8">
          <div style="flex:1">
            <div style="font-size:13px;color:#52c452;font-weight:500">${r.cliente_nombre}</div>
            <div style="font-size:11px;color:#2a5a2a;margin-top:2px">${r.codigo_interno || r.nota_pedido}${r.transporte_nombre ? ' · ' + r.transporte_nombre : ''} · Retirado: ${r.hora_retiro || '—'}</div>
          </div>
          <span class="badge badge-ok" style="font-size:9px">✓ Retirado</span>
        </div>`).join('')
    }

    if (currentRecorridos.length > 0) {
      const hasAbove = sinDocs?.length > 0 || entregasPendientes.length > 0 || retirosPendientes.length > 0 || despachadosRetiro.length > 0
      html += `<div class="section-label" style="margin-top:${hasAbove ? '24px' : '0'}">Recorridos de hoy</div>`
      html += currentRecorridos.map(r => {
        const ent = r.recorrido_pedidos.filter(p => p.estado === 'entregado').length
        const tot = r.recorrido_pedidos.length
        const rechazados = r.recorrido_pedidos.filter(p => p.estado === 'pendiente' && p.observaciones).length
        const listoParaRegresar = r.estado === 'en-ruta' && (ent + rechazados === tot) && tot > 0
        const estBadge = r.estado === 'en-ruta' ? '<span class="badge badge-en-ruta">En ruta</span>' : r.estado === 'completado' ? '<span class="badge badge-completado">Completado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'
        return `<div style="background:#111;border:1px solid #1e1e1e;padding:16px 18px;margin-bottom:16px;border-radius:2px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div>
              <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:#fff;margin-bottom:4px">${r.codigo}</div>
              <div style="font-size:12px;color:#555">${estBadge} · Operario: <strong style="color:#888">${r.operario}</strong> · ${ent}/${tot} entregas${rechazados > 0 ? ` · <span style="color:#e05555">${rechazados} rechazado${rechazados > 1 ? 's' : ''}</span>` : ''}${r.vehiculo ? ' · ' + r.vehiculo : ''}</div>
              <div style="font-size:11px;color:#444;margin-top:3px">Km salida: <span style="font-family:'DM Mono',monospace">${r.km_salida || '—'}</span> · Km regreso: <span style="font-family:'DM Mono',monospace">${r.km_regreso || '—'}</span>${r.km_salida && r.km_regreso ? ' · <span style="color:#52c452;font-family:\'DM Mono\',monospace">' + (r.km_regreso - r.km_salida) + ' km</span>' : ''}${r.hora_salida ? ' · Salida: ' + r.hora_salida : ''}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${canEdit && r.estado === 'pendiente' ? `<button class="btn-sm orange" data-salida="${r.id}"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>` : ''}
              ${canEdit && listoParaRegresar ? `<button class="btn-sm green" data-regreso="${r.id}"><i class="ti ti-home"></i> Confirmar regreso</button>` : ''}
            </div>
          </div>
          ${tot === 0 ? '<div style="color:#444;font-size:12px;padding:8px 0">Sin pedidos en este recorrido</div>' :
          r.recorrido_pedidos.map(p => `
            <div class="pedido-card ${p.estado === 'entregado' ? 'entregado' : p.observaciones ? 'rechazado' : ''}">
              <div class="pedido-card-header">
                <div class="pedido-orden ${p.tipo || 'pyb'}">${p.orden}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px">${p.cliente_nombre}</div>
                  <div style="font-size:11px;color:#555">
                    ${p.codigo_interno ? `<span style="font-family:'DM Mono',monospace;color:#5aadee;font-size:10px">${p.codigo_interno}</span> · ` : ''}
                    <i class="ti ti-map-pin" style="font-size:10px"></i> ${p.direccion || '—'} · ${p.nota_pedido}${p.tipo === 'externo' ? ' · ' + (p.transporte_nombre || '') : ''}
                  </div>
                  ${p.observaciones ? `<div style="font-size:11px;color:#e05555;margin-top:3px"><i class="ti ti-alert-circle" style="font-size:10px"></i> ${p.observaciones}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                  ${canEdit && p.estado === 'pendiente' && !p.observaciones && r.estado === 'en-ruta' ? `
                    <button class="btn-sm green" data-entregar="${p.id}"><i class="ti ti-check"></i> Entregado</button>
                    <button class="btn-sm" style="border-color:#3a1a1a;color:#e05555" data-no-entregar="${p.id}"><i class="ti ti-x"></i> No entregado</button>
                  ` : p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>`
                    : p.observaciones ? `<span class="badge" style="background:#2a0a0a;color:#e05555;font-size:9px">✗ Rechazado</span>` : ''}
                </div>
              </div>
              ${p.estado === 'entregado' ? `<div class="pedido-entregado-info"><span style="color:#52c452;font-family:'DM Mono',monospace;font-size:11px"><i class="ti ti-clock" style="font-size:10px"></i> Entregado ${p.hora_entrega || ''}</span></div>` : ''}
            </div>`).join('')}
        </div>`
      }).join('')
    }

    if (currentRecorridos.length === 0 && retirosPendientes.length === 0 && entregasPendientes.length === 0 && despachadosRetiro.length === 0 && (!sinDocs || sinDocs.length === 0)) {
      html = '<div class="empty-state" style="padding:60px">Sin actividad de despacho hoy</div>'
    }

    content.innerHTML = html
  }

  await load()
}