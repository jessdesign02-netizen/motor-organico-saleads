# Especificación funcional · Motor Orgánico SaleADS

Documento de referencia para el desarrollo. Complementa a CLAUDE.md.

---

## 1. Problema

Publicar 14 piezas semanales en dos marcas y tres redes, y montar a mano la automatización de palabra clave de cada una el mismo día, consume los días de la responsable de contenido y obliga a reprogramar la semana completa cada vez que una pieza se devuelve.

## 2. Objetivo

Que la intervención diaria baje a una revisión y una aprobación, con las publicaciones saliendo con su automatización activa y con visibilidad de cuántos leads generó cada pieza.

---

## 3. Usuarios y permisos

| Rol | Permisos |
|---|---|
| Editora (Jess) | Crea y edita piezas, escribe captions, define palabra clave, variantes, recurso y mensaje. Aprueba el día. Ve todo |
| Aprobadora (Karen) | Revisa y aprueba la semana. Comenta y devuelve piezas |
| Audiovisual (Ema, Diego, Iván) | Carga video y datos de producción. Cambia estado hasta listo |
| Observador | Solo lectura de parrilla, estado y métricas |

Autenticación con Supabase Auth. Roles en tabla propia con políticas RLS por rol.

---

## 4. Modelo de datos

### brands
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| nombre | text | SaleADS, Juanads |
| slug | text | único |

### social_accounts
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| brand_id | uuid | FK brands |
| red | text | instagram, tiktok, youtube |
| handle | text | |
| external_account_id | text | id de la cuenta en la plataforma |
| credential_ref | text | referencia al secreto en variables de entorno o vault |
| token_expira_at | timestamptz | dispara alerta de renovación |
| activa | boolean | por defecto true |

### resources
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| titulo | text | requerido |
| descripcion | text | |
| tipo | text | pdf, skill, html, artefacto, video |
| url | text | enlace público del recurso |
| seccion | text | sección de la biblioteca |
| brand_id | uuid | FK brands |
| activo | boolean | |

### pieces
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| brand_id | uuid | FK brands |
| semana | date | lunes de la semana |
| tema | text | requerido |
| hook | text | |
| formato | text | reel, short, carrusel, historia |
| drive_url | text | video fuente |
| storage_path | text | copia del video para publicar |
| caption_base | text | |
| resource_id | uuid | FK resources, opcional |
| fecha_publicacion | date | requerido para programar |
| hora_publicacion | time | requerido para programar |
| responsable | text | |
| estado | text | borrador, revision, aprobado, programado, publicado, fallido |
| aprobada_por | uuid | FK usuarios |
| aprobada_at | timestamptz | |
| origen | text | sheet, app |
| sheet_row_id | text | para conciliar con la hoja de cálculo |

### keywords
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| piece_id | uuid | FK pieces |
| palabra | text | requerido, se guarda normalizada en mayúsculas |
| variantes | text[] | formas alternas, generadas y editables |
| activa_desde | timestamptz | igual al momento de publicación |
| activa_hasta | timestamptz | vacío significa vigencia indefinida |

### publications
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| piece_id | uuid | FK pieces |
| social_account_id | uuid | FK social_accounts |
| caption_final | text | caption adaptado a la red |
| estado | text | pendiente, publicando, publicado, fallido |
| external_post_id | text | id del post en la plataforma |
| permalink | text | |
| publicado_at | timestamptz | |
| intentos | int | por defecto 0 |
| ultimo_error | text | |

### dm_templates
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| piece_id | uuid | FK pieces |
| mensaje | text | texto del mensaje directo |
| cta_texto | text | texto del botón |
| destino_url | text | enlace rastreado que lleva a WhatsApp |

### tracked_links
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| piece_id | uuid | FK pieces |
| slug | text | único, forma bio.saleads.co/r/{slug} |
| destino_url | text | enlace final de WhatsApp con texto prellenado |
| clics | int | contador |

### comments
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| publication_id | uuid | FK publications |
| external_comment_id | text | único junto con publication_id |
| autor_username | text | |
| autor_external_id | text | |
| texto | text | |
| keyword_id | uuid | FK keywords, vacío cuando no coincide |
| estado | text | detectado, respondido, fallido, ignorado, manual_pendiente |
| detectado_at | timestamptz | |
| respondido_at | timestamptz | |

### dm_log
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| comment_id | uuid | FK comments, único |
| destinatario | text | |
| mensaje | text | |
| estado | text | enviado, fallido |
| enviado_at | timestamptz | |
| error | text | |

### approvals
| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid | PK |
| piece_id | uuid | FK pieces |
| usuario_id | uuid | |
| accion | text | aprobar, devolver |
| comentario | text | |
| creado_at | timestamptz | |

---

## 5. Módulos

### Módulo 1 · Ingesta de parrilla
- Lee la hoja de cálculo existente y crea o actualiza piezas.
- Concilia por sheet_row_id para evitar duplicados.
- Permite crear y editar piezas dentro de la app.
- Marca las piezas incompletas señalando qué campo falta.

