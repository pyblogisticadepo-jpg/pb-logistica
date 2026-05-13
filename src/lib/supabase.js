import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edkwmethipkowetivbbu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVka3dtZXRoaXBrb3dldGl2YmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDY5MDMsImV4cCI6MjA5NDIyMjkwM30.Qz-nrnELvYiGcT5lkAAnQQAm39F00HD01b-PD2t7P7U'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// SQL para crear todas las tablas — ejecutar una vez en Supabase SQL Editor
export const DB_SETUP_SQL = `
-- USUARIOS (extiende auth.users de Supabase)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text not null,
  username text unique not null,
  rol text not null check (rol in ('jefe','logistica','operario','vendedor','directivo')),
  activo boolean default true,
  created_at timestamptz default now()
);

-- CLIENTES
create table if not exists public.clientes (
  id bigserial primary key,
  nombre text not null,
  direccion text,
  horario text,
  telefono text,
  aclaraciones text,
  transporte_id bigint,
  transporte_tipo text default 'pyb' check (transporte_tipo in ('pyb','externo','retira')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- NOTAS DE VENDEDORES EN CLIENTES
create table if not exists public.notas_clientes (
  id bigserial primary key,
  cliente_id bigint references public.clientes on delete cascade,
  autor text not null,
  texto text not null,
  created_at timestamptz default now()
);

-- TRANSPORTES EXTERNOS
create table if not exists public.transportes (
  id bigserial primary key,
  nombre text not null,
  direccion text not null,
  telefono text,
  contacto text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- PICKING
create table if not exists public.picking (
  id bigserial primary key,
  nota_pedido text not null,
  cliente_id bigint references public.clientes,
  cliente_nombre text not null,
  lineas integer not null,
  operario_arma text,
  operario_controla text,
  hora_inicio time,
  hora_fin time,
  timer_secs integer default 0,
  error_yn boolean default false,
  error_count integer default 0,
  documentacion text check (documentacion in ('fac_remito','fac_etiqueta','remito')),
  estado text default 'preparacion' check (estado in ('preparacion','armado','habilitado')),
  fecha date default current_date,
  hora_registro timestamptz default now()
);

-- RECORRIDOS
create table if not exists public.recorridos (
  id bigserial primary key,
  codigo text unique not null,
  operario text not null,
  estado text default 'pendiente' check (estado in ('pendiente','en-ruta','completado')),
  hora_salida time,
  hora_regreso time,
  vehiculo text,
  km_salida integer,
  km_regreso integer,
  fecha date default current_date,
  created_at timestamptz default now()
);

-- PEDIDOS EN RECORRIDO
create table if not exists public.recorrido_pedidos (
  id bigserial primary key,
  recorrido_id bigint references public.recorridos on delete cascade,
  nota_pedido text not null,
  cliente_nombre text not null,
  direccion text,
  tipo text check (tipo in ('pyb','externo')),
  transporte_nombre text,
  orden integer not null,
  estado text default 'pendiente' check (estado in ('pendiente','entregado')),
  hora_entrega time,
  foto_url text,
  observaciones text
);

-- RETIRAS CLIENTE
create table if not exists public.retiras (
  id bigserial primary key,
  nota_pedido text not null,
  cliente_nombre text not null,
  documentacion text,
  estado text default 'pendiente' check (estado in ('pendiente','retirado')),
  hora_retiro time,
  fecha date default current_date,
  created_at timestamptz default now()
);

-- VEHICULOS
create table if not exists public.vehiculos (
  id bigserial primary key,
  nombre text not null,
  patente text,
  km_actual integer default 0,
  activo boolean default true
);

-- REGISTRO DE USO DE VEHICULOS
create table if not exists public.vehiculos_uso (
  id bigserial primary key,
  vehiculo_nombre text not null,
  usuario text not null,
  motivo text,
  km_salida integer not null,
  km_regreso integer,
  fecha date default current_date,
  created_at timestamptz default now()
);

-- RECEPCIONES DE MERCADERIA
create table if not exists public.recepciones (
  id bigserial primary key,
  proveedor text not null,
  transporte text,
  bultos integer not null,
  controla text not null,
  observaciones text,
  fecha date default current_date,
  hora time default localtime,
  created_at timestamptz default now()
);

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.notas_clientes enable row level security;
alter table public.transportes enable row level security;
alter table public.picking enable row level security;
alter table public.recorridos enable row level security;
alter table public.recorrido_pedidos enable row level security;
alter table public.retiras enable row level security;
alter table public.vehiculos enable row level security;
alter table public.vehiculos_uso enable row level security;
alter table public.recepciones enable row level security;

-- Policies: usuarios autenticados pueden leer y escribir todo
create policy "auth_all" on public.profiles for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.clientes for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.notas_clientes for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.transportes for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.picking for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.recorridos for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.recorrido_pedidos for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.retiras for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.vehiculos for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.vehiculos_uso for all using (auth.role() = 'authenticated');
create policy "auth_all" on public.recepciones for all using (auth.role() = 'authenticated');

-- Datos iniciales: vehículos
insert into public.vehiculos (nombre, patente, km_actual) values
  ('Berlingo blanca', 'AA123BC', 0),
  ('Partner gris', 'AB456CD', 0),
  ('Sprinter verde', 'AC789EF', 0),
  ('Saveiro', 'AD012GH', 0)
on conflict do nothing;
`
