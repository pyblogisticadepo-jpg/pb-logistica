const PRODUCTOS = {
  'VAN HASSEN': ['Original','Nativo','Vainilla','Middle','Intenso','Menta','Menthol'],
  'ARLEQUIN': ['Menthol','Cafe','Mango','Mystique','Chocolate','Menta','Vainilla','Uva'],
  'Filtros Stamps': ['SLIM','REGULAR','POCKET','SLIM LONG','REGULAR MENTHOL','SLIM MENTHOL','SLIM BIO','EXTRA SLIM']
}

export async function renderStock(el, { supabase, currentUser }) {
  const canEdit = ['jefe','logistica'].includes(currentUser.rol)
  const today = new Date().toISOString().split('T')[0]

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Stock</span><span class="page-subtitle" id="stock-sub"></span></div>
      ${canEdit ? '<button class="btn-add" id="btn-cargar-stock"><i class="ti ti-edit"></i> Cargar stock del día</button>' : ''}
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
          <span class="modal-title">Cargar stock — ${today}</span>
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

  async function load(fecha) {
    el.querySelector('#stock-sub').textContent = fecha === today ? 'Hoy' : fecha
    const content = el.querySelector('#stock-content')
    content.innerHTML = '<div class="loading">Cargando...</div>'

    const { data: stockData } = await supabase
      .from('stock').select('*').eq('fecha', fecha).order('marca').order('producto')

    const stockMap = {}
    ;(stockData || []).forEach(s => { stockMap[`${s.marca}|${s.producto}`] = s.cantidad })

    const hayDatos = (stockData || []).length > 0

    if (!hayDatos) {
      content.innerHTML = `
        <div style="text-align:center;padding:60px;color:#444">
          <i class="ti ti-package" style="font-size:40px;display:block;margin-bottom:12px;color:#333"></i>
          Sin stock cargado para esta fecha
          ${canEdit && fecha === today ? `<div style="margin-top:16px"><button class="btn-add" id="btn-cargar-stock-empty"><i class="ti ti-edit"></i> Cargar stock de hoy</button></div>` : ''}
        </div>`
      if (canEdit && fecha === today) {
        el.querySelector('#btn-cargar-stock-empty')?.onclick = () => openModal()
      }
      return
    }

    let html = ''
    Object.entries(PRODUCTOS).forEach(([marca, productos]) => {
      const tieneData = productos.some(p => stockMap[`${marca}|${p}`] !== undefined)
      if (!tieneData) return
      html += `<div style="margin-bottom:24px;">
        <div style="font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:12px;font-weight:500;border-bottom:1px solid #1e1e1e;padding-bottom:8px">${marca}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
          ${productos.map(p => {
            const cant = stockMap[`${marca}|${p}`]
            if (cant === undefined) return ''
            const color = cant === 0 ? '#e05555' : cant <= 10 ? '#d4a830' : '#52c452'
            return `<div style="background:#111;border:1px solid #1e1e1e;padding:14px 16px;border-radius:2px;">
              <div style="font-size:11px;color:#666;margin-bottom:6px">${p}</div>
              <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:600;color:${color}">${cant}</div>
            </div>`
          }).join('')}
        </div>
      </div>`
    })

    content.innerHTML = html || '<div class="empty-state">Sin datos</div>'
  }

  async function openModal() {
    const { data: stockHoy } = await supabase
      .from('stock').select('*').eq('fecha', today)
    const stockMap = {}
    ;(stockHoy || []).forEach(s => { stockMap[`${s.marca}|${s.producto}`] = s.cantidad })

    let formHtml = ''
    Object.entries(PRODUCTOS).forEach(([marca, productos]) => {
      formHtml += `
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:10px;font-weight:500;border-bottom:1px solid #1e1e1e;padding-bottom:8px">${marca}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
            ${productos.map(p => `
              <div>
                <label style="font-size:11px;color:#666;display:block;margin-bottom:4px">${p}</label>
                <input class="form-input stock-input" data-marca="${marca}" data-producto="${p}" type="number" min="0" value="${stockMap[`${marca}|${p}`] ?? ''}" placeholder="0" style="padding:8px 10px;font-size:14px;">
              </div>`).join('')}
          </div>
        </div>`
    })

    el.querySelector('#stock-form-body').innerHTML = formHtml
    modal.classList.add('open')
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

      // Borrar los del día y reemplazar
      await supabase.from('stock').delete().eq('fecha', today)
      const { error } = await supabase.from('stock').insert(registros)
      if (error) { alert('Error: ' + error.message); return }
      modal.classList.remove('open')
      await load(today)
    }
  }

  await load(today)
}