### Módulo 2 · Preparación de la pieza
- Editor de caption con vista por red.
- Definición de palabra clave con generación automática de variantes (sin tilde, con letras repetidas, minúsculas, dentro de frase) y edición manual.
- Selección del recurso desde la biblioteca o alta de uno nuevo.
- Generación del enlace rastreado hacia WhatsApp con texto prellenado que incluye la palabra clave.
- Redacción del mensaje directo.

### Módulo 3 · Aprobación
- Vista semanal para Karen con aprobación por pieza o en bloque.
- Devolución con comentario, que regresa la pieza a estado revisión y notifica.
- Recorrido de fechas asistido cuando una pieza se devuelve, con propuesta de nuevo calendario y confirmación en un clic.

### Módulo 4 · Publicación
- Cola de publicación por fecha y hora.
- Panel del día que muestra lo que va a salir, con video, caption por red, palabra clave y mensaje.
- Aprobación del día en un clic que dispara la publicación.
- Publicación por API en cada red con reintentos y registro de error.
- Activación de la escucha de comentarios en el momento en que la publicación queda en vivo.

### Módulo 5 · Motor de comentarios
- Recepción de comentarios por webhook cuando la plataforma lo ofrece, con sondeo periódico como respaldo.
- Normalización del texto del comentario (minúsculas, sin tildes, sin signos) y comparación contra palabra y variantes, con coincidencia por contención dentro de la frase.
- Envío del mensaje directo con el enlace rastreado.
- Una respuesta por autor y por publicación.
- Bandeja manual para las redes sin API de respuesta, con comentario detectado, respuesta sugerida y botón de copiar.

### Módulo 6 · Resultados
- Por pieza, comentarios detectados, mensajes enviados, clics al enlace rastreado.
- Vista semanal comparativa por marca y por red.

---

## 6. Reglas de negocio

1. Toda pieza programada tiene palabra clave, mensaje directo y enlace rastreado antes de publicarse.
2. La palabra clave de un día es única dentro de la misma marca mientras esté activa.
3. La automatización se activa al confirmarse la publicación en vivo, usando el identificador externo que devuelve la plataforma.
4. La coincidencia de palabra clave funciona con tildes, sin tildes, en minúsculas, en mayúsculas, con letras repetidas y dentro de una frase.
5. Cada comentario recibe una sola respuesta. Un mismo autor recibe una sola respuesta por publicación.
6. Los comentarios en publicaciones antiguas siguen recibiendo respuesta mientras la palabra clave esté activa.
7. La aprobación de Jess precede a toda publicación.
8. La devolución de una pieza recalcula el calendario de la semana y espera confirmación.
9. Toda credencial próxima a expirar genera aviso con anticipación.
10. Los recursos permanecen disponibles de forma indefinida.

---

## 7. Casos especiales

| Situación | Comportamiento |
|---|---|
| La publicación falla en una red | Se reintenta con espera creciente, hasta tres veces, y se avisa a Jess con el error |
| La publicación sale en una red y falla en otra | Cada red lleva su propio estado, la automatización se activa donde sí salió |
| Llegan 300 comentarios en minutos | La cola procesa con control de tasa y respeta los límites de la plataforma, sin perder comentarios |
| El comentario trae la palabra dentro de una frase larga | Coincide y recibe respuesta |
| El autor comenta la palabra dos veces | Recibe una sola respuesta |
| El mensaje directo falla por límites de la plataforma | Queda en cola con reintento y pasa a bandeja manual tras agotar intentos |
| La red carece de API de respuesta | El comentario entra a la bandeja manual con respuesta sugerida lista para copiar |
| El token expira | El sistema pausa la publicación de esa cuenta y avisa |
| La hoja de cálculo cambia después de aprobada la pieza | El sistema marca la diferencia y pide confirmación antes de sobrescribir |

---

## 8. Criterios de aceptación

- [ ] Jess aprueba el día en una sola pantalla y las publicaciones salen a su hora.
- [ ] Una pieza publicada activa su automatización sin intervención manual.
- [ ] Un comentario con la palabra escrita de forma alterna recibe el mensaje directo.
- [ ] Una publicación con 300 comentarios queda respondida sin comentarios perdidos.
- [ ] Un mismo autor recibe una sola respuesta por publicación.
- [ ] La devolución de una pieza propone el nuevo calendario de la semana.
- [ ] Cada pieza muestra comentarios detectados, mensajes enviados y clics al enlace.
- [ ] Las redes sin API de respuesta muestran su bandeja manual con respuesta lista para copiar.

---

## 9. Fases

**Fase 1.** Ingesta de parrilla, preparación de pieza, panel del día con aprobación, publicación en Instagram, motor de comentarios en Instagram, bandeja manual para TikTok y YouTube.

**Fase 2.** Publicación en TikTok y YouTube por API, respuesta automática donde la plataforma lo permita.

**Fase 3.** Actualización automática de la biblioteca de recursos y panel de resultados ampliado.
