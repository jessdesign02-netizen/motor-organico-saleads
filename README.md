# Motor Orgánico · SaleADS

Publica el contenido orgánico de SaleADS y Juanads en Instagram, TikTok y
YouTube, y responde sola los comentarios que traen una palabra clave, entregando
un enlace de WhatsApp que alimenta el embudo comercial.

El contexto completo vive en [CLAUDE.md](CLAUDE.md) y la especificación funcional
en [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md).

## Estado

Las tres fases construidas, en diez entregas, cada una auditada.

- [docs/qa/diagnostico.md](docs/qa/diagnostico.md): Fase 1, seis defectos corregidos
- [docs/qa/diagnostico-fases-2-3.md](docs/qa/diagnostico-fases-2-3.md): fases 2 y 3, seis más
- [docs/qa/diagnostico-integracion.md](docs/qa/diagnostico-integracion.md): los defectos entre módulos, seis más

En total: **124 pruebas automáticas** y **77 reglas verificadas** contra Postgres.

El paso a paso para dejarlo operando está en
[docs/puesta-en-marcha.md](docs/puesta-en-marcha.md).

Lo que falta para operar depende de trámites: verificación de negocio en Meta,
App Review de mensajería, auditoría de TikTok, y las credenciales de las cuentas.

## Stack

Next.js 16 con App Router, TypeScript estricto, Supabase para datos, sesión y
almacenamiento, Tailwind 4, Zod, y Vercel Cron para los trabajos programados.

## Cómo levantarlo

1. `npm install`
2. Copia `.env.example` a `.env.local` y llena lo de Supabase.
3. En Supabase, corre `supabase/migrations` en orden, más `supabase/seed.sql`.
   `0003` va al final, después de crear tu usuario en Authentication.
   El paso a paso completo está en [docs/puesta-en-marcha.md](docs/puesta-en-marcha.md).
4. `npm run dev` y entra a http://localhost:3000
5. Abre `/diagnostico`: recorre las siete entregas y dice qué falta, con la
   instrucción para resolverlo.

## Cómo se prueba

```
npm run qa
```

Corre tipos, lint, las 68 pruebas, la compilación de producción y las dos
baterías contra la base. `npm run qa:base` corre solo la parte de Postgres:
levanta una instancia temporal, aplica las migraciones y comprueba las 47 reglas.

Necesita Postgres local para esa última parte: `brew install postgresql@17`.

## Cómo entra el equipo

Se entra por invitación, sin registro abierto.

| Rol | Qué puede hacer |
|---|---|
| Editora | Escribe captions, define palabra clave, mensaje y recurso. Aprueba el día. Administra cuentas |
| Aprobadora | Revisa la semana, aprueba y devuelve con comentario |
| Audiovisual | Carga el video y los datos de producción, hasta dejar la pieza en revisión |
| Observador | Lee la parrilla, el estado y las métricas |

Ema, Diego e Iván trabajan sobre la hoja de cálculo, así que no necesitan cuenta.

## Trabajos programados

`vercel.json` los declara. Los tres exigen la cabecera `Authorization: Bearer $CRON_SECRET`.

| Ruta | Cadencia | Qué hace |
|---|---|---|
| `/api/cron/sincronizar` | cada 15 min | Lee la hoja y crea o actualiza piezas |
| `/api/cron/video` | cada 30 min | Baja de Drive el video de lo que sale pronto y lo deja en Storage |
| `/api/cron/publicar` | cada 5 min | Publica lo que ya tiene hora, con reintentos de 2, 8 y 30 minutos |
| `/api/cron/escuchar` | cada 5 min | Respalda al webhook releyendo comentarios recientes |
| `/api/cron/limpiar` | cada hora | Borra las copias de video que ya cumplieron |
| `/api/cron/avisos` | cada día a las 8 | Revisa los accesos por vencer y deja el aviso |

## Rutas abiertas

Tres rutas quedan fuera del login, cada una con su propia puerta.

| Ruta | Quién la usa | Cómo se protege |
|---|---|---|
| `/api/webhooks/instagram` | Meta | Firma HMAC verificada en tiempo constante |
| `/api/cron/*` | Vercel Cron | Cabecera con `CRON_SECRET` |
| `/api/recursos` | La página pública de la biblioteca | Devuelve solo enlaces ya públicos |
| `/r/[slug]` | Quien recibió el mensaje | Redirige y cuenta el clic |

## Estructura

```
src/
  app/
    (app)/        parrilla, piezas, día, bandeja, recursos, avisos, resultados, diagnóstico, ajustes
    acciones/     Server Actions, con validación de rol y de escritura
    api/cron/     trabajos programados
    api/webhooks/ webhook de comentarios de Instagram
    r/[slug]/     redirector propio que cuenta los clics
  lib/
    dominio/      palabra clave, ventana, cola, calendario, ingesta, caption, analítica
    redes/        Instagram, YouTube, TikTok tras una misma interfaz
    google/       hoja de cálculo y descarga de Drive, con cuenta de servicio
    trabajos/     sincronizar, video, publicar, escuchar, motor de comentarios, avisos
    supabase/     clientes de sesión, de servicio y de navegador
  proxy.ts        refresco de sesión y guardia de rutas
supabase/migrations/   esquema, RLS y accesos
scripts/               arnés de QA de la base
```

## Reglas que viven en la base, no en el código

Un trigger sostiene la regla aunque la app falle o alguien escriba por otro lado.

- La palabra clave se guarda normalizada, y es única dentro de la marca mientras
  esté activa.
- Nada se programa sin fecha, palabra clave, mensaje y enlace rastreado.
- La aprobación precede a toda publicación.
- La escucha se activa sola cuando la publicación devuelve su identificador.
- Un comentario recibe una sola respuesta, y un autor una sola por publicación.
- La devolución regresa la pieza a revisión, libera su fecha y cancela sus salidas.

## Frontera del proyecto

El sistema termina cuando la persona llega a WhatsApp con la palabra correcta.
El embudo de WhatsApp ya está resuelto y queda fuera de alcance.
