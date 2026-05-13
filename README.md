# P&B Logística

## Setup inicial — ejecutar UNA SOLA VEZ en Supabase

1. Entrá a tu proyecto Supabase → SQL Editor
2. Copiá el contenido de `src/lib/supabase.js` (la variable DB_SETUP_SQL)
3. Pegalo en el SQL Editor y ejecutalo
4. Esto crea todas las tablas y carga los vehículos iniciales

## Crear el usuario Tomas (jefe de área)

En Supabase → Authentication → Users → Add user:
- Email: tomas@puntobanca.com (o el que prefieras)
- Password: la que elijas
- Luego en SQL Editor ejecutar:
  INSERT INTO public.profiles (id, nombre, username, rol, activo)
  SELECT id, 'Tomas', 'tomas@puntobanca.com', 'jefe', true
  FROM auth.users WHERE email = 'tomas@puntobanca.com';

## Instalar dependencias

```bash
npm install
```

## Desarrollo local

```bash
npm run dev
```

## Build para producción

```bash
npm run build
```

## Deploy en Vercel

1. Subir esta carpeta a GitHub (repositorio nuevo)
2. En Vercel → New Project → importar el repositorio
3. Framework: Vite
4. Deploy
