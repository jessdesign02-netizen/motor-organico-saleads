# Paso 1 · Verificación técnica de APIs

Fecha de consulta: 5 de septiembre de 2026. Cada punto de la sección 10 de CLAUDE.md,
con la fuente oficial. Lo que queda sin confirmar aparece marcado.

---

## Meta / Instagram

### 1. Publicación de Reels y feed

| Punto | Hallazgo | Fuente |
|---|---|---|
| Endpoints | `POST /<IG_ID>/media` crea el contenedor, `POST /<IG_ID>/media_publish` lo publica. El estado se consulta con `GET /<IG_CONTAINER_ID>?fields=status_code` | [Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) |
| Permisos, ruta Instagram Login | `instagram_business_basic`, `instagram_business_content_publish` | misma |
| Permisos, ruta Facebook Login | `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` | misma |
| Límite 24 h | 100 publicaciones por API en ventana móvil de 24 horas. Un carrusel cuenta como una | misma |
| Requisito de cuenta | Cuenta profesional de Instagram, con Página asociada | misma |

**Implicación.** El volumen de la especificación es 14 piezas semanales, con plan de 28.
El techo de 100 diarias deja el crecimiento cubierto por años.

### 2. Respuesta privada a un comentario

| Punto | Hallazgo | Fuente |
|---|---|---|
| Endpoint | `POST /<PAGE_ID>/messages` con `"recipient": { "comment_id": "<COMMENT_ID>" }` | [Private Replies](https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies) |
| Ventana | 7 días contados desde la creación del comentario. En Live, solo durante la transmisión | misma |
| Unicidad | Una respuesta privada por comentario, de forma permanente | [Postproxy](https://postproxy.dev/how-to/instagram-comment-to-dm-private-reply/) |
| Permisos | `instagram_manage_comments` más `pages_messaging`, token de Página con rol MESSAGING, Human Agent feature y Advanced Access. La ruta Instagram Login usa `instagram_business_manage_messages` | Private Replies + [guía de aprobación](https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/) |

**Choque con la regla 6 de la especificación.** La regla dice que los comentarios en
publicaciones antiguas siguen recibiendo respuesta mientras la palabra clave esté activa.
Meta cierra la puerta a los 7 días del comentario. La regla se sostiene solo en su
lectura correcta: el comentario nuevo sobre una publicación vieja sí recibe respuesta,
porque los 7 días corren desde el comentario. El comentario que lleva más de una semana
sin atender pasa a la bandeja manual con su motivo.

### 3. Webhook de comentarios

| Punto | Hallazgo | Fuente |
|---|---|---|
| Campo | `comments` | [Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks) |
| Permisos | `instagram_business_basic` + `instagram_business_manage_comments`, o la ruta con Facebook Login: `instagram_basic`, `instagram_manage_comments`, `pages_manage_metadata`, `pages_read_engagement`, `pages_show_list` | misma |
| Condición dura | La app debe estar en modo **Live** y la cuenta profesional debe ser pública | misma |
| Latencia observada | 1 a 5 segundos habitual, 5 a 30 segundos en horas pico | [Unipile](https://www.unipile.com/how-to-use-instagram-api-webhooks-for-real-time-notifications/) |

**Implicación.** La latencia justifica el sondeo de respaldo que pide la especificación:
el webhook manda, el sondeo cada pocos minutos recoge lo que se perdió, y la idempotencia
por `external_comment_id` evita la respuesta doble.

### 4. App Review y verificación de negocio

| Punto | Hallazgo | Fuente |
|---|---|---|
| Orden | La verificación del negocio en Meta Business Manager va antes del App Review | [guía 2026](https://singhamandeep.com/instagram-api-advanced-access-approval/) |
| Tiempo de verificación | 5 a 15 días hábiles | misma |
| Tiempo de App Review | Alrededor de 20 días reportados en 2026 | [bundle.social](https://bundle.social/blog/meta-app-review-20-days) |
| Evidencia | Screencast con el flujo completo y reproducible: login, consentimiento del scope, envío y recepción real por API | misma |
| Detalle que acelera | Correo de dominio corporativo en lugar de Gmail | misma |

### 5. Límites de tasa de mensajería

| Punto | Hallazgo | Fuente |
|---|---|---|
| Respuestas privadas | Alrededor de 750 por hora sobre publicaciones | [conferbot](https://www.conferbot.com/limits/instagram) |
| Llamadas por segundo | 2 por segundo por cuenta profesional en endpoints de mensajería | misma |

**Implicación para el caso de 300 comentarios.** A 2 llamadas por segundo, 300 respuestas
salen en 150 segundos. El techo horario de 750 cubre el pico con margen. La cola se
dimensiona a 2 envíos por segundo por cuenta, con espera creciente ante el código 613.

### Sin confirmar

**Reglas sobre enlaces en el primer mensaje.** La página de política de mensajería devolvió
404 en esta consulta. Queda como pregunta abierta antes de la Fase 6. El diseño ya la
cubre por otra vía: el mensaje entrega un enlace propio (`bio.saleads.co/r/{slug}`) que
redirige a WhatsApp, así que el dominio que viaja en el mensaje es de SaleADS y el destino
final se cambia sin tocar el mensaje.

---

## TikTok

| Punto | Hallazgo | Fuente |
|---|---|---|
| Scope de publicación | `video.publish`, con aprobación previa de la app | [Content Posting](https://developers.tiktok.com/doc/content-posting-api-get-started/) |
| Directo | `POST /v2/post/publish/video/init/` con `source: FILE_UPLOAD` o `PULL_FROM_URL` | misma |
| Estado | `POST /v2/post/publish/status/fetch/` con el `publish_id` | misma |
| Auditoría | El contenido de clientes sin auditar queda restringido a visibilidad privada. La auditoría levanta esa restricción | misma |
| Comentarios | El API público carece de lectura y de respuesta a comentarios de videos propios. La Research API los lee, y está reservada a investigadores académicos aprobados | [Research API](https://developers.tiktok.com/docs/en/research-api-specs-query-video-comments) |
| Mensajes directos | Fuera del API público. Existe una Business Messaging API para cuentas autorizadas, con acceso restringido | [TikTok Business Messaging](https://business-api.tiktok.com/portal/bm-api/education-hub) |

**Conclusión.** TikTok entra completo a la bandeja manual en la Fase 1, tal como lo previó
la especificación. La publicación directa espera la auditoría; hasta entonces el borrador
queda en el buzón del creador.

---

## YouTube

| Punto | Hallazgo | Fuente |
|---|---|---|
| Subida | `videos.insert` cuesta 1 unidad dentro de un bucket propio de Video Uploads, con 100 llamadas al día | [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert) |
| Cuota general | 10.000 unidades diarias para el resto de los métodos | [Quota cost](https://developers.google.com/youtube/v3/determine_quota_cost) |
| Leer comentarios | `commentThreads.list` cuesta 1 unidad, `comments.list` cuesta 1 | misma |
| Responder | `comments.insert` cuesta 50 unidades y crea respuestas dentro de un hilo, con `parentId`. El comentario de primer nivel se crea con `commentThreads.insert` | [comments.insert](https://developers.google.com/youtube/v3/docs/comments/insert) |
| Scope | `https://www.googleapis.com/auth/youtube.force-ssl` | misma |

**Hallazgo que cambia el alcance.** La especificación manda YouTube a la bandeja manual.
El API sí permite responder públicamente a un comentario. El presupuesto manda: 10.000
unidades diarias dividido en 50 por respuesta da 200 respuestas al día, y el sondeo de
hilos consume aparte. La recomendación va en el plan de fases: respuesta pública
automática en YouTube dentro de un cupo diario configurable, con desborde a bandeja manual.

**Corrección respecto al supuesto de partida.** El costo de subida ya vive en un bucket
separado de 100 llamadas diarias. El cálculo antiguo de 1.600 unidades por subida sobre
la cuota general dejó de aplicar, y con él desaparece el cuello de botella de 6 videos
diarios.

---

## Resumen de decisiones que salen de aquí

| Decisión | Motivo |
|---|---|
| Instagram automático de punta a punta | Publicación y respuesta privada disponibles por API |
| Ventana de 7 días como regla de negocio explícita | Límite duro de Meta sobre `comment_id` |
| Cola a 2 envíos por segundo por cuenta | Límite de tasa de mensajería |
| Webhook con sondeo de respaldo e idempotencia | Latencia de hasta 30 segundos y entregas repetidas |
| TikTok a bandeja manual completa en Fase 1 | El API deja comentarios y DM fuera |
| YouTube a respuesta pública automática con cupo | `comments.insert` disponible a 50 unidades |
| App Review arranca el día uno | 5 a 15 días de verificación más 20 de revisión |
