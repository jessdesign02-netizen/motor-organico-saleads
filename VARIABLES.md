# Variables de entorno · Motor Orgánico SaleADS

Para dejar el proyecto corriendo en tu máquina. Toma cinco minutos.

---

## 1. Crea el archivo

En la raíz del proyecto, crea un archivo llamado `.env.local` y pega esto:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=PEGA-AQUI-LA-ANON
SUPABASE_SERVICE_ROLE_KEY=PEGA-AQUI-LA-SERVICE-ROLE

# Operación
APP_URL=http://localhost:3000
CRON_SECRET=inventa-aqui-una-cadena-larga-cualquiera
ZONA_HORARIA=America/Bogota
```

Ese archivo queda solo en tu máquina: el repositorio lo ignora a propósito, para
que las claves nunca lleguen a GitHub.

## 2. Llena los tres valores de Supabase

Entra al proyecto en Supabase y ve a **Project Settings → API**. Ahí están los
tres, con estos nombres:

```
Project URL      →  NEXT_PUBLIC_SUPABASE_URL
anon public      →  NEXT_PUBLIC_SUPABASE_ANON_KEY
service_role     →  SUPABASE_SERVICE_ROLE_KEY
```

**Sobre la `service_role`.** Esa clave se salta todas las políticas de seguridad
de la base: quien la tenga puede leer y borrar cualquier cosa. Vive solo en el
servidor, y por eso su nombre no empieza por `NEXT_PUBLIC_`. Pídela por un canal
donde puedas borrarla después, o que te la dicten. Las otras dos son públicas por
diseño y viajan sin problema.

## 3. Inventa el `CRON_SECRET`

Cualquier cadena larga sirve. Es lo que impide que alguien dispare las
publicaciones desde fuera. Para generar una:

```
openssl rand -hex 32
```

## 4. Levanta el proyecto

```
npm install
npm run dev
```

Entra a http://localhost:3000 con el correo y la clave que te hayan creado en
Supabase.

## 5. Comprueba que quedó bien

Abre **http://localhost:3000/diagnostico**. Esa pantalla recorre todo el sistema
y dice qué está listo y qué falta, con la instrucción para resolver cada cosa.

Con solo las tres variables de Supabase deberías ver en verde la conexión, el
esquema y las marcas. El resto queda en ámbar hasta que se conecten Google, Meta
y las cuentas de red, y eso está bien: la parrilla, la preparación de piezas y la
aprobación ya funcionan sin ellas.

---

## Las que van después

Estas se llenan cuando cada trámite avanza. El sistema arranca sin ellas.

```
# Google, para que la hoja de cálculo y los videos entren solos
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Meta, para publicar en Instagram y responder comentarios
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=

# YouTube
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=

# El token de cada cuenta conectada. El nombre de la variable es lo que se
# guarda en la app, así que el token nunca entra a la base de datos.
# La referencia empieza por META_TOKEN_, TIKTOK_TOKEN_ o YOUTUBE_TOKEN_.
# META_TOKEN_SALEADS=
# META_TOKEN_SALEADS_PAGE_ID=
```

---

## Si algo sale mal

**"Faltan variables de entorno"** al arrancar: el mensaje dice cuál falta por su
nombre. Revisa que el archivo se llame `.env.local` exactamente, en la raíz del
proyecto.

**La pantalla de entrada aparece pero no deja entrar:** el usuario se crea en
Supabase, en Authentication, Add user. Sin eso no hay con qué entrar.

**Todo carga pero la parrilla sale vacía:** puede ser que no haya piezas todavía,
o que la sincronización con la hoja no esté configurada. `/diagnostico` distingue
las dos cosas.
