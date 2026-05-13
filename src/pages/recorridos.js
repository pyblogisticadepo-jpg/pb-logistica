export async function renderRecorridos(el, { supabase, currentUser }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Recorridos</span><span class="page-subtitle" id="rec-sub"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-new-rec"><i class="ti ti-plus"></i> Nuevo recorrido</button>' : ''}
    </div>
    <div id="rec-list"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-new-rec">
      <div class="modal"><div class="modal-top-bar" style="background:#5aadee"></div>
        <div class="modal-header"><span class="modal-title">Nuevo recorrido</span><button class="modal-close" id="close-new-rec"><i class="ti ti-x"></i></button></div>
        <div class="modal-body">
          <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:12px 16px;border-radius:2px;font-size:12px;color:#3a6a3a;margin-bottom:16px;display:flex;gap:10px;">
            <i class="ti ti-info-circle" style="color:#52c452;flex-shrink:0"></i>
            <span>Solo pedidos <strong>habilitados</strong> con dirección cargada. Retira cliente se gestiona por separado.</span>
          </div>
          <div class="form-row"><label class="form-label">Seleccionar pedidos</label>
            <div id="pedidos-disponibles" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
          </div>
          <div class="form-row"><label class="form-label">Asignar operario <span class="req">*</span></label>
            <select class="form-select" id="rec-operario"></select>
          </div>
        </div>
        <div class="modal-footer"><button class="btn-cancel" id="cancel-new-rec">Cancelar</button><button class="btn-confirm" id="save-new-rec">Crear recorrido</button></div>
      </div>
    </div>`

  let selectedPedidos = []

  const modal = el.querySelector('#modal-new-rec')
  el.querySelector('#close-new-rec').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-new-rec').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  async function load() {
    let query = supabase.from('recorridos').select(`*, recorrido_pedidos(*)`).order('created_at', { ascending: false })
    if (currentUser.rol === 'operario') query = query.eq('operario', currentUser.nombre)
    const { data } = await query
    const recorridos = data || []
    el.querySelector('#rec-sub').textContent = recorridos.length + ' recorridos'
    const list = el.querySelector('#rec-list')
    if (recorridos.length === 0) { list.innerHTML = '<div class="empty-state">Sin recorridos</div>'; return }
    list.innerHTML = recorridos.map(r => {
      const ent = r.recorrido_pedidos.filter(p => p.estado === 'entregado').length
      const estBadge = r.estado === 'en-ruta' ? '<span class="badge badge-en-ruta">En ruta</span>' : r.estado === 'completado' ? '<span class="badge badge-completado">Completado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'
      return `<div class="recorrido-card">
        <div class="recorrido-card-header" data-toggle="${r.id}">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:12px;color:#444;margin-bottom:3px">${r.codigo}</div>
            <div style="font-size:13px;color:#ccc">Operario: <strong>${r.operario}</strong> · ${r.recorrido_pedidos.length} paradas · ${ent} entregadas · ${estBadge}${r.vehiculo ? ' · ' + r.vehiculo : ''}</div>
          </div>
          <i class="ti ti-chevron-down" style="color:#333;font-size:16px"></i>
        </div>
        <div class="recorrido-card-body" id="rbody-${r.id}">
          ${r.recorrido_pedidos.length === 0 ? '<div style="color:#2a2a2a;font-size:12px;padding:8px">Sin paradas</div>' :
          r.recorrido_pedidos.map(p => `
            <div class="recorrido-stop">
              <div class="stop-num ${p.tipo}">${p.orden}</div>
              <div style="flex:1">
                <div style="font-size:13px;color:#ccc;font-weight:500">${p.cliente_nombre}</div>
                <div style="font-size:11px;color:#333;margin-top:2px"><i class="ti ti-map-pin" style="font-size:10px"></i> ${p.direccion || '—'}${p.tipo === 'externo' ? ' · ' + (p.transporte_nombre || '') : ''}</div>
              </div>
              <div>${p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>` : '<span class="badge badge-pendiente" style="font-size:9px">Pendiente</span>'}</div>
            </div>`).join('')}
        </div>
      </div>`
    }).join('')
    list.querySelectorAll('[data-toggle]').forEach(header => {
      header.onclick = () => document.getElementById('rbody-' + header.dataset.toggle).classList.toggle('open')
    })
  }

  if (canEdit) {
    el.querySelector('#btn-new-rec').onclick = async () => {
      selectedPedidos = []
      const { data: enRuta } = await supabase.from('recorrido_pedidos').select('nota_pedido')
      const notasEnRuta = (enRuta || []).map(p => p.nota_pedido)
      const { data: pk } = await supabase.from('picking').select('id, nota_pedido, cliente_nombre, cliente_id').eq('estado', 'habilitado')
      const disponiblesPk = (pk || []).filter(p => !notasEnRuta.includes(p.nota_pedido))
      if (disponiblesPk.length === 0) {
        el.querySelector('#pedidos-disponibles').innerHTML = '<div style="color:#2a2a2a;font-size:12px;padding:10px">Sin pedidos habilitados disponibles</div>'
      } else {
        const clienteIds = [...new Set(disponiblesPk.map(p => p.cliente_id).filter(Boolean))]
        let clientesMap = {}
        if (clienteIds.length > 0) {
          const { data: clientes } = await supabase.from('clientes').select('id, nombre, direccion, transporte_tipo, transporte_id').in('id', clienteIds)
          ;(clientes || []).forEach(c => { clientesMap[c.id] = c })
        }
        const transporteIds = [...new Set(Object.values(clientesMap).map(c => c.transporte_id).filter(Boolean))]
        let transportesMap = {}
        if (transporteIds.length > 0) {
          const { data: transportes } = await supabase.from('transportes').select('id, nombre, direccion').in('id', transporteIds)
          ;(transportes || []).forEach(t => { transportesMap[t.id] = t })
        }
        const div = el.querySelector('#pedidos-disponibles')
        div.innerHTML = disponiblesPk.map(p => {
          const cliente = clientesMap[p.cliente_id] || {}
          const tipoTransporte = cliente.transporte_tipo || 'pyb'
          if (tipoTransporte === 'retira') return ''
          const esPyb = tipoTransporte === 'pyb'
          const transporte = transportesMap[cliente.transporte_id] || {}
          const direccion = esPyb ? (cliente.direccion || '') : (transporte.direccion || '')
          const tieneDir = !!direccion
          const tipoLabel = esPyb ? 'Entrega P&B' : 'Transp. ext.'
          return `<div data-pk="${p.id}" data-nota="${p.nota_pedido}" data-cliente="${p.cliente_nombre}" data-dir="${direccion}" data-tipo="${tipoTransporte}" data-transporte-nombre="${transporte.nombre || ''}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111;border:1px solid #1e1e1e;cursor:${tieneDir ? 'pointer' : 'not-allowed'};border-radius:2px;opacity:${tieneDir ? '1' : '0.4'}">
            <input type="checkbox" style="accent-color:#5aadee" ${tieneDir ? '' : 'disabled'}>
            <div>
              <div style="font-size:13px;color:#ccc;font-weight:500">${p.nota_pedido} — ${p.cliente_nombre}</div>
              <div style="font-size:11px;color:#444;margin-top:2px">${tipoLabel} · ${direccion || '<span style="color:#e05555">Sin dirección</span>'}</div>
            </div>
          </div>`
        }).join('')
        div.querySelectorAll('[data-pk]').forEach(item => {
          if (!item.dataset.dir) return
          item.onclick = () => {
            const id = item.dataset.pk
            const cb = item.querySelector('input[type=checkbox]')
            if (selectedPedidos.find(x => x.id === id)) {
              selectedPedidos = selectedPedidos.filter(x => x.id !== id)
              cb.checked = false
              item.style.borderColor = '#1e1e1e'
            } else {
              selectedPedidos.push({ id, nota: item.dataset.nota, cliente: item.dataset.cliente, dir: item.dataset.dir, tipo: item.dataset.tipo === 'pyb' ? 'pyb' : 'externo', transporteNombre: item.dataset.transporteNombre || null })
              cb.checked = true
              item.style.borderColor = '#5aadee'
            }
          }
        })
      }
      const { data: profiles } = await supabase.from('profiles').select('nombre,rol').eq('activo', true).in('rol', ['jefe','logistica','operario'])
      const sel = el.querySelector('#rec-operario')
      sel.innerHTML = '<option value="">— seleccionar —</option>' + (profiles || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')
      if (['logistica','operario'].includes(currentUser.rol)) sel.value = currentUser.nombre
      modal.classList.add('open')
    }

    el.querySelector('#save-new-rec').onclick = async () => {
      if (selectedPedidos.length === 0) { alert('Seleccioná al menos un pedido'); return }
      const operario = el.querySelector('#rec-operario').value
      if (!operario) { alert('Asigná un operario'); return }
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const { data: existing } = await supabase.from('recorridos').select('id').like('codigo', `RPT-${today}-%`)
      const num = String((existing?.length || 0) + 1).padStart(3, '0')
      const codigo = `RPT-${today}-${num}`
      const { data: rec, error: recError } = await supabase.from('recorridos').insert({ codigo, operario, estado: 'pendiente' }).select().single()
      if (recError || !rec) { alert('Error al crear recorrido: ' + (recError?.message || 'desconocido')); return }
      const pedidosInsert = selectedPedidos.map((p, i) => ({ recorrido_id: rec.id, nota_pedido: p.nota, cliente_nombre: p.cliente, direccion: p.dir || null, tipo: p.tipo, transporte_nombre: p.transporteNombre || null, orden: i + 1, estado: 'pendiente' }))
      const { error: pedError } = await supabase.from('recorrido_pedidos').insert(pedidosInsert)
      if (pedError) { alert('Error al agregar pedidos: ' + pedError.message); return }
      modal.classList.remove('open')
      selectedPedidos = []
      await load()
    }
  }

  await load()
}