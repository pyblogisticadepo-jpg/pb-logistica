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

    const { data: pedidos } = await supabase
      .from('recorrido_pedidos')
      .select(`*, recorridos(codigo, operario, vehiculo, hora_salida, fecha)`)
      .eq('recorridos.fecha', fecha)
      .not('recorridos', 'is', null)

    const { data: retiras } = await supabase
      .from('retiras').select('*').eq('fecha', fecha)

    const todos = [
      ...(pedidos || []).map(p => ({
        cliente: p.cliente_nombre,
        tipo: p.tipo,
        operario: p.recorridos?.operario || '—',
        estado: p.estado === 'entregado' ? 'entregado' : 'reparto',
        horaEntrega: p.hora_entrega,
        recorrido: p.recorridos?.codigo
      })),
      ...(retiras || []).map(r => ({
        cliente: r.cliente_nombre,
        tipo: 'retira',
        operario: '—',
        estado: r.estado === 'retirado' ? 'entregado' : 'reparto',
        horaEntrega: r.hora_retiro,
        recorrido: '—'
      }))
    ]

    if (todos.length === 0) {
      wrap.innerHTML = '<div class="empty-state">Sin pedidos para esta fecha</div>'
      el.querySelector('#resumen-stats').innerHTML = ''
      return
    }

    const entregados = todos.filter(p => p.estado === 'entregado').length
    const enReparto = todos.filter(p => p.estado === 'reparto').length

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Tipo</th><th>Operario</th><th>Estado</th><th>Hora entrega</th><th>Recorrido</th></tr></thead>
        <tbody>${todos.map(p => `
          <tr>
            <td style="color:#ccc;font-weight:500">${p.cliente}</td>
            <td>${p.tipo === 'pyb' ? '<span class="badge badge-pyb">Entrega P&B</span>' : p.tipo === 'retira' ? '<span class="badge badge-retira">Retira cliente</span>' : '<span class="badge badge-externo">Transp. ext.</span>'}</td>
            <td style="color:#555">${p.operario}</td>
            <td>${p.estado === 'entregado' ? '<span class="badge badge-entregado">Entregado</span>' : '<span class="badge badge-reparto">En reparto</span>'}</td>
            <td style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#2a2a2a'}">${p.horaEntrega || '—'}</td>
            <td style="font-family:'DM Mono',monospace;font-size:11px;color:#444">${p.recorrido || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`

    el.querySelector('#resumen-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total pedidos</div><div class="stat-value">${todos.length}</div></div>
      <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value">${entregados}</div></div>
      <div class="stat-card"><div class="stat-label">En reparto</div><div class="stat-value">${enReparto}</div></div>`
  }
}
