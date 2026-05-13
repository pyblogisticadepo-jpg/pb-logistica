// DESPACHO
export async function renderDespacho(el, { supabase, currentUser }) {
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-group"><span class="page-title">Despacho</span><span class="page-subtitle" id="despacho-sub"></span></div>
    </div>
    <div id="despacho-content"><div class="loading">Cargando...</div></div>`

  async function load() {
    let query = supabase.from('recorridos').select(`*, recorrido_pedidos(*)`).order('created_at', { ascending: false })
    if (currentUser.rol === 'operario') query = query.eq('operario', currentUser.nombre)
    const { data } = await query
    const recorridos = data || []
    el.querySelector('#despacho-sub').textContent = recorridos.length + ' recorrido' + (recorridos.length !== 1 ? 's' : '')
    const content = el.querySelector('#despacho-content')
    if (recorridos.length === 0) { content.innerHTML = '<div class="empty-state" style="padding:60px">Sin recorridos asignados hoy</div>'; return }
    content.innerHTML = recorridos.map(r => {
      const ent = r.recorrido_pedidos.filter(p => p.estado === 'entregado').length
      const tot = r.recorrido_pedidos.length
      const estBadge = r.estado === 'en-ruta' ? '<span class="badge badge-en-ruta">En ruta</span>' : r.estado === 'completado' ? '<span class="badge badge-completado">Completado</span>' : '<span class="badge badge-pendiente">Pendiente</span>'
      return `<div style="background:#111;border:1px solid #1e1e1e;padding:16px 18px;margin-bottom:16px;border-radius:2px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:#fff">${r.codigo}</div>
            <div style="font-size:12px;color:#444;margin-top:4px">${estBadge} · Operario: <strong style="color:#666">${r.operario}</strong> · ${ent}/${tot} entregas${r.vehiculo ? ' · ' + r.vehiculo : ''}</div>
            <div style="font-size:11px;color:#333;margin-top:3px">Km salida: ${r.km_salida || '—'} · Km regreso: ${r.km_regreso || '—'}${r.km_salida && r.km_regreso ? ' · <span style="color:#52c452">' + (r.km_regreso - r.km_salida) + ' km</span>' : ''}</div>
          </div>
          <div style="display:flex;gap:8px">
            ${r.estado === 'pendiente' ? `<button class="btn-sm orange" data-salida="${r.id}"><i class="ti ti-truck-delivery"></i> Confirmar salida</button>` : ''}
            ${r.estado === 'en-ruta' && ent === tot ? `<button class="btn-sm green" data-regreso="${r.id}" data-km-sal="${r.km_salida}"><i class="ti ti-home"></i> Confirmar regreso</button>` : ''}
          </div>
        </div>
        ${r.recorrido_pedidos.map((p, idx) => `
          <div class="pedido-card ${p.estado === 'entregado' ? 'entregado' : ''}">
            <div class="pedido-card-header">
              <div class="pedido-orden ${p.tipo}">${p.orden}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:2px">${p.cliente_nombre}</div>
                <div style="font-size:11px;color:#444">${p.direccion || '—'} · ${p.nota_pedido}</div>
              </div>
              <div>${p.estado === 'pendiente' && r.estado === 'en-ruta' ? `<button class="btn-sm green" data-entregar="${r.id}" data-pidx="${p.id}"><i class="ti ti-check"></i> Entregado</button>` : p.estado === 'entregado' ? `<span class="badge badge-ok" style="font-size:9px">✓ ${p.hora_entrega || ''}</span>` : ''}</div>
            </div>
            ${p.estado === 'entregado' ? `<div class="pedido-entregado-info"><span style="color:#52c452;font-family:'DM Mono',monospace;font-size:11px"><i class="ti ti-clock" style="font-size:10px"></i> Entregado ${p.hora_entrega || ''}</span></div>` : ''}
          </div>`).join('')}
      </div>`
    }).join('')

    content.querySelectorAll('[data-salida]').forEach(btn => {
      btn.onclick = async () => {
        const veh = prompt('Vehículo:\n1. Berlingo blanca\n2. Partner gris\n3. Sprinter verde\n4. Saveiro')
        const km = parseInt(prompt('Km de salida:'))
        if (!veh || !km) return
        const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        await supabase.from('recorridos').update({ estado: 'en-ruta', hora_salida: hora, vehiculo: veh, km_salida: km }).eq('id', btn.dataset.salida)
        await load()
      }
    })

    content.querySelectorAll('[data-regreso]').forEach(btn => {
      btn.onclick = async () => {
        const km = parseInt(prompt(`Km de regreso (salida: ${btn.dataset.kmSal}):`))
        if (!km || km <= parseInt(btn.dataset.kmSal)) { alert('Km inválido'); return }
        await supabase.from('recorridos').update({ estado: 'completado', km_regreso: km }).eq('id', btn.dataset.regreso)
        await load()
      }
    })

    content.querySelectorAll('[data-entregar]').forEach(btn => {
      btn.onclick = async () => {
        const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        await supabase.from('recorrido_pedidos').update({ estado: 'entregado', hora_entrega: hora }).eq('id', btn.dataset.pidx)
        await load()
      }
    })
  }

  await load()
}
