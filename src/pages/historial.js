export async function renderHistorial(el, { supabase, currentUser }) {
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Historial</span><span class="page-subtitle" id="historial-count"></span></div>
    </div>
    <div class="search-bar">
      <input class="search-input" id="h-search" placeholder="Buscar por cliente, código o NP...">
      <select class="filter-select" id="h-tipo">
        <option value="">Todos</option>
        <option value="entregado">Entregas</option>
        <option value="retiro">Retiros</option>
      </select>
    </div>
    <div class="date-picker-row" style="margin-bottom:16px;">
      <span class="date-picker-label">Desde</span>
      <input type="date" class="date-picker-input" id="h-desde">
      <span class="date-picker-label">Hasta</span>
      <input type="date" class="date-picker-input" id="h-hasta">
      <button class="btn-sm" id="h-limpiar"><i class="ti ti-x"></i> Limpiar</button>
    </div>
    <div id="historial-wrap"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-h-detalle">
      <div class="modal"><div class="modal-top-bar"></div>
        <div class="modal-header">
          <span class="modal-title" id="h-detalle-title">Detalle</span>
          <button class="modal-close" id="close-h-detalle"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" id="h-detalle-body"></div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-h-detalle">Cerrar</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modal-h-foto-ampliada">
      <div class="modal" style="width:auto;max-width:94vw"><div class="modal-top-bar"></div>
        <div class="modal-header">
          <span class="modal-title">Foto del remito</span>
          <button class="modal-close" id="close-h-foto-ampliada"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" style="text-align:center;padding:10px">
          <img id="h-foto-ampliada-img" style="max-width:100%;max-height:70vh;border-radius:2px;">
        </div>
        <div class="modal-footer">
          <a id="h-foto-ampliada-download" download target="_blank" class="btn-confirm"><i class="ti ti-download"></i> Descargar</a>
          <button class="btn-cancel" id="cancel-h-foto-ampliada">Cerrar</button>
        </div>
      </div>
    </div>`

  const modal = el.querySelector('#modal-h-detalle')
  el.querySelector('#close-h-detalle').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-h-detalle').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  const modalFoto = el.querySelector('#modal-h-foto-ampliada')
  el.querySelector('#close-h-foto-ampliada').onclick = () => modalFoto.classList.remove('open')
  el.querySelector('#cancel-h-foto-ampliada').onclick = () => modalFoto.classList.remove('open')
  modalFoto.onclick = (e) => { if (e.target === modalFoto) modalFoto.classList.remove('open') }

  function ampliarFoto(url) {
    el.querySelector('#h-foto-ampliada-img').src = url
    el.querySelector('#h-foto-ampliada-download').href = url
    modalFoto.classList.add('open')
  }

  let allItems = []

  async function load() {
    const wrap = el.querySelector('#historial-wrap')
    wrap.innerHTML = '<div class="loading">Cargando...</div>'

    const { data: entregados } = await supabase
      .from('recorrido_pedidos')
      .select('*, recorridos(codigo, operario, vehiculo, hora_salida, km_salida, km_regreso, fecha)')
      .eq('estado', 'entregado')
      .order('hora_entrega', { ascending: false })

    const { data: retiros } = await supabase
      .from('retiras')
      .select('*')
      .order('hora_retiro', { ascending: false })

    const { data: todosPicking } = await supabase
      .from('picking').select('codigo_interno, nota_pedido, bultos')
    const bultosMap = {}
    ;(todosPicking || []).forEach(p => {
      if (p.codigo_interno) bultosMap[p.codigo_interno] = p.bultos
      if (p.nota_pedido) bultosMap[p.nota_pedido] = bultosMap[p.nota_pedido] || p.bultos
    })

    const entregas = (entregados || []).map(p => ({
      _tipo: 'entregado',
      id: p.id,
      cliente: p.cliente_nombre,
      nota: p.nota_pedido,
      codigoInterno: p.codigo_interno,
      tipo: p.tipo,
      transporteNombre: p.transporte_nombre || null,
      tipoLabel: p.tipo === 'pyb' ? 'Entrega P&B' : (p.transporte_nombre ? `Transp. ${p.transporte_nombre}` : 'Transp. ext.'),
      hora: p.hora_entrega,
      fecha: p.recorridos?.fecha || null,
      recorrido: p.recorridos?.codigo || '—',
      operario: p.recorridos?.operario || '—',
      vehiculo: p.recorridos?.vehiculo || '—',
      horaSalida: p.recorridos?.hora_salida || null,
      kmSalida: p.recorridos?.km_salida || null,
      kmRegreso: p.recorridos?.km_regreso || null,
      direccion: p.direccion || null,
      bultos: bultosMap[p.codigo_interno] || bultosMap[p.nota_pedido] || null,
      fotos: (p.foto_remito || '').split(',').filter(Boolean)
    }))

    const retirosItems = (retiros || []).map(r => ({
      _tipo: 'retiro',
      id: r.id,
      cliente: r.cliente_nombre,
      nota: r.nota_pedido,
      codigoInterno: r.codigo_interno,
      tipo: 'retira',
      transporteNombre: r.transporte_nombre || null,
      tipoLabel: r.transporte_nombre ? `Retira ${r.transporte_nombre}` : 'Retira cliente',
      hora: r.hora_retiro,
      fecha: r.fecha,
      recorrido: '—',
      operario: '—',
      vehiculo: '—',
      documentacion: r.documentacion,
      bultos: bultosMap[r.codigo_interno] || bultosMap[r.nota_pedido] || null,
      fotos: (r.foto_remito || '').split(',').filter(Boolean)
    }))

    allItems = [...entregas, ...retirosItems].sort((a, b) => {
      const fa = a.fecha || ''
      const fb = b.fecha || ''
      return fb.localeCompare(fa)
    })

    filter()
  }

  function filter() {
    const q = el.querySelector('#h-search').value.toLowerCase()
    const tipo = el.querySelector('#h-tipo').value
    const desde = el.querySelector('#h-desde').value
    const hasta = el.querySelector('#h-hasta').value

    const lista = allItems.filter(p => {
      const matchQ = !q ||
        (p.cliente || '').toLowerCase().includes(q) ||
        (p.nota || '').toLowerCase().includes(q) ||
        (p.codigoInterno || '').toLowerCase().includes(q)
      const matchTipo = !tipo ? true : tipo === 'entregado' ? p._tipo === 'entregado' : p._tipo === 'retiro'
      const matchDesde = !desde ? true : (p.fecha || '') >= desde
      const matchHasta = !hasta ? true : (p.fecha || '') <= hasta
      return matchQ && matchTipo && matchDesde && matchHasta
    })

    renderTable(lista)
  }

  function renderTable(lista) {
    el.querySelector('#historial-count').textContent = lista.length + ' registros'
    const wrap = el.querySelector('#historial-wrap')
    if (lista.length === 0) { wrap.innerHTML = '<div class="empty-state">Sin registros</div>'; return }

    wrap.innerHTML = `<table class="data-table">
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Código</th><th>Tipo</th><th>Bultos</th><th>Operario</th><th>Hora</th><th>Recorrido</th><th>Foto</th><th></th></tr></thead>
      <tbody>${lista.map(p => `
        <tr>
          <td style="font-family:'DM Mono',monospace;color:#888;font-size:11px">${p.fecha || '—'}</td>
          <td style="color:#ccc;font-weight:500">${p.cliente}</td>
          <td style="font-family:'DM Mono',monospace;color:#5aadee;font-size:11px">${p.codigoInterno || p.nota || '—'}</td>
          <td>
            ${p._tipo === 'entregado' && p.tipo === 'pyb' ? '<span class="badge badge-pyb">Entrega P&B</span>' :
              p._tipo === 'entregado' ? `<span class="badge badge-externo">${p.tipoLabel}</span>` :
              `<span class="badge badge-retira">${p.tipoLabel}</span>`}
          </td>
          <td style="font-family:'DM Mono',monospace;color:${p.bultos ? '#d4a830' : '#444'}">${p.bultos || '—'}</td>
          <td style="color:#888;font-size:12px">${p.operario}</td>
          <td style="font-family:'DM Mono',monospace;color:#52c452;font-size:12px">${p.hora || '—'}</td>
          <td style="font-family:'DM Mono',monospace;color:#555;font-size:11px">${p.recorrido}</td>
          <td>${p.fotos.length > 0 ? `<span style="color:#4dd4d4;font-size:11px"><i class="ti ti-camera"></i> ${p.fotos.length}</span>` : '<span style="color:#333;font-size:11px">—</span>'}</td>
          <td><button class="btn-sm primary" data-detalle='${JSON.stringify(p).replace(/'/g, "&#39;")}' ><i class="ti ti-eye"></i></button></td>
        </tr>`).join('')}
      </tbody></table>`

    wrap.querySelectorAll('[data-detalle]').forEach(btn => {
      btn.onclick = () => {
        const p = JSON.parse(btn.dataset.detalle.replace(/&#39;/g, "'"))
        mostrarDetalle(p)
      }
    })
  }

  function renderFotosDetalle(fotos) {
    if (!fotos || fotos.length === 0) {
      return `<div style="font-size:12px;color:#444;text-align:center;padding:12px;border:1px dashed #222;border-radius:2px;margin-top:12px"><i class="ti ti-camera-off" style="font-size:14px"></i> Sin foto de remito cargada</div>`
    }
    return `
      <div style="margin-top:12px">
        <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:8px">Foto${fotos.length > 1 ? 's' : ''} del remito</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${fotos.map((url, i) => `
            <div style="position:relative;">
              <img src="${url}" data-ver-foto="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:2px;border:1px solid #222;cursor:pointer;">
              <a href="${url}" download target="_blank" style="position:absolute;bottom:2px;right:2px;background:#000c;border-radius:2px;padding:2px 4px;color:#4dd4d4;font-size:10px;text-decoration:none"><i class="ti ti-download"></i></a>
            </div>`).join('')}
        </div>
      </div>`
  }

  function mostrarDetalle(p) {
    el.querySelector('#h-detalle-title').textContent = p.cliente + (p.codigoInterno ? ' — ' + p.codigoInterno : '')
    let html = ''

    if (p._tipo === 'entregado') {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Código interno</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${p.codigoInterno || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">NP Sistema</div><div style="font-family:'DM Mono',monospace;color:#888">${p.nota || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Fecha</div><div style="color:#ccc">${p.fecha || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora entrega</div><div style="font-family:'DM Mono',monospace;color:#52c452">${p.hora || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Recorrido</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${p.recorrido}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Operario</div><div style="color:#ccc">${p.operario}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Vehículo</div><div style="color:#ccc">${p.vehiculo || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:18px">${p.bultos || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Km salida</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.kmSalida || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Km regreso</div><div style="font-family:'DM Mono',monospace;color:#aaa">${p.kmRegreso || '—'}</div></div>
          ${p.transporteNombre ? `<div style="grid-column:span 2"><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Transporte</div><div style="color:#a78bfa">${p.transporteNombre}</div></div>` : ''}
        </div>
        ${p.direccion ? `<div style="background:#111;border:1px solid #1e1e1e;padding:10px 14px;border-radius:2px;font-size:12px;color:#666;margin-bottom:12px"><i class="ti ti-map-pin" style="font-size:11px"></i> ${p.direccion}</div>` : ''}
        ${renderFotosDetalle(p.fotos)}`
    } else {
      html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Código interno</div><div style="font-family:'DM Mono',monospace;color:#5aadee">${p.codigoInterno || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">NP Sistema</div><div style="font-family:'DM Mono',monospace;color:#888">${p.nota || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Fecha</div><div style="color:#ccc">${p.fecha || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Hora retiro</div><div style="font-family:'DM Mono',monospace;color:#52c452">${p.hora || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Bultos</div><div style="font-family:'DM Mono',monospace;color:#d4a830;font-size:18px">${p.bultos || '—'}</div></div>
          <div><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Tipo</div><div><span class="badge badge-retira">${p.tipoLabel}</span></div></div>
          ${p.transporteNombre ? `<div style="grid-column:span 2"><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Transporte</div><div style="color:#d4a830">${p.transporteNombre}</div></div>` : ''}
          ${p.documentacion ? `<div style="grid-column:span 2"><div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:4px">Documentación</div><div style="color:#aaa">${p.documentacion === 'fac_remito' ? 'Fac. y Remito' : p.documentacion === 'fac_etiqueta' ? 'Fac. y Etiqueta' : p.documentacion}</div></div>` : ''}
        </div>
        ${renderFotosDetalle(p.fotos)}`
    }

    el.querySelector('#h-detalle-body').innerHTML = html
    el.querySelectorAll('[data-ver-foto]').forEach(img => {
      img.onclick = () => ampliarFoto(img.dataset.verFoto)
    })
    modal.classList.add('open')
  }

  el.querySelector('#h-search').oninput = filter
  el.querySelector('#h-tipo').onchange = filter
  el.querySelector('#h-desde').onchange = filter
  el.querySelector('#h-hasta').onchange = filter
  el.querySelector('#h-limpiar').onclick = () => {
    el.querySelector('#h-search').value = ''
    el.querySelector('#h-tipo').value = ''
    el.querySelector('#h-desde').value = ''
    el.querySelector('#h-hasta').value = ''
    filter()
  }

  await load()
}