const PRODUCTOS = {
  'VAN HASSEN': ['Original','Nativo','Vainilla','Middle','Intenso','Menta','Menthol'],
  'ARLEQUIN': ['Menthol','Cafe','Mango','Mystique','Chocolate','Menta','Vainilla','Uva'],
  'Filtros Stamps': ['SLIM','REGULAR','POCKET','SLIM LONG','REGULAR MENTHOL','SLIM MENTHOL','SLIM BIO','EXTRA SLIM']
}

function unidadesPorBulto(marca, producto) {
  if (marca === 'VAN HASSEN' || marca === 'ARLEQUIN') return 120
  if (marca === 'Filtros Stamps') return producto === 'POCKET' ? 624 : 240
  return 1
}

export async function renderStock(el, { supabase, currentUser }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)
  const today = new Date().toISOString().split('T')[0]

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Stock</span><span class="page-subtitle" id="stock-sub"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-cargar-stock"><i class="ti ti-edit"></i> Actualizar stock</button>' : ''}
    </div>
    ${!canEdit ? '<div class="observer-badge"><i class="ti ti-eye"></i> Solo lectura</div>' : ''}
    <div class="date-picker-row" style="margin-bottom:16px;">
      <span class="date-picker-label">Fecha</span>
      <input type="date" class="date-picker-input" id="stock-fecha" value="${today}">
    </div>
    <div id="stock-content"><div class="loading">Cargando...</div></div>

    <div class="modal-overlay" id="modal-stock">
      <div class="modal" style="width:600px;max-width:96%"><div class="modal-top-bar green"></div>
        <div class="modal-header">
          <span class="modal-title" id="stock-modal-title">Actualizar stock</span>
          <button class="modal-close" id="close-stock-modal"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body" id="stock-form-body"></div>
        <div class="modal-footer">
          <button class="btn-cancel" id="cancel-stock-modal">Cancelar</button>
          <button class="btn-confirm" id="save-stock"><i class="ti ti-check"></i> Guardar stock</button>
        </div>
      </div>
    </div>`

  const modal = el.querySelector('#modal-stock')
  el.querySelector('#close-stock-modal').onclick = () => modal.classList.remove('open')
  el.querySelector('#cancel-stock-modal').onclick = () => modal.classList.remove('open')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open') }

  el.querySelector('#stock-fecha').onchange = () => load(el.querySelector('#stock-fecha').value)

  async function getUltimoStock(fechaHasta) {
    const { data } = await supabase
      .from('stock').select('*')
      .lte('fecha', fechaHasta)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    const stockMap = {}
    ;(data || []).forEach(s => {
      const key = `${s.marca}|${s.producto}`
      if (!stockMap[key]) stockMap[key] = s
    })
    return stockMap
  }

  async function load(fecha) {
    el.querySelector('#stock-sub').textContent = fecha === today ? 'Hoy' : fecha
    const content = el.querySelector('#stock-content')
    content.innerHTML = '<div class="loading">Cargando...</div>'

    const stockMap = await getUltimoStock(fecha)
    const hayDatos = Object.keys(stockMap).length > 0

    if (!hayDatos) {
      content.innerHTML = `
        <div style="text-align:center;padding:60px;color:#444">
          <i class="ti ti-package" style="font-size:40px;display:block;margin-bottom:12px;color:#333"></i>
          Sin stock cargado aún
          ${canEdit ? `<div style="margin-top:16px"><button class="btn-add" id="btn-cargar-stock-empty"><i class="ti ti-edit"></i> Cargar stock</button></div>` : ''}
        </div>`
      if (canEdit) {
        const btnEmpty = el.querySelector('#btn-cargar-stock-empty')
        if (btnEmpty) btnEmpty.onclick = () => openModal()
      }
      return
    }

    const fechas = [...new Set(Object.values(stockMap).map(s => s.fecha))].sort().reverse()
    const ultimaFecha = fechas[0]
    const esHoy = ultimaFecha === fecha

    let html = ''
    if (!esHoy && fecha === today) {
      html += `<div style="background:#1a1500;border:1px solid #2a2000;padding:10px 14px;border-radius:2px;font-size:12px;color:#d4a830;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
        <i class="ti ti-alert-circle"></i>
        <span>Mostrando último stock registrado (${ultimaFecha}). Actualizá para cargar el de hoy.</span>
      </div>`
    }
Object.entries(PRODUCTOS).forEach(([marca, productos]) => {
      let totalMarca = null
      if (marca === 'ARLEQUIN') {
        totalMarca = productos.reduce((acc, p) => {
          const s = stockMap[`${marca}|${p}`]
          if (s?.cantidad === undefined) return acc
          return acc + (s.cantidad * unidadesPorBulto(marca, p))
        }, 0)
      }
      html += `<div style="margin-bottom:24px;">
        <div style="font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:12px;font-weight:500;border-bottom:1px solid #1e1e1e;padding-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <span>${marca}</span>
          ${totalMarca !== null ? `<span style="color:#52c452;font-family:'DM Mono',monospace;font-size:13px;letter-spacing:0;text-transform:none">Total: ${totalMarca.toLocaleString()} u.</span>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
          ${productos.map(p => {
            const s = stockMap[`${marca}|${p}`]
            const cant = s?.cantidad
            const color = cant === undefined ? '#444' : cant === 0 ? '#e05555' : cant <= 10 ? '#d4a830' : '#52c452'
            const unidades = cant !== undefined ? cant * unidadesPorBulto(marca, p) : null
            return `<div style="background:#111;border:1px solid #1e1e1e;padding:14px 16px;border-radius:2px;">
              <div style="font-size:11px;color:#666;margin-bottom:6px">${p}</div>
              <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:600;color:${color}">${cant !== undefined ? cant : '—'}</div>
              ${unidades !== null ? `<div style="font-size:10px;color:#555;margin-top:2px">${unidades.toLocaleString()} unidades</div>` : ''}
              ${s && s.fecha !== today ? `<div style="font-size:9px;color:#333;margin-top:4px">${s.fecha}</div>` : ''}
            </div>`
          }).join('')}
        </div>
      </div>`
    })
    content.innerHTML = html
  }
  async function openModal() {
    el.querySelector('#stock-modal-title').textContent = 'Actualizar stock — ' + today
    const stockPrevio = await getUltimoStock(today)

    let formHtml = `
      <div style="background:#0d1a0d;border:1px solid #1a3a1a;padding:10px 14px;border-radius:2px;font-size:12px;color:#3a6a3a;margin-bottom:16px;display:flex;gap:8px;">
        <i class="ti ti-info-circle" style="color:#52c452;flex-shrink:0"></i>
        <span>Los valores están pre-cargados con el último stock registrado. Modificá solo los que cambiaron.</span>
      </div>`

    Object.entries(PRODUCTOS).forEach(([marca, productos]) => {
      formHtml += `
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:10px;font-weight:500;border-bottom:1px solid #1e1e1e;padding-bottom:8px">${marca}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
            ${productos.map(p => {
              const previo = stockPrevio[`${marca}|${p}`]
              const val = previo?.cantidad !== undefined ? previo.cantidad : ''
              return `<div>
                <label style="font-size:11px;color:#666;display:block;margin-bottom:4px">${p}</label>
                <input class="form-input stock-input" data-marca="${marca}" data-producto="${p}" type="number" min="0" value="${val}" placeholder="0" style="padding:8px 10px;font-size:14px;">
                <div class="stock-unidades-preview" data-marca="${marca}" data-producto="${p}" style="font-size:10px;color:#555;margin-top:3px">${val !== '' ? (val * unidadesPorBulto(marca, p)).toLocaleString() + ' unidades' : ''}</div>
              </div>`
            }).join('')}
          </div>
        </div>`
    })

    el.querySelector('#stock-form-body').innerHTML = formHtml
    modal.classList.add('open')

    el.querySelectorAll('.stock-input').forEach(input => {
      input.oninput = () => {
        const preview = el.querySelector(`.stock-unidades-preview[data-marca="${input.dataset.marca}"][data-producto="${input.dataset.producto}"]`)
        const val = parseInt(input.value)
        if (preview) {
          preview.textContent = !isNaN(val) ? (val * unidadesPorBulto(input.dataset.marca, input.dataset.producto)).toLocaleString() + ' unidades' : ''
        }
      }
    })
  }

  if (canEdit) {
    el.querySelector('#btn-cargar-stock').onclick = () => openModal()

    el.querySelector('#save-stock').onclick = async () => {
      const inputs = el.querySelectorAll('.stock-input')
      const registros = []
      inputs.forEach(input => {
        const val = input.value.trim()
        if (val === '') return
        registros.push({
          fecha: today,
          marca: input.dataset.marca,
          producto: input.dataset.producto,
          cantidad: parseInt(val) || 0,
          usuario: currentUser.nombre
        })
      })

      if (registros.length === 0) { alert('Ingresá al menos un valor'); return }

      await supabase.from('stock').delete().eq('fecha', today)
      const { error } = await supabase.from('stock').insert(registros)
      if (error) { alert('Error: ' + error.message); return }
      modal.classList.remove('open')
      await load(today)
    }
  }

  await load(today)
}