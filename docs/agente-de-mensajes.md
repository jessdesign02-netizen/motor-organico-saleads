# El agente de mensajes directos y ClaveChat

Documento para decidir, no para ejecutar. Explica qué existe hoy en cada lado,
dónde está la costura entre los dos, y qué decisiones quedan abiertas.

Escrito el 9-sep-2026, después de leer los dos repositorios.

---

## 1. Dos sistemas que hoy no se conocen

### ClaveChat (este repositorio)

Motor de **comentario → mensaje directo**. Alguien comenta la palabra clave en
una publicación, el sistema le manda un DM con el enlace rastreado, y ahí
termina. La especificación lo dice sin rodeos:

> El sistema termina cuando la persona llega a WhatsApp con la palabra correcta.

Lo relevante para esta decisión:

| | |
|---|---|
| Webhook de Meta | `/api/webhooks/instagram`, suscrito al campo **`comments`** |
| Envío | `graph.facebook.com/<PAGE_ID>/messages` con `recipient.comment_id` — respuesta privada, una sola vez, dentro de 7 días |
| Datos | `comments` + `dm_log`. Un hilo es *una persona en una publicación* |
| Chat en vivo | **Solo lectura.** Muestra el comentario y el mensaje que salió |
| Estado real | **Nunca ha hablado con Instagram.** `.env.local` no tiene ninguna variable de Meta |
| Trámites | Verificación de negocio y App Review **pendientes**, incluido `instagram_business_manage_messages` |

### Sofía Redes / Juan ADS (`Documents/APLICACIONESS/Sofia Redes Agente`)

Agente conversacional que atiende los DM de **@juan_adss**. Corre en n8n
(`primary-production-873d`, Railway), con memoria en su propia Supabase y el
modelo por OpenRouter.

| | |
|---|---|
| Webhook de Meta | campo **`messages`**, app `SaleADS_Soporte` — **publicada y funcionando** |
| Envío | `graph.instagram.com/v21.0/me/messages` |
| Datos | Supabase propia: `contacts` → `conversations` → `messages` |
| Pipeline | parsear → allowlist por username → describir adjunto → guardar → **buffer 30s** → ¿ya respondieron? → historial de 20 → agente → enviar |
| Estado real | En producción, verificado con DM reales desde el 18-ago |

### La observación que ordena todo

Son **dos campos distintos del webhook de Meta**: `comments` y `messages`. No
compiten. Un sistema atiende comentarios, el otro atiende conversaciones. Pueden
convivir sobre la misma cuenta sin pisarse — de hecho ya conviven.

Lo que falta no es fusionarlos: es que **el segundo se vea en la pantalla del
primero**.

---

## 2. Las dos bases de datos no se cruzan

Es la pregunta que apareció primero, y la respuesta corta es que **no hay que
cruzarlas**.

No existe un `join` entre dos proyectos de Supabase, y no hace falta: **n8n es
el puente**, porque ya habla por HTTP con las dos. Cada base conserva su trabajo:

| Base | Qué guarda | Quién la lee |
|---|---|---|
| Supabase de Sofía | La memoria del agente: los 20 mensajes que arma el contexto | n8n, en cada turno |
| Supabase de ClaveChat | Lo que el equipo necesita ver y operar | Esta aplicación |

El agente escribe en las dos. Es duplicación, sí, y es deliberada: **si ClaveChat
se cae, el agente no se entera y sigue respondiendo.** Unificar en una sola base
es posible más adelante, cuando la costura esté probada, y significa repuntar
`Format historial` y los `Guardar msg` de n8n — que es exactamente lo que le da
memoria al agente en producción. No es el primer cambio que conviene hacer.

---

## 3. Cómo queda la costura

```
DM de Instagram
      │
      ▼
  Meta · app SaleADS_Soporte (ya aprobada, ya funcionando)
      │
      ▼
  n8n  ── el cerebro ───────────────────────────────────┐
      │                                                 │
      │  1. avisa: "entró este mensaje"  ───────────────►│  ClaveChat
      │  2. recibe: ¿este hilo está pausado?  ◄──────────│  guarda y responde
      │     si lo está, se calla y no contesta           │
      │  3. buffer 30s · historial · modelo              │
      │  4. avisa: "respondí esto"  ────────────────────►│
      │                                                 │
      ▼                                                 ▼
  Graph API · sale el DM                        Chat en vivo lo muestra
```

**n8n se queda como el borde con Meta.** No porque sea más elegante, sino porque
es lo único que hoy tiene permisos vivos: su app está publicada y entregando. Que
ClaveChat tome el webhook `messages` exige un App Review que todavía no pasó.

Esa es la decisión de fondo del documento, y es lo que permite que esto funcione
esta semana en vez del mes que viene.

---

## 4. Lo que ya está construido

Todo esto está en el árbol, con tipos, lint y las 300 pruebas en verde.

**`supabase/migrations/0013_chats.sql`** — dos tablas nuevas

- `dm_threads`: una persona, un hilo. Se identifica por `contacto_external_id`
  (el IGSID) sin necesidad de la cuenta, porque Meta emite ese identificador por
  par app+cuenta receptora: la misma persona escribiéndole a dos cuentas trae dos
  identificadores distintos. Lleva `agente_pausado_hasta`.
