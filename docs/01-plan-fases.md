# Paso 2 · Plan de la Fase 1, dividido en entregas verificables

Siete entregas. Cada una funciona sola, y cada una cierra con una puerta de calidad
que se ejecuta y se registra antes de abrir la siguiente. Ninguna entrega avanza con
su puerta en rojo.

---

## Cómo se audita cada entrega

Toda puerta corre lo mismo, y suma lo suyo:

| Control | Herramienta |
|---|---|
| Tipos estrictos sin error | `tsc --noEmit` |
| Estilo y reglas del framework | `eslint` |
| Compilación de producción | `next build` |
| Pruebas de la entrega | `vitest run` |
| Reglas de negocio contra la base | script de verificación con cliente de servicio |
| Diagnóstico funcional | `/ajustes/diagnostico`, que recorre las siete entregas y dice qué falta |

El informe de cada puerta queda en `docs/qa/E<n>-diagnostico.md`, con hallazgos,
corrección aplicada y estado final.

---

## Entrega 1 · Fundación

**Alcance.** Next.js con App Router y TypeScript estricto, Tailwind, Zod, cliente de
Supabase para servidor y navegador, variables de entorno validadas al arranque con Zod,
y la estructura de carpetas de la sección 8 de CLAUDE.md.

**Criterio.** La app levanta, la conexión con Supabase responde, y un arranque sin una
variable obligatoria falla con el nombre de la variable que falta.

**Puerta QA.** Tipos, lint y build en verde. Ninguna credencial en el repositorio,
comprobado con búsqueda de patrones sobre el árbol y sobre el historial de git.

---

## Entrega 2 · Esquema, RLS y reglas en la base

**Alcance.** Las once tablas de la sección 4 de la especificación, con sus tipos
enumerados, claves foráneas y restricciones. Políticas RLS por cada uno de los cuatro
roles. Las reglas que no se negocian viven en la base:

| Regla de negocio | Cómo se garantiza |
|---|---|
| Palabra clave normalizada | Trigger sobre `keywords` |
| Palabra clave única por marca mientras esté activa | Índice único parcial más trigger de validación |
| Un comentario recibe una sola respuesta | Único sobre `(publication_id, external_comment_id)` y único sobre `dm_log.comment_id` |
| Un autor recibe una sola respuesta por publicación | Índice único parcial sobre `(publication_id, autor_external_id)` entre los respondidos |
| Devolver una pieza libera su fecha | Trigger sobre `approvals` |

**Criterio.** Un usuario con rol observador lee y falla al escribir. Una palabra clave
repetida en la misma marca es rechazada por la base aunque la app lo intente.

**Puerta QA.** Script que se conecta con cada rol y comprueba lectura y escritura
esperadas, tabla por tabla. Prueba de cada trigger con caso positivo y caso negativo.
Revisión de que cada tabla tenga RLS habilitado, sin excepción silenciosa.

---

## Entrega 3 · Acceso y roles

**Alcance.** Supabase Auth con entrada por invitación, tabla de perfiles con el rol,
guardia de rutas en el middleware, y pantalla de equipo para el rol editora.

**Criterio.** Cada persona entra con su correo y ve solo lo de su rol. Una ruta protegida
sin sesión redirige a la entrada.

**Puerta QA.** Prueba de las cuatro rutas por los cuatro roles, con la matriz completa
de permitido y denegado. Verificación de que la validación de rol viva también en el
servidor, más allá de lo que oculte la interfaz.

---

## Entrega 4 · Ingesta de la parrilla

**Alcance.** Lectura de la hoja de cálculo con cuenta de servicio, conciliación por
`sheet_row_id`, alta y edición de piezas dentro de la app, marca de pieza incompleta con
el campo que falta, y log de sincronización con el motivo de cada fila ignorada. Ante un
cambio en la hoja sobre una pieza ya aprobada, el sistema marca la diferencia y pide
confirmación antes de sobrescribir.

**Criterio.** Una fila nueva aparece como pieza sin duplicar nada al correr la ingesta
dos veces seguidas.

**Puerta QA.** Ingesta corrida tres veces sobre la misma hoja, con conteo estable de
filas. Caso de fila sin enlace de Drive, que queda en el log con su motivo. Caso de
cambio posterior a la aprobación, que espera confirmación.

