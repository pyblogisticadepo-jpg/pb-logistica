let resumenInterval = null

export async function renderResumen(el, { supabase, currentUser }) {
  const today = new Date().toISOString().split('T')[0]

  if (resumenInterval) { clearInterval(resumenInterval); resumenInterval = null }

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Resumen diario</span></div>
    </div>
    <div class="date-picker-row">
      <span class="date-picker-label">Fecha</span>
      <input type="date" class="date-picker-input" id="resumen-date" value="${today}">
      <span style="font-size:11px;color:#555" id="resumen-hoy-label">(hoy)</span>
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
    </div>

    <div class="modal-overlay" id="modal-r-foto-ampliada">
      <div class="modal" style="width:auto;max-width:94vw"><div class="modal-top-bar"></div>
        <div class="modal-header">
          <span class="modal-title">Foto del remito</span>
          <button class="modal-close" id="close-r-foto-ampliada"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="text-align:center;padding:10px">
          <img id="r-foto-ampliada-img" style="max-width:100%;max-height:70vh;border-radius:2px;">
        </div>
        <div class="modal-footer">
          <a id="r-foto-ampliada-download" download target="_blank" class="btn-confirm"><i class="ti ti-download"></i> Descargar</a>
          <button class="btn-cancel" id="cancel-r-foto-ampliada">Cerrar</button>
        </div>
      </div>
    </div>`

  function hayModalAbierto() {
    return el.querySelectorAll('.modal-overlay.open').length > 0
  }

  const modalDetalle = el.querySelector('#modal-detalle')
  el.querySelector('#close-detalle').onclick = () => modalDetalle.classList.remove('open')
  el.querySelector('#cancel-detalle').onclick = () => modalDetalle.classList.remove('open')
  modalDetalle.onclick = (e) => { if (e.target === modalDetalle) modalDetalle.classList.remove('open') }

  const modalFoto = el.querySelector('#modal-r-foto-ampliada')
  el.querySelector('#close-r-foto-ampliada').onclick = () => modalFoto.classList.remove('open')
  el.querySelector('#cancel-r-foto-ampliada').onclick = () => modalFoto.classList.remove('open')
  modalFoto.onclick = (e) => { if (e.target === modalFoto) modalFoto.classList.remove('open') }

  function ampliarFoto(url) {
    el.querySelector('#r-foto-ampliada-img').src = url
    el.querySelector('#r-foto-ampliada-download').href = url
    modalFoto.classList.add('open')
  }

  function renderFotosDetalle(fotos) {
    if (!fotos || fotos.length === 0) {
      return `<div style="font-size:12px;color:#444;text-align:center;padding:12px;border:1px dashed #222;border-radius:2px;margin-top:12px"><i class="ti ti-camera-off" style="font-size:14px"></i> Sin foto de remito cargada</div>`
    }
    return `
      <div style="margin-top:12px">
        <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:8px">Foto${fotos.length > 1 ? 's' : ''} del remito</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${fotos.map(url => `
            <div style="position:relative;">
              <img src="${url}" data-ver-foto-r="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:2px;border:1px solid #222;cursor:pointer;">
              <a href="${url}" download target="_blank" style="position:absolute;bottom:2px;right:2px;background:#000c;border-radius:2px;padding:2px 4px;color:#4dd4d4;font-size:10px;text-decoration:none"><i class="ti ti-download"></i></a>
            </div>`).join('')}
        </div>
      </div>`
  }

  const dateInput = el.querySelector('#resumen-date')
  dateInput.onchange = () => loadResumen(dateInput.value)
  loadResumen(today)

  async function loadResumen(fecha) {
    el.querySelector('#resumen-hoy-label').textContent = fecha === today ? '(hoy)' : ''
    const wrap = el.querySelector('#resumen-table-wrap')
    wrap.innerHTML = '<div class="loading">Cargando...</div>'

    // Traer recorridos con pedidos + bultos via join directo a picking
    const { data: recorridos } = await supabase
      .from('recorridos')
      .select('*, recorrido_pedidos(*, picking(bultos))')
      .eq('fecha', fecha)

    const { data: retiras } = await supabase
      .from('retiras').select('*').eq('fecha', fecha)

    const { data: allPicking } = await supabase
      .from('picking')
      .select('*, clientes(transporte_tipo, transporte_id, transportes(nombre, retira_deposito))')
      .eq('estado', 'habilitado')

    // bultosMap para retiras (que no tienen join directo)
    const { data: todosPicking } = await supabase
      .from('picking').select('codigo_interno, nota_pedido, bultos').order('id', { ascending: false }).limit(10000)
    const bultosMap = {}
    ;(todosPicking || []).forEach(p => {
      if (p.codigo_interno) bultosMap[p.codigo_interno] = p.bultos
      if (p.nota_pedido) bultosMap[p.nota_pedido] = bultosMap[p.nota_pedido] || p.bultos
    })

    const { data: todosEntregados } = await supabase
      .from('recorrido_pedidos').select('nota_pedido, codigo_interno').eq('estado', 'entregado')
    const notasYaEntregadas = new Set((todosEntregados || []).map(p => p.nota_pedido))

    const notasEnRecorridoActivo = (recorridos || [])
      .filter(r => r.estado !== 'completado')
      .flatMap(r => r.recorrido_pedidos.map(p => p.nota_pedido))

    const { data: todasRetirasBD } = await supabase.from('retiras').select('nota_pedido, codigo_interno')
    const todasNotasRetiradas = new Set((todasRetirasBD || []).map(r => r.nota_pedido))

    const habilitadosPendientes = (allPicking || []).filter(p => {
      if (notasYaEntregadas.has(p.nota_pedido)) return false
      if (notasEnRecorridoActivo.includes(p.nota_pedido)) return false
      if (todasNotasRetiradas.has(p.nota_pedido)) return false
      return true
    })

    const todos = [
      ...(recorridos || []).flatMap(r => r.recorrido_pedidos.map(p => {
        const rechazado = p.estado === 'pendiente' && p.observaciones
        // Bultos: primero del join directo a picking, fallback al bultosMap
        const bultos = p.picking?.bultos || bultosMap[p.codigo_interno] || bultosMap[p.nota_pedido] || null
        const transporteNombre = p.transporte_nombre || null
        const tipoLabel = p.tipo === 'pyb' ? 'Entrega P&B' : (transporteNombre ? `Transp. ${transporteNombre}` : 'Transp. ext.')
        return {
          id: p.id,
          cliente: p.cliente_nombre,
          nota: p.nota_pedido,
          codigoInterno: p.codigo_interno,
          tipo: p.tipo === 'pyb' ? 'pyb' : 'externo',
          tipoLabel,
          transporteNombre,
          operario: r.operario,
          vehiculo: r.vehiculo,
          estado: p.estado === 'entregado' ? 'entregado' : rechazado ? 'rechazado' : 'reparto',
          horaEntrega: p.hora_entrega,
          recorrido: r.codigo,
          kmSalida: r.km_salida,
          kmRegreso: r.km_regreso,
          horaSalida: r.hora_salida,
          observaciones: p.observaciones,
          direccion: p.direccion,
          bultos,
          fotos: (p.foto_remito || '').split(',').filter(Boolean),
          _tipo: 'recorrido'
        }
      })),
      ...(retiras || []).map(r => {
        const transporteNombre = r.transporte_nombre || null
        const tipoLabel = transporteNombre ? `Retira ${transporteNombre}` : 'Retira cliente'
        return {
          id: r.id,
          cliente: r.cliente_nombre,
          nota: r.nota_pedido,
          codigoInterno: r.codigo_interno,
          tipo: 'retira',
          tipoLabel,
          operario: '—',
          estado: 'entregado',
          horaEntrega: r.hora_retiro,
          recorrido: '—',
          documentacion: r.documentacion,
          transporteRetira: transporteNombre,
          bultos: bultosMap[r.codigo_interno] || bultosMap[r.nota_pedido] || null,
          fotos: (r.foto_remito || '').split(',').filter(Boolean),
          _tipo: 'retira'
        }
      }),
      ...habilitadosPendientes.map(p => {
        const tipo = p.clientes?.transporte_tipo
        const esRetira = tipo === 'retira' || (tipo === 'externo' && p.clientes?.transportes?.retira_deposito)
        const transporteNombrePend = p.clientes?.transportes?.nombre
        const tipoLabel = esRetira
          ? (transporteNombrePend ? `Retira ${transporteNombrePend}` : 'Retira cliente')
          : (tipo === 'pyb' ? 'Entrega P&B' : (transporteNombrePend ? `Transp. ${transporteNombrePend}` : 'Transp. ext.'))
        return {
          id: p.id,
          cliente: p.cliente_nombre,
          nota: p.nota_pedido,
          codigoInterno: p.codigo_interno,
          tipo: esRetira ? 'retira' : tipo || 'pyb',
          tipoLabel,
          transporteNombre: transporteNombrePend || null,
          operario: '—',
          estado: 'pendiente',
          horaEntrega: null,
          recorrido: '—',
          documentacion: p.documentacion,
          bultos: p.bultos,
          fotos: [],
          _tipo: esRetira ? 'retira_pendiente' : 'entrega_pendiente'
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
    const rechazados = todos.filter(p => p.estado === 'rechazado').length
    const pendientes = todos.filter(p => p.estado === 'pendiente').length
    const totalBultos = todos.reduce((a, p) => a + (p.bultos || 0), 0)

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Tipo</th><th>Bultos</th><th>Operario</th><th>Estado</th><th>Hora</th><th>Recorrido</th><th>Foto</th><th></th></tr></thead>
        <tbody>${todos.map(p => `
          <tr>
            <td style="color:#ccc;font-weight:500">${p.cliente}</td>
            <td>
              ${p.tipo === 'pyb' ? '<span class="badge badge-pyb">Entrega P&B</span>' :
                p.tipo === 'retira' ? `<span class="badge badge-retira">${p.tipoLabel}</span>` :
                `<span class="badge badge-externo">${p.tipoLabel}</span>`}
            </td>
            <td style="font-family:'DM Mono',monospace;color:${p.bultos ? '#d4a830' : '#444'};font-size:12px">${p.bultos || '—'}</td>
            <td style="color:#888">${p.operario}</td>
            <td>
              ${p.estado === 'entregado' ? '<span class="badge badge-entregado">Entregado</span>' :
                p.estado === 'reparto' ? '<span class="badge badge-reparto">En reparto</span>' :
                p.estado === 'rechazado' ? '<span class="badge" style="background:#2a0a0a;color:#e05555">Rechazado</span>' :
                '<span class="badge badge-pendiente">Pendiente</span>'}
            </td>
            <td style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#444'}">${p.horaEntrega || '—'}</td>
            <td style="font-family:'DM Mono',monospace;font-size:11px;color:#666">${p.recorrido}</td>
            <td>${p.fotos.length > 0 ? `<span style="color:#4dd4d4;font-size:11px"><i class="ti ti-camera"></i> ${p.fotos.length}</span>` : '<span style="color:#333;font-size:11px">—</span>'}</td>
            <td><button class="btn-sm primary" data-detalle='${JSON.stringify(p).replace(/'/g, "&#39;")}' ><i class="ti ti-eye"></i></button></td>
          </tr>`).join('')}
        </tbody>
      </table>`

    wrap.querySelectorAll('[data-detalle]').forEach(btn => {
      btn.onclick = () => {
        const p = JSON.parse(btn.dataset.detalle.replace(/&#39;/g, "'"))
        mostrarDetalle(p)
      }
    })

    el.querySelector('#resumen-stats').innerHTML = `
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${todos.length}</div></div>
      <div class="stat-card"><div class="stat-label">Bultos</div><div class="stat-value" style="color:#d4a830">${totalBultos}</div></div>
      <div class="stat-card"><div class="stat-label">Entregados</div><div class="stat-value">${entregados}</div></div>
      <div class="stat-card"><div class="stat-label">En reparto</div><div class="stat-value">${enReparto}</div></div>
      <div class="stat-card"><div class="stat-label">Rechazados</div><div class="stat-value" style="color:${rechazados > 0 ? '#e05555' : 'inherit'}">${rechazados}</div></div>
      <div class="stat-card"><div class="stat-label">Pendientes</div><div class="stat-value" style="color:${pendientes > 0 ? '#d4a830' : 'inherit'}">${pendientes}</div></div>`
  }

  function mostrarDetalle(p) {
    el.querySelector('#detalle-title').textContent = p.cliente + ' — ' + p.nota
    let html = ''

    if (p._tipo === 'recorrido') {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Recorrido</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${p.recorrido}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Estado</div><div>
            ${p.estado === 'entregado' ? '<span class="badge badge-entregado">Entregado</span>' :
              p.estado === 'rechazado' ? '<span class="badge" style="background:#2a0a0a;color:#e05555">Rechazado</span>' :
              '<span class="badge badge-reparto">En reparto</span>'}
          </div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Operario</div><div style="color:#ccc">${p.operario}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Vehículo</div><div style="color:#ccc">${p.vehiculo || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora salida</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.horaSalida || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora entrega</div><div style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#444'}">${p.horaEntrega || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Km salida</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.kmSalida || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Km regreso</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.kmRegreso || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:18px">${p.bultos || '—'}</div></div>
          ${p.transporteNombre ? `<div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Transporte</div><div style="color:#a78bfa">${p.transporteNombre}</div></div>` : ''}
        </div>
        ${p.direccion ? `<div style="background:#111;border:1px solid #1e1e1e;padding:10px 14px;border-radius:2px;font-size:12px;color:#666;margin-bottom:12px"><i class="ti ti-map-pin" style="font-size:11px"></i> ${p.direccion}</div>` : ''}
        ${p.observaciones ? `<div style="background:#1f0d0d;border:1px solid #3a1a1a;padding:10px 14px;border-radius:2px;font-size:12px;color:#e05555;margin-bottom:12px"><i class="ti ti-alert-circle" style="font-size:11px"></i> ${p.observaciones}</div>` : ''}
        ${renderFotosDetalle(p.fotos)}`
    } else if (p._tipo === 'retira') {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Tipo</div><div><span class="badge badge-retira">${p.tipoLabel}</span></div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Estado</div><div><span class="badge badge-entregado">Retirado</span></div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora retiro</div><div style="font-family:'DM Mono',monospace;color:${p.horaEntrega ? '#52c452' : '#444'}">${p.horaEntrega || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:18px">${p.bultos || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Documentación</div><div style="color:#aaa">${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion || '—'}</div></div>
          ${p.transporteRetira ? `<div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Transporte</div><div style="color:#d4a830">${p.transporteRetira}</div></div>` : ''}
        </div>
        ${renderFotosDetalle(p.fotos)}`
    } else {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Tipo</div><div><span class="badge ${p.tipo === 'retira' ? 'badge-retira' : p.tipo === 'pyb' ? 'badge-pyb' : 'badge-externo'}">${p.tipoLabel}</span></div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Estado</div><div><span class="badge badge-pendiente">Pendiente</span></div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Documentación</div><div style="color:#aaa">${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:18px">${p.bultos || '—'}</div></div>
          ${p.transporteNombre ? `<div style="grid-column:span 2"><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Transporte</div><div style="color:#a78bfa">${p.transporteNombre}</div></div>` : ''}
        </div>`
    }

    el.querySelector('#detalle-body').innerHTML = html
    el.querySelectorAll('[data-ver-foto-r]').forEach(img => {
      img.onclick = () => ampliarFoto(img.dataset.verFotoR)
    })
    modalDetalle.classList.add('open')
  }

  resumenInterval = setInterval(() => { if (!hayModalAbierto()) loadResumen(dateInput.value) }, 30000)
}