- `dm_messages`: cada turno, con `autor` de tipo `persona | agente | humano`.
  Índice único parcial sobre `external_message_id` para que un reintento de Meta
  no duplique el mensaje. Un trigger mantiene `ultimo_at` del hilo.

**`/api/agente/mensaje`** — la puerta del agente

`POST` con `Authorization: Bearer $AGENTE_SECRET`, comparado en tiempo constante
igual que los cron. Sin la variable puesta, la puerta queda cerrada, no abierta.

```json
{
  "contacto_external_id": "1035943998211036",
  "contacto_username": "santitapias__",
  "autor": "persona",
  "texto": "Hola Juan, ¿esto me sirve para mi negocio?",
  "external_message_id": "aWdfZG1f...",
  "enviado_at": "2026-09-09T19:04:00.000Z"
}
```

Responde `{ "hilo": "...", "pausado": false, "repetido": false }`. **`pausado` es
lo único que al agente le importa**: si el equipo tomó el hilo, se calla.

**Chat en vivo** ahora muestra las dos cosas, con filtros para separarlas. Un
hilo de DM no tiene palabra clave ni clics, así que en su lugar muestra cuántos
mensajes lleva y si el agente está atendiendo o en pausa.

---

## 5. Las decisiones

### A · Cómo llega n8n hasta aquí

| | Cómo | A favor | En contra |
|---|---|---|---|
| **Directo a Supabase** | n8n hace `POST` a PostgREST con la `service_role` de ClaveChat | Funciona **hoy en localhost**, sin desplegar ni exponer nada | n8n carga otra `service_role`; sin validación ni lógica de pausa del lado del servidor |
| **Ruta API** | n8n llama `/api/agente/mensaje` | Una sola puerta, validada, con la pausa resuelta en un viaje | Pide URL pública: túnel o Vercel |

Recomiendo **empezar directo a Supabase para verlo funcionando hoy**, y pasar a
la ruta API en cuanto haya URL. Las tablas son las mismas, así que no se tira
nada.

Vale la pena decirlo: repartir la `service_role` por los `jsCode` de n8n es
exactamente la deuda que el repositorio de Sofía lleva anotada desde agosto y
sigue abierta. Es aceptable como paso intermedio, no como destino.

### B · Quién pausa, y cómo se entera el agente

Elegiste que el equipo también responda **desde la app de Instagram**, no solo
desde la herramienta. Eso descarta la pausa ingenua.

La buena noticia es que se puede resolver, y solo se puede resolver aquí: n8n ya
recibe los `is_echo` de Meta —copias de todo lo que sale de la cuenta— y hoy
**los descarta** para no responderse a sí mismo. Un echo cuyo texto n8n no envió
es un humano escribiendo desde el celular. Con eso:

1. el mensaje aparece en Chat en vivo con `autor: "humano"`, y
2. el hilo se pausa solo.

Falta decidir **cuánto dura la pausa**: 6 horas, 24, o hasta que alguien la
levante a mano. Es lo único que queda por definir de este punto.

### C · Escribir desde la herramienta

Todavía no está construido. Cuando lo esté, el texto sale por n8n hacia la Graph
API, para que el token de Instagram siga viviendo en un solo lugar. La
alternativa —que ClaveChat envíe directo— obliga a traer el token de la cuenta
aquí y a mantenerlo en dos sitios.

### D · Qué pasa cuando ClaveChat tome el borde

Cuando pase el App Review con `instagram_business_manage_messages`, el webhook
`messages` puede apuntar aquí y n8n queda como cerebro puro. Es más limpio y
ahorra un salto.

**No conviene hacerlo antes de tiempo.** Hay una lección cara del 18-ago anotada
en el repositorio de Sofía: al desconectar una cuenta de una app, Meta revocó su
token *al instante*, y todo lo que funcionaba un minuto antes empezó a devolver
`HTTP 400`. La regla que quedó escrita es **primero el token nuevo funcionando,
después soltar el viejo**.

---

## 6. Lo que no está verificado

Honestidad sobre los bordes de este documento:

- **La allowlist sigue activa.** El agente solo responde a cuatro cuentas
  (`jessartesana`, `godiblog`, `karencardonas11`, `santitapias__`), y está en dos
  sitios de n8n. Mientras siga puesta, en Chat en vivo solo se verán esas
  conversaciones — no es que la integración falle.
- **No abrí n8n en esta sesión.** Todo lo que digo de ese lado sale de leer el
  repositorio de Sofía, que está bien documentado pero es de agosto. Los nodos
  concretos hay que mirarlos antes de tocarlos.
- **La migración `0013` no se ha corrido.** Hasta que no pase por el SQL Editor
  de Supabase, Chat en vivo no tiene de dónde leer los hilos.
- **ClaveChat nunca ha recibido un DM.** Toda la ruta de mensajes directos de
  este lado es código nuevo sin un solo mensaje real encima.

---

## 7. El orden que propongo

1. Correr `0013_chats.sql` en el SQL Editor de la Supabase de ClaveChat.
2. Insertar un hilo y dos mensajes a mano, y confirmar que se ven en `/chat`.
   Prueba la pantalla sin depender de n8n.
3. Agregar a n8n los dos avisos —entrante y saliente— contra Supabase directo.
4. Escribirle un DM a @juan_adss desde una cuenta de la allowlist y ver aparecer
   la conversación completa.
5. Recién ahí: la pausa, y escribir desde la herramienta.