---

## Entrega 5 · Preparación de la pieza

**Alcance.** Editor de caption con vista por red, palabra clave con generación de
variantes y edición manual, selección de recurso desde la biblioteca, enlace rastreado
hacia WhatsApp con texto prellenado, y redacción del mensaje directo.

La normalización que define todo el motor vive aquí, en una función pura: minúsculas,
tildes fuera, signos fuera, letras repetidas colapsadas. La coincidencia es por
contención dentro de la frase.

**Criterio.** Una pieza sin palabra clave, sin mensaje o sin enlace queda bloqueada para
programar, tanto en la interfaz como en el servidor.

**Puerta QA.** Batería de normalización con la tabla de casos: con tilde, sin tilde,
mayúsculas, letras repetidas, dentro de frase larga, con emojis, con signos pegados,
y los casos que deben fallar. Cada caso escrito antes de la implementación.

---

## Entrega 6 · Aprobación, panel del día y publicación en Instagram

**Alcance.** Vista semanal con aprobación por pieza y por bloque, devolución con
comentario que recalcula el calendario y espera confirmación, panel del día con
aprobación en un clic, y publicación en Instagram por contenedor de media con espera de
procesamiento. Reintentos con espera creciente hasta tres veces, estado propio por red,
y activación de la escucha en el momento en que la publicación devuelve su identificador.

**Criterio.** Una pieza aprobada sale a su hora, con su caption exacto, y su
automatización queda activa sin que nadie la toque.

**Puerta QA.** Publicación simulada con el API de Meta en modo de prueba. Caso de fallo
en una red y éxito en otra, comprobando que cada estado sea independiente. Caso de token
vencido, que pausa la cuenta y avisa. Prueba de idempotencia: la misma pieza pasada dos
veces por la cola publica una sola vez.

---

## Entrega 7 · Motor de comentarios, bandeja manual y resultados

**Alcance.** Webhook de comentarios con firma verificada, sondeo periódico de respaldo,
cola con control de tasa a dos envíos por segundo por cuenta, envío de la respuesta
privada dentro de la ventana de 7 días, bandeja manual para TikTok con respuesta
sugerida y botón de copiar, respuesta pública automática en YouTube dentro de un cupo
diario configurable, redirector propio que cuenta los clics, y panel de resultados por
pieza y por semana.

**Criterio.** Los ocho criterios de aceptación de la sección 8 de la especificación se
cumplen, cada uno con su prueba.

**Puerta QA.** La prueba que exige el encargo: 300 comentarios simulados sobre una misma
publicación, con repetidos del mismo autor, entregas duplicadas del webhook, variantes
mal escritas y comentarios fuera de ventana. Se mide que ninguno se pierda, que cada
autor reciba una sola respuesta, y que el ritmo respete el límite de la plataforma.

---

## Lo que queda automático y lo que queda en bandeja, según lo que permite cada API

| Red | Publicación | Respuesta |
|---|---|---|
| Instagram | Automática por API | Automática, respuesta privada dentro de 7 días |
| YouTube | Automática por API, hasta 100 subidas diarias | Automática y pública, con cupo de 200 diarias por cuota |
| TikTok | Borrador al buzón hasta pasar la auditoría | Bandeja manual con respuesta lista para copiar |

Las tres dependencias de trámite arrancan el día uno, porque suman más de un mes:
verificación del negocio en Meta, App Review de mensajería, y auditoría de TikTok.
El código queda listo antes que los permisos, y la casilla del canal se activa el día
que llega la aprobación.

---

## Cambios de alcance que salen de la verificación técnica

1. **YouTube pasa de bandeja manual a respuesta pública automática**, con cupo diario.
   El API lo permite a 50 unidades por respuesta.
2. **La regla 6 se precisa**: la ventana de 7 días corre desde el comentario, así que la
   publicación antigua sigue atendida mientras el comentario sea reciente. El comentario
   vencido entra a la bandeja manual con su motivo.
3. **La subida a YouTube deja de ser un cuello de botella**: el bucket propio de 100
   subidas diarias reemplaza el cálculo antiguo sobre la cuota general.
