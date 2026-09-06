# Empieza aquí

Tres pasos, unos quince minutos. Al terminar, el sistema está de pie con tu
usuario dentro y la parrilla lista para recibir la primera semana.

---

## 1. Crea el proyecto en Supabase · 5 minutos

En [supabase.com](https://supabase.com), New project.

| Campo | Qué poner |
|---|---|
| Nombre | motor-organico-saleads |
| Contraseña | Una larga. **Guárdala**, aparece una sola vez |
| Región | East US, que es donde corre Vercel por defecto |

Tarda un par de minutos en aprovisionarse.

## 2. Arranca la base · 1 comando

En Supabase: **Project Settings → Database → Connection string → URI**. Copia esa
cadena y reemplaza `[YOUR-PASSWORD]` por la contraseña del paso 1.

```
cd ~/Projects/motor-organico-saleads
./scripts/arrancar.sh "postgresql://postgres:TU-CLAVE@db.xxxxx.supabase.co:5432/postgres"
```

Aplica las once migraciones, crea las dos marcas y comprueba que las quince
tablas, el RLS y los nueve triggers quedaron en su sitio. Se puede correr las
veces que haga falta.

## 3. Entra · 5 minutos

**Tu usuario.** En Supabase → Authentication → Add user → Create new user, con tu
correo y una contraseña. Luego, para darte el rol de editora:

```
psql "postgresql://postgres:TU-CLAVE@db.xxxxx.supabase.co:5432/postgres" \
  -f supabase/migrations/0003_accesos.sql
```

**Las llaves.** En Supabase → Project Settings → API. Copia `.env.example` a
`.env.local` y llena las tres primeras:

```
NEXT_PUBLIC_SUPABASE_URL=       ← Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  ← anon public
SUPABASE_SERVICE_ROLE_KEY=      ← service_role (esta no sale nunca del servidor)
APP_URL=http://localhost:3000
CRON_SECRET=                    ← cualquier cadena larga que inventes
```

**Levántalo.**

```
npm install
npm run dev
```

Entra a http://localhost:3000 con tu correo, y luego a `/diagnostico`: recorre
todo el sistema y dice qué falta y cómo resolverlo.

---

## Lo que va después, sin prisa

| Cuándo | Qué |
|---|---|
| El mismo día | Arrancar la verificación del negocio en Meta: tarda de 5 a 15 días hábiles y bloquea el App Review de otros 20 |
| Cuando tengas un rato | La cuenta de servicio de Google, para que la hoja y los videos entren solos |
| Cuando Meta apruebe | Conectar las cuentas en `/ajustes` y encender el motor de comentarios |

El paquete para Meta, con los permisos justificados uno por uno, el guion del
screencast y la política de privacidad, está en [docs/tramites/](docs/tramites/).

Mientras esos trámites corren, el sistema ya sirve: la parrilla, la preparación
de las piezas, la aprobación y la bandeja manual funcionan sin ningún permiso de
plataforma.
