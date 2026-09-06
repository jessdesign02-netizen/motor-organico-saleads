# Diagnóstico QA · Entregas 8 a 10

Continuación de [diagnostico.md](diagnostico.md). Cubre el cierre de la Fase 1 y
las fases 2 y 3 completas. Fecha: 5 de septiembre de 2026.

**Estado global.** Puerta en verde: 0 errores de tipos, 0 de lint, **109 pruebas
automáticas**, compilación limpia, y **65 reglas verificadas** contra Postgres.

---

## Hallazgos

Cinco defectos más, encontrados al auditar lo recién escrito.

### H7 · La propuesta de calendario movía piezas ya programadas

**Gravedad: alta.** Habría dejado la base en desacuerdo consigo misma.

El recorrido de fechas asistido tomaba las piezas de la semana en cualquier
estado, incluidas las ya programadas. Una pieza programada tiene su hora copiada
en `publications.programado_at`, así que cambiarle la fecha en `pieces` habría
dejado la parrilla diciendo una cosa y la cola de publicación otra: la pieza
saldría a la hora vieja mientras la pantalla mostraba la nueva.

**Corrección.** La propuesta alcanza solo a lo que todavía no salió a la cola:
borrador, revisión y aprobado. Al aplicarla, el `update` repite esa condición,
de modo que una pieza que se programó entre la propuesta y la confirmación queda
fuera por sí sola.

### H8 · El calendario se aplicaba en silencio

**Gravedad: media.** El mismo patrón del hallazgo H3, en código nuevo.

`aplicarCalendario` escribía fila por fila sin comprobar que la escritura
llegara. Con RLS de por medio, una fila fuera de alcance se salta sin ruido y la
pantalla habría dicho "calendario aplicado" sobre una semana intacta.

**Corrección.** Cada movimiento pasa por `exigirEscritura`, y el error nombra la
pieza que no se pudo mover.

### H9 · Faltaba el paso de borrador a revisión

**Gravedad: media.** Era un vacío del flujo, más que un defecto de código.

Las piezas nacen en borrador cuando llegan desde la hoja, y la revisión de Karen
empieza en el estado `revision`. Nadie tenía cómo dar ese paso: la matriz de
roles ya lo permitía al rol audiovisual, y la interfaz carecía del botón. La
parrilla se habría llenado de borradores sin camino hacia la aprobación.

**Corrección.** Acción `enviarARevision`, con el botón en el editor. El `update`
exige que la pieza esté en borrador, así que aplicarlo sobre una ya publicada no
la mueve.

### H10 · La biblioteca pública quedaba tras el login

**Gravedad: alta.** Rompía justo el propósito de la Fase 3.

`/api/recursos` existe para que la página pública de recursos se actualice sola.
El guardia de rutas la habría mandado a `/ingresar`, y la biblioteca habría
mostrado un error de sesión a cualquiera que la visitara.

**Corrección.** La ruta entra a la lista de públicas. Y la lista pasó a ser una
función probada: 14 casos que comprueban qué queda abierto y qué exige sesión,
para que el próximo endpoint público no se pierda de la misma manera.

### H11 · La herencia del caption vivía en dos sitios

**Gravedad: baja.** Deuda que se cobra sola con el tiempo.

La lógica de "usa el caption de la red, y si falta toma el base" estaba escrita
en la Server Action y otra vez en el trabajo de publicación. Dos copias de la
misma regla terminan separándose.

**Corrección.** `captionDeLaRed` en el dominio, con 8 pruebas. Al extraerla
apareció una validación que faltaba: el caption que pasa el límite de la
plataforma ahora se detiene al guardar, en lugar de fallar a la hora de salida.

---

## Entrega 8 · Cierre de la Fase 1

Lo que quedaba de los módulos 1, 2, 3 y 6 de la especificación.

| Módulo | Qué faltaba | Cómo quedó |
|---|---|---|
| 1 | Crear piezas dentro de la app | Alta desde la parrilla, con marca, tema y fecha |
| 1 | Marcar las incompletas señalando el campo | Cada celda de la parrilla dice qué le falta |
| 2 | Editor de caption con vista por red | Pestañas por red, con herencia del base y el límite de cada plataforma |
| 2 | Alta de recurso nuevo | Formulario en la biblioteca |
| 3 | Aprobación en bloque | Selección múltiple y aprobación de la semana en un envío |
| 3 | Recorrido de fechas asistido | Propuesta guardada, con confirmación en un clic |
| 6 | Comparativa por marca y por red | Tabla con publicadas, fallidas, detectados, enviados y bandeja |
| Sección 7 | Confirmar el cambio de la hoja | Diferencia campo por campo, con aceptar o dejar lo aprobado |

