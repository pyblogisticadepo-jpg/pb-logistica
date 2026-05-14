import { supabase } from './lib/supabase.js'
import { renderResumen } from './pages/resumen.js'
import { renderPicking } from './pages/picking.js'
import { renderClientes } from './pages/clientes.js'
import { renderTransportes } from './pages/transportes.js'
import { renderDespacho } from './pages/despacho.js'
import { renderRecorridos } from './pages/recorridos.js'
import { renderVehiculos } from './pages/vehiculos.js'
import { renderRecepcion } from './pages/recepcion.js'
import { renderProductividad } from './pages/productividad.js'
import { renderUsuarios } from './pages/usuarios.js'

const ROLES_LABEL = {
  jefe: 'Jefe de área',
  logistica: 'Logística junior',
  operario: 'Operario',
  vendedor: 'Vendedor',
  observador: 'Observador'
}

const ROLES_CLASS = {
  jefe: 'role-jefe',
  logistica: 'role-logistica',
  operario: 'role-operario',
  vendedor: 'role-vendedor',
  observador: 'role-directivo'
}

const MODULES = [
  { id: 'resumen',       label: 'Resumen diario', icon: 'ti-layout-dashboard', roles: ['jefe','logistica','operario','vendedor','observador'], section: 'General' },
  { id: 'clientes',      label: 'Clientes',        icon: 'ti-building-store',   roles: ['jefe','logistica','vendedor','observador'],            section: 'Operaciones' },
  { id: 'transportes',   label: 'Transportes',     icon: 'ti-truck',            roles: ['jefe','logistica','operario','observador'],            section: 'Operaciones' },
  { id: 'picking',       label: 'Picking',         icon: 'ti-package',          roles: ['jefe','logistica','observador'],                       section: 'Operaciones' },
  { id: 'despacho',      label: 'Despacho',        icon: 'ti-truck-delivery',   roles: ['jefe','logistica','operario','observador'],            section: 'Operaciones' },
  { id: 'recorridos',    label: 'Recorridos',      icon: 'ti-route',            roles: ['jefe','logistica','operario','observador'],            section: 'Operaciones' },
  { id: 'vehiculos',     label: 'Vehículos',       icon: 'ti-car',              roles: ['jefe','logistica','operario','vendedor','observador'], section: 'Operaciones' },
  { id: 'recepcion',     label: 'Recepción',       icon: 'ti-forklift',         roles: ['jefe','logistica','operario','observador'],            section: 'Depósito' },
  { id: 'productividad', label: 'Productividad',   icon: 'ti-chart-bar',        roles: ['jefe','observador'],                                  section: 'Análisis' },
  { id: 'usuarios',      label: 'Usuarios',        icon: 'ti-users',            roles: ['jefe'],                                               section: 'Administración' },
]

let currentUser = null
let sidebarOpen = false

function renderApp() {
  document.getElementById('app').innerHTML = `
    <div class="login-screen" id="login-screen">
      <div class="login-box">
        <div class="logo">
          <div class="logo-main">P<span>&</span>B</div>
          <div class="logo-sub">Logística</div>
        </div>
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="login-email" placeholder="tu@email.com">
        <label class="form-label">Contraseña</label>
        <input class="form-input" type="password" id="login-pass" placeholder="••••••••">
        <div class="login-error" id="login-error"></div>
        <button class="login-btn" id="login-btn">Ingresar</button>
      </div>
    </div>

    <div class="app-screen" id="app-screen">
      <div class="topbar">
        <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Menú">
          <i class="ti ti-menu-2"></i>
        </button>
        <div class="topbar-logo">P<span>&</span>B <span style="font-family:'DM Sans',sans-serif;font-size:11px;color:#333;letter-spacing:3px;font-weight:400">LOGÍSTICA</span></div>
        <div class="topbar-divider"></div>
        <div class="topbar-user">
          <span class="user-name" id="user-name-display"></span>
          <span class="role-tag" id="role-display"></span>
          <button class="logout-btn" id="logout-btn"><i class="ti ti-logout"></i> Salir</button>
        </div>
      </div>
      <div class="app-body">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <nav class="sidebar" id="main-nav"></nav>
        <div class="content" id="main-content">
          <div id="page-resumen" class="page"></div>
          <div id="page-clientes" class="page"></div>
          <div id="page-transportes" class="page"></div>
          <div id="page-picking" class="page"></div>
          <div id="page-despacho" class="page"></div>
          <div id="page-recorridos" class="page"></div>
          <div id="page-vehiculos" class="page"></div>
          <div id="page-recepcion" class="page"></div>
          <div id="page-productividad" class="page"></div>
          <div id="page-usuarios" class="page"></div>
          <div id="page-denied" class="page">
            <div class="access-denied">
              <i class="ti ti-lock"></i>
              <div class="access-denied-title">Acceso denegado</div>
            </div>
          </div>
        </div>
      </div>
    </div>`

  document.getElementById('login-btn').onclick = doLogin
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
  document.getElementById('logout-btn').onclick = doLogout
  document.getElementById('sidebar-toggle').onclick = toggleSidebar
  document.getElementById('sidebar-overlay').onclick = closeSidebar
}

