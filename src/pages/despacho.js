let despachoInterval = null

async function subirFotoRemito(supabase, file, codigoRef) {
  const ext = file.name.split('.').pop() || 'jpg'
  const nombreArchivo = ${codigoRef}_${Date.now()}.${ext}
  const { error } = await supabase.storage.from('Remitos').upload(nombreArchivo, file)
  if (error) return null
  const { data } = supabase.storage.from('Remitos').getPublicUrl(nombreArchivo)
  return data?.publicUrl || null
}

export async function renderDespacho(el, { supabase, currentUser, isObserver }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)

  if (despachoInterval) { clearInterval(despachoInterval); despachoInterval = null }

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
    </div>

    <div class="modal-overlay" id="modal-foto-retiro">
      <div class="modal"><div class="modal-top-bar" style="background:#4dd4d4"></div>
        <div class="modal-header">
          <span class="modal-title" id="foto-retiro-title">Foto del remito</span>
          <button class="modal-close" id="close-foto-retiro"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:10px 14px;border-radius:2px;font-size:12px;color:#3a6a3a;margin-bottom:16px;">
            <i class="ti ti-info-circle" style="font-size:11px"></i> Es obligatorio adjuntar al menos una foto del remito para confirmar el retiro.
          </div>
          <input type="file" accept="image/*" capture="environment" id="foto-retiro-input" style="display:none">
          <button class="btn-confirm" style="width:100%;margin-bottom:14px" id="foto-retiro-tomar"><i class="ti ti-camera"></i> Tomar / subir foto</button>
          <div id="foto-retiro-lista" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-foto-retiro">Cancelar</button>
          <button class="btn-confirm" style="background:#4dd4d4;color:#000" id="confirmar-foto-retiro"><i class="ti ti-check"></i> Confirmar retiro</button>
        </div>
      </div>
    </div>`

  const modalSalida = el.querySelector('#modal-salida')
  const modalRegreso = el.querySelector('#modal-regreso')
  const modalNoEntregado = el.querySelector('#modal-no-entregado')
  const modalFotoRetiro = el.querySelector('#modal-foto-retiro')
  let activeRecorridoId = null
  let activePedidoId = null
  let currentRecorridos = []
  let pickingRetiroActivo = null
  let fotosRetiroTemp = []

  ;['close-salida','cancel-salida'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalSalida.classList.remove('open')
  })
  ;['close-regreso','cancel-regreso'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalRegreso.classList.remove('open')
  })
  ;['close-no-entregado','cancel-no-entregado'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalNoEntregado.classList.remove('open')
  })
  ;['close-foto-retiro','cancel-foto-retiro'].forEach(id => {
    el.querySelector('#' + id).onclick = () => modalFotoRetiro.classList.remove('open')
  })
  modalSalida.onclick = (e) => { if (e.target === modalSalida) modalSalida.classList.remove('open') }
  modalRegreso.onclick = (e) => { if (e.target === modalRegreso) modalRegreso.classList.remove('open') }
  modalNoEntregado.onclick = (e) => { if (e.target === modalNoEntregado) modalNoEntregado.classList.remove('open') }
  modalFotoRetiro.onclick = (e) => { if (e.target === modalFotoRetiro) modalFotoRetiro.classList.remove('open') }

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
        ? <span style="color:#52c452">Km recorridos: ${diff} km</span>
        : <span style="color:#e05555">El km de regreso debe ser mayor al de salida</span>
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

  function renderFotosRetiroTemp() {
    const lista = el.querySelector('#foto-retiro-lista')
    if (fotosRetiroTemp.length === 0) {
      lista.innerHTML = '<div style="color:#444;font-size:12px;text-align:center;padding:10px">Sin fotos cargadas todavía</div>'
      return
    }
    lista.innerHTML = fotosRetiroTemp.map((url, i) => `
      <div style="display:flex;align-items:center;gap:10px;background:#111;border:1px solid #1e1e1e;padding:8px 10px;border-radius:2px;">
        <img src="${url}" style="width:48px;height:48px;object-fit:cover;border-radius:2px;border:1px solid #222;">
        <span style="flex:1;font-size:12px;color:#888">Foto ${i + 1}</span>
      </div>`).join('')
  }

  el.querySelector('#foto-retiro-tomar').onclick = () => el.querySelector('#foto-retiro-input').click()
  el.querySelector('#foto-retiro-input').onchange = async (e) => {
    const file = e.target.files[0]
    if (!file || !pickingRetiroActivo) return
    const url = await subirFotoRemito(supabase, file, pickingRetiroActivo.codigo_interno || pickingRetiroActivo.nota_pedido)
    if (!url) { alert('No se pudo subir la foto. Revisá tu conexión.'); return }
    fotosRetiroTemp.push(url)
    renderFotosRetiroTemp()
    e.target.value = ''
  }

  el.querySelector('#confirmar-foto-retiro').onclick = async () => {
    if (fotosRetiroTemp.length === 0) { alert('Agregá al menos una foto del remito'); return }
    const pk = pickingRetiroActivo
    const hora = new Date().toTimeString().slice(0,5)
    const fecha = new Date().toISOString().split('T')[0]

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
      transporte_nombre: transporteNombre,
      foto_remito: fotosRetiroTemp.join(',')
    })
    modalFotoRetiro.classList.remove('open')
    pickingRetiroActivo = null
    fotosRetiroTemp = []
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
        ${rechazados > 0 ? <br><span style="color:#e05555;font-size:12px"><i class="ti ti-alert-circle"></i> ${rechazados} pedido${rechazados > 1 ? 's' : ''} no entregado${rechazados > 1 ? 's' : ''} — volverán a entregas pendientes</span> : ''}`
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

      pickingRetiroActivo = pk
      fotosRetiroTemp = []
      el.querySelector('#foto-retiro-title').textContent = 'Foto del remito — ' + pk.cliente_nombre
      renderFotosRetiroTemp()
      modalFotoRetiro.classList.add('open')
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
      .from('recorridos').select(*, recorrido_pedidos(*))
      .or(fecha.eq.${today},estado.eq.en-ruta)
      .order('created_at', { ascending: false })
    currentRecorridos = recData || []

    const { data: sinDocs } = await supabase
      .from('picking')
      .select('id, nota_pedido, codigo_interno, cliente_nombre, estado, lineas')
      .in('estado', ['preparacion', 'armado'])
      .order('hora_registro', { ascending: false })