export async function renderResumen(el, { supabase, currentUser }) {
  const today = new Date().toISOString().split('T')[0]
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Resumen diario</span></div>
    </div>
    <div class="date-picker-row">
      <span class="date-picker-label">Fecha</span>
      <input type="date" class="date-picker-input" id="resumen-date" value="${today}">
      <span style="font-size:11px;color:#333" id="resumen-hoy-label">(hoy)</span>
    </div>
    <div class="section-label" style="margin-top:0">Pedidos del día</div>
    <div id="resumen-table-wrap"><div class="loading">Cargando...</div></div>
    <div class="section-label">Totales</div>
    <div class="stat-grid" id="resumen-stats"></div>

    <div class="modal-overlay" id="modal-detalle">
      <div class="modal"><div class="modal-top-bar"></div>
        <div class="modal-header">
          <span class="modal-title" id="detalle-title">Detalle del pedido</span>
          <button class="modal-close" id="close-detalle"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" id="detalle-body"></div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-detalle">Cerrar</button>
        </div>
      </div>
    </div>`

  const modalDetalle = el.querySelector('#modal-detalle')
  el.querySelector('#close-detalle').onclick = () => modalDetalle.classList.remove('open')
  el.querySelector('#cancel-detalle').onclick = () => modalDetalle.classList.remove('open')
  modalDetalle.onclick = (e) => { if (e.target === modalDetalle) modalDetalle.classList.remove('open') }

  const dateInput = el.querySelector('#resumen-date')
  dateInput.onchange = () => loadResumen(dateInput.value)
  loadResumen(today)

  async function loadResumen(fecha) {
    el.querySelector('#resumen-hoy-label').textContent = fecha === today ? '(hoy)' : ''
    const wrap = el.querySelector('#resumen-table-wrap')
    wrap.innerHTML = '<div class="loading">Cargando...</div>'

    const { data: recorridos } = await supabase
      .from('recorridos')
      .select('*, recorrido_pedidos(*)')
      .eq('fecha', fecha)

    const { data: retiras } = await supabase
      .from('retiras')
      .select('*')
      .eq('fecha', fecha)

    const { data: allPicking } = await supabase
      .from('picking')
      .select('*, clientes(transporte_tipo, transporte_id, transportes(nombre, retira_deposito))')
      .eq('estado', 'habilitado')

    const notasEnRecorrido = (recorridos || []).flatMap(r => r.recorrido_pedidos.map(p => p.nota_pedido))
    const notasRetiradas = (retiras || []).map(r => r.nota_pedido)

    const retirosPendientes = (allPicking || []).filter(p => {
      const tipo = p.clientes?.transporte_tipo
      if (tipo === 'retira') return !notasRetiradas.includes(p.nota_pedido)
      if (tipo === 'externo' && p.clientes?.transportes?.retira_deposito) return !notasRetiradas.includes(p.nota_pedido)
      return false
    })

    // Construir lista completa con info detallada
    const todos = [
      ...(recorridos || []).flatMap(r => r.recorrido_pedidos.map(p => ({
        id: p.id,
        cliente: p.cliente_nombre,
        nota: p.nota_pedido,
        tipo: p.tipo === 'pyb' ? 'pyb' : 'externo',
        tipoLabel: p.tipo === 'pyb' ? 'Entrega P&B' : 'Transp. ext.',
        operario: r.operario,
        vehiculo: r.vehiculo,
        estado: p.estado === 'entregado' ? 'entregado' : 'reparto',
        horaEntrega: p.hora_entrega,
        recorrido: r.codigo,
        kmSalida: r.km_salida,
        kmRegreso: r.km_regreso,
        horaSalida: r.hora_salida,
        observaciones: p.observaciones,
        direccion: p.direccion,
        _tipo: 'recorrido'
      }))),
      ...(retiras || []).map(r => ({
        id: r.id,
        cliente: r.cliente_nombre,
        nota: r.nota_pedido,
        tipo: 'retira',
        tipoLabel: 'Retiro',
        operario: '—',
        estado: 'entregado',
        horaEntrega: r.hora_retiro,
        recorrido: '—',
        documentacion: r.documentacion,
        _tipo: 'retira'
      })),
      ...retirosPendientes.map(p => ({
        id: p.id,
        cliente: p.cliente_nombre,
        nota: p.nota_pedido,
        tipo: 'retira',
        tipoLabel: p.clientes?.transporte_tipo === 'retira' ? 'Retira cliente' : `Retira ${p.clientes?.transportes?.nombre || 'transporte'}`,
        operario: '—',
        estado: 'pendiente',
        horaEntrega: null,
        recorrido: '—',
        documentacion: p.documentacion,
        _tipo: 'retira_pendiente'
      }))
    ]

    if (todos.length === 0) {
      wrap.innerHTML = '<div class="empty-state">Sin pedidos para esta fecha</div>'
      el.querySelector('#resumen-stats').innerHTML = ''
      return
    }

    const entregados = todos.filter(p => p.estado === 'entregado').length
    const enReparto = todos.filter(p => p.estado === 'reparto').length
    const pendientes = todos.filter(p => p.estado === 'pendiente').length

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Tipo</th><th>Operario</th><th>Estado</th><th>Hora</th><th>Recorrido</th><th></th></tr></thead>
        <tbody>${todos.map(p => `
          <tr>
            <td style="color:#ccc;font-weight:500">${p.cliente}</td>
            <td>
              ${p.tipo === 'pyb' ? '<span class="badge badge-pyb">Entrega P&B</span>' :
                p.tipo === 'retira' ? '<span class="badge badge-retira">' + p.tipoLabel + '</span>' :
                '<span class="badge badge-externo">Transp. ext.</span>'}
            </td>
            <td style="color:#555">${p.operario}</td>
            <td>
              ${p.estado === 'entregado' ? '<span class="badge badge-entregado">Entregado</span>' :
                p.estado === 'reparto' ? '<span class="badge badge-reparto">En reparto</span>' :
                '<span class="badge badge-pendiente">Pend. retiro</span>'}
            </td>
            <td style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#2a2a2a'}">${p.horaEntrega || '—'}</td>
            <td style="font-family:'DM Mono',monospace;font-size:11px;color:#444">${p.recorrido}</td>
            <td><button class="btn-sm primary" data-detalle='${JSON.stringify(p).replace(/'/g, "&#39;")}' ><i class="ti ti-eye"></i></button></td>
          </tr>`).join('')}
        </tbody>
      </table>`

    // Event listeners para el ojito
    wrap.querySelectorAll('[data-detalle]').forEach(btn => {
      btn.onclick = () => {
        const p = JSON.parse(btn.dataset.detalle.replace(/&#39;/g, "'"))
        mostrarDetalle(p)
      }
    })

    el.querySelector('#resumen-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-value">${todos.length}</div></div>
      <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value">${entregados}</div></div>
      <div class="stat-card"><div class="stat-label">En reparto</div><div class="stat-value">${enReparto}</div></div>
      <div class="stat-card"><div class="stat-label">Pend. retiro</div><div class="stat-value">${pendientes}</div></div>`
  }

  function mostrarDetalle(p) {
    el.querySelector('#detalle-title').textContent = p.cliente + ' — ' + p.nota
    let html = ''

    if (p._tipo === 'recorrido') {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Recorrido</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${p.recorrido}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Estado</div><div>${p.estado === 'entregado' ? '<span class="badge badge-entregado">Entregado</span>' : '<span class="badge badge-reparto">En reparto</span>'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Operario</div><div style="color:#ccc">${p.operario}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Vehículo</div><div style="color:#ccc">${p.vehiculo || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Hora salida</div><div style="font-family:'DM Mono',monospace;color:#888">${p.horaSalida || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Hora entrega</div><div style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#2a2a2a'}">${p.horaEntrega || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Km salida</div><div style="font-family:'DM Mono',monospace;color:#888">${p.kmSalida || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Km regreso</div><div style="font-family:'DM Mono',monospace;color:#888">${p.kmRegreso || '—'}</div></div>
        </div>
        ${p.direccion ? `<div style="background:#111;border:1px solid #1e1e1e;padding:10px 14px;border-radius:2px;font-size:12px;color:#555;margin-bottom:12px"><i class="ti ti-map-pin" style="font-size:11px"></i> ${p.direccion}</div>` : ''}
        ${p.observaciones ? `<div style="background:#1f0d0d;border:1px solid #3a1a1a;padding:10px 14px;border-radius:2px;font-size:12px;color:#e05555;margin-bottom:12px"><i class="ti ti-alert-circle" style="font-size:11px"></i> ${p.observaciones}</div>` : ''}`
    } else if (p._tipo === 'retira' || p._tipo === 'retira_pendiente') {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Tipo</div><div><span class="badge badge-retira">${p.tipoLabel}</span></div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Estado</div><div>${p.estado === 'entregado' ? '<span class="badge badge-entregado">Retirado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Hora retiro</div><div style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#2a2a2a'}">${p.horaEntrega || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#333;text-transform:uppercase;margin-bottom:4px">Documentación</div><div style="color:#888">${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion || '—'}</div></div>
        </div>`
    }

    el.querySelector('#detalle-body').innerHTML = html
    modalDetalle.classList.add('open')
  }
}