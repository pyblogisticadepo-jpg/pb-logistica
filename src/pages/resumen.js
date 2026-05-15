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
    <div class="stat-grid" id="resumen-stats"></div>`

  const dateInput = el.querySelector('#resumen-date')
  dateInput.onchange = () => loadResumen(dateInput.value)
  loadResumen(today)

  async function loadResumen(fecha) {
    el.querySelector('#resumen-hoy-label').textContent = fecha === today ? '(hoy)' : ''
    const wrap = el.querySelector('#resumen-table-wrap')
    wrap.innerHTML = '<div class="loading">Cargando...</div>'

    // Pedidos en recorridos
    const { data: recorridos } = await supabase
      .from('recorridos')
      .select('*, recorrido_pedidos(*)')
      .eq('fecha', fecha)

    // Retiros del día
    const { data: retiras } = await supabase
      .from('retiras')
      .select('*')
      .eq('fecha', fecha)

    // Pedidos habilitados sin recorrido (retira cliente / retira transporte) pendientes
    const { data: allPicking } = await supabase
      .from('picking')
      .select('*, clientes(transporte_tipo, transporte_id, transportes(nombre, retira_deposito))')
      .eq('estado', 'habilitado')

    const notasEnRecorrido = (recorridos || []).flatMap(r => r.recorrido_pedidos.map(p => p.nota_pedido))
    const notasRetiradas = (retiras || []).map(r => r.nota_pedido)

    // Pedidos retiro pendientes (no retirados aún hoy)
    const retirosPendientes = (allPicking || []).filter(p => {
      const tipo = p.clientes?.transporte_tipo
      if (tipo === 'retira') return !notasRetiradas.includes(p.nota_pedido)
      if (tipo === 'externo' && p.clientes?.transportes?.retira_deposito) return !notasRetiradas.includes(p.nota_pedido)
      return false
    })

    const todos = [
      // Pedidos en recorridos
      ...(recorridos || []).flatMap(r => r.recorrido_pedidos.map(p => ({
        cliente: p.cliente_nombre,
        tipo: p.tipo === 'pyb' ? 'pyb' : 'externo',
        tipoLabel: p.tipo === 'pyb' ? 'Entrega P&B' : 'Transp. ext.',
        operario: r.operario,
        estado: p.estado === 'entregado' ? 'entregado' : 'reparto',
        horaEntrega: p.hora_entrega,
        recorrido: r.codigo
      }))),
      // Retirados hoy
      ...(retiras || []).map(r => ({
        cliente: r.cliente_nombre,
        tipo: 'retira',
        tipoLabel: 'Retiro',
        operario: '—',
        estado: 'entregado',
        horaEntrega: r.hora_retiro,
        recorrido: '—'
      })),
      // Retiros pendientes
      ...retirosPendientes.map(p => {
        const tipo = p.clientes?.transporte_tipo
        const esRetiraCliente = tipo === 'retira'
        const transporteNombre = p.clientes?.transportes?.nombre
        return {
          cliente: p.cliente_nombre,
          tipo: 'retira',
          tipoLabel: esRetiraCliente ? 'Retira cliente' : `Retira ${transporteNombre || 'transporte'}`,
          operario: '—',
          estado: 'pendiente',
          horaEntrega: null,
          recorrido: '—'
        }
      })
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
        <thead><tr><th>Cliente</th><th>Tipo</th><th>Operario</th><th>Estado</th><th>Hora</th><th>Recorrido</th></tr></thead>
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
                '<span class="badge badge-pendiente">Pendiente retiro</span>'}
            </td>
            <td style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#2a2a2a'}">${p.horaEntrega || '—'}</td>
            <td style="font-family:'DM Mono',monospace;font-size:11px;color:#444">${p.recorrido}</td>
          </tr>`).join('')}
        </tbody>
      </table>`

    el.querySelector('#resumen-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-value">${todos.length}</div></div>
      <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value">${entregados}</div></div>
      <div class="stat-card"><div class="stat-label">En reparto</div><div class="stat-value">${enReparto}</div></div>
      <div class="stat-card"><div class="stat-label">Pend. retiro</div><div class="stat-value">${pendientes}</div></div>`
  }
}