**9 reglas nuevas verificadas** contra la base: el caption por red nace vacío
para heredar, una sola propuesta viva por marca y semana, la propuesta nace sin
aplicar, y el envío a revisión deja quieta a la pieza que ya salió.

## Entrega 9 · Fase 2

Publicación en TikTok y YouTube por API, con respuesta automática donde la
plataforma la permite.

- **TikTok.** La casilla `publicacion_directa` de cada cuenta decide entre el
  buzón del creador y la publicación directa. Se enciende desde Ajustes el día
  que pasa la auditoría, sin tocar código. **6 pruebas** comprueban que cada
  bandera llame al endpoint que corresponde y que el caption viaje con la
  visibilidad pública.
- **YouTube.** Cupo diario de respuestas configurable por cuenta, sobre el valor
  por defecto del adaptador. **3 pruebas** comprueban que el cupo de la cuenta
  mande sobre el de la red, que descuente lo ya gastado en el día, y que la red
  sin cupo responda todo lo que llega.
- **Avisos internos.** Publicación fallida sin reintentos, borrador en el buzón
  de TikTok, y acceso por vencer. Cada aviso lleva una clave única, de modo que
  el cron que corre cada día no repite el mismo asunto. La clave del token
  incluye su fecha, así que renovarlo lo silencia solo.
- **Gestión de canales.** Alta y ajuste desde Ajustes. La referencia de la
  credencial se valida con forma de nombre de variable, y el secreto sigue
  viviendo fuera de la base.

## Entrega 10 · Fase 3

- **La biblioteca se actualiza sola.** `/api/recursos` devuelve lo activo,
  agrupado por sección, con caché de cinco minutos y CORS abierto. La página
  pública lo consume en lugar de mantenerse a mano. Acepta `?marca=saleads` para
  separar las dos bibliotecas.
- **Resultados ampliados.** Ranking de palabras clave, rendimiento por tema y por
  tipo de hook, y sugerencia de mejor hora. **10 pruebas** sobre funciones puras.

La sugerencia de hora exige un mínimo de tres piezas en la franja: una pieza
afortunada a las tres de la mañana deja de recomendarse como estrategia. Esa
regla tiene su propia prueba.

---

## Cobertura acumulada

| Capa | Comprobaciones |
|---|---|
| Palabra clave y coincidencia | 28 |
| Motor de comentarios | 18 |
| Ingesta de la parrilla | 13 |
| Guardia de rutas | 14 |
| Analítica de resultados | 10 |
| Caption por red | 8 |
| TikTok | 6 |
| Firma del webhook | 6 |
| Calendario | 6 |
| **Pruebas automáticas** | **109** |
| Reglas de negocio en la base | 33 |
| Matriz de roles | 23 |
| Entrega 8 en la base | 9 |
| **Reglas contra Postgres** | **65** |

## Lo que sigue dependiendo de trámites

Sin cambios respecto al informe anterior: verificación de negocio en Meta, App
Review de mensajería, auditoría de TikTok Content Posting, y las credenciales de
las cinco cuentas. El código de las tres fases ya está, y cada casilla se
enciende el día que llega su aprobación.

---

## Anexo · Prueba de humo sobre la app levantada

Las puertas de entrada, comprobadas contra el servidor corriendo, más allá de lo
que dicen los tipos y las pruebas.

| Camino | Esperado | Obtenido |
|---|---|---|
| `/ingresar` | La pantalla de entrada | 200, con su título |
| `/parrilla` sin sesión | Redirección a la entrada | 307 a `/ingresar?volver=/parrilla` |
| `/api/cron/publicar` sin cabecera | Rechazo | 401 |
| `/api/cron/publicar` con `CRON_SECRET` | Pasa el guardia | 200 |
| Webhook con firma inválida | Rechazo | 401 |
| Webhook con token de verificación incorrecto | Rechazo | 403 |
| `/api/recursos` sin sesión | Pasa el guardia | Responde sin redirigir |
| `/r/slug-inexistente` | Redirección en lugar de error | 307 |

### H12 · La ruta pública devolvía el detalle interno

**Gravedad: baja.** Salió de esta prueba, no de las anteriores.

Con la base fuera de alcance, `/api/recursos` respondía 500 con el mensaje de
error de Supabase. Es una ruta abierta a cualquiera, así que ese mensaje llegaba
a quien lo pidiera.

**Corrección.** El detalle se registra en el servidor, y hacia afuera va un 503
con un mensaje que no habla de la base.