function toggleSidebar() {
  sidebarOpen = !sidebarOpen
  updateSidebar()
}

function closeSidebar() {
  sidebarOpen = false
  updateSidebar()
}

function updateSidebar() {
  const nav = document.getElementById('main-nav')
  const overlay = document.getElementById('sidebar-overlay')
  const toggle = document.getElementById('sidebar-toggle')
  if (sidebarOpen) {
    nav.classList.add('open')
    overlay.classList.add('visible')
    toggle.innerHTML = '<i class="ti ti-x"></i>'
  } else {
    nav.classList.remove('open')
    overlay.classList.remove('visible')
    toggle.innerHTML = '<i class="ti ti-menu-2"></i>'
  }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim()
  const pass = document.getElementById('login-pass').value
  const errEl = document.getElementById('login-error')
  errEl.style.display = 'none'
  if (!email || !pass) { errEl.textContent = 'Completá email y contraseña'; errEl.style.display = 'block'; return }
  try {
    document.getElementById('login-btn').textContent = 'Ingresando...'
    const { data: { user } } = await supabase.auth.signInWithPassword({ email, password: pass })
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile || !profile.activo) throw new Error('Usuario inactivo')
    currentUser = profile
    showApp()
  } catch (err) {
    const errEl = document.getElementById('login-error')
    errEl.textContent = 'Email o contraseña incorrectos'
    errEl.style.display = 'block'
    document.getElementById('login-btn').textContent = 'Ingresar'
  }
}

async function doLogout() {
  await supabase.auth.signOut()
  currentUser = null
  sidebarOpen = false
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app-screen').classList.remove('visible')
  document.getElementById('login-email').value = ''
  document.getElementById('login-pass').value = ''
  document.getElementById('login-btn').textContent = 'Ingresar'
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app-screen').classList.add('visible')
  document.getElementById('user-name-display').textContent = currentUser.nombre
  const rd = document.getElementById('role-display')
  rd.textContent = ROLES_LABEL[currentUser.rol] || currentUser.rol
  rd.className = 'role-tag ' + (ROLES_CLASS[currentUser.rol] || 'role-directivo')
  buildNav()
  showPage('resumen')
}

function buildNav() {
  const nav = document.getElementById('main-nav')
  nav.innerHTML = ''
  let lastSection = ''
  MODULES.forEach(mod => {
    if (!mod.roles.includes(currentUser.rol)) return
    if (mod.section !== lastSection) {
      const sec = document.createElement('div')
      sec.className = 'nav-section'
      sec.textContent = mod.section
      nav.appendChild(sec)
      lastSection = mod.section
    }
    const btn = document.createElement('button')
    btn.className = 'nav-btn'
    btn.dataset.page = mod.id
    btn.innerHTML = `<i class="ti ${mod.icon}"></i>${mod.label}`
    btn.onclick = () => { showPage(mod.id); closeSidebar() }
    nav.appendChild(btn)
  })
}

export function showPage(pageId) {
  const mod = MODULES.find(m => m.id === pageId)
  const hasAccess = mod && mod.roles.includes(currentUser.rol)
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  const btn = document.querySelector(`.nav-btn[data-page="${pageId}"]`)
  if (btn) btn.classList.add('active')
  if (!hasAccess) { document.getElementById('page-denied').classList.add('active'); return }
  const pageEl = document.getElementById('page-' + pageId)
  pageEl.classList.add('active')
  const isObserver = currentUser.rol === 'observador'
  const ctx = { currentUser, showPage, supabase, isObserver }
  switch (pageId) {
    case 'resumen':       renderResumen(pageEl, ctx); break
    case 'clientes':      renderClientes(pageEl, ctx); break
    case 'transportes':   renderTransportes(pageEl, ctx); break
    case 'picking':       renderPicking(pageEl, ctx); break
    case 'despacho':      renderDespacho(pageEl, { ...ctx, isObserver: ctx.isObserver || ctx.currentUser.rol === 'vendedor' }); break
    case 'recorridos':    renderRecorridos(pageEl, ctx); break
    case 'vehiculos':     renderVehiculos(pageEl, ctx); break
    case 'recepcion':     renderRecepcion(pageEl, ctx); break
    case 'productividad': renderProductividad(pageEl, ctx); break
    case 'usuarios':      renderUsuarios(pageEl, ctx); break
  }
}

async function init() {
  renderApp()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (profile && profile.activo) {
      currentUser = profile
      showApp()
    }
  }
}

init()