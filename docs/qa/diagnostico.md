# Diagnóstico QA · Motor Orgánico SaleADS

Auditoría de las siete entregas, con lo que se encontró, lo que se corrigió y
cómo quedó comprobado. Fecha: 5 de septiembre de 2026.

**Estado global.** Puerta en verde: 0 errores de tipos, 0 de lint, 68 pruebas
automáticas, compilación de producción limpia, y 47 reglas verificadas contra un
Postgres real.

Se reproduce con `npm run qa`.

---

## Hallazgos, uno por uno

Seis defectos reales, encontrados por la auditoría y corregidos en el mismo paso.
Tres de ellos habrían llegado a producción sin dar la cara.

### H1 · La palabra clave repetida entraba a la base

**Gravedad: alta.** Rompía la regla 2 de la especificación.

`keywords` tenía dos triggers `before insert`: uno normalizaba la palabra y otro
comprobaba que estuviera libre. Postgres dispara los BEFORE en orden alfabético
del nombre, así que `keywords_disponible` corría antes que `keywords_normalizar`
y comparaba `automatiza` contra el `AUTOMATIZA` ya guardado. Nunca coincidían, y
la palabra repetida pasaba.

**Corrección.** Un solo trigger `preparar_keyword` normaliza y valida en el mismo
paso, de modo que el orden deja de importar.

**Comprobado.** `scripts/qa-esquema.sql`: la repetida es rechazada, la misma
palabra convive entre marcas distintas, y se libera cuando la anterior vence.

### H2 · Una regla pasaba la prueba por la razón equivocada

**Gravedad: media.** El defecto estaba en la prueba, y tapaba uno del código.

El trigger que impide programar una pieza incompleta armaba su lista de faltantes
con `faltan := faltan || 'texto'`. Sobre un arreglo vacío, Postgres lee ese texto
como literal de arreglo y revienta con `malformed array literal`. La pieza sí
quedaba rechazada, y por un error de sintaxis en lugar de por la validación: el
día que alguien arreglara la sintaxis, la regla se caía sin que nadie lo notara.

**Corrección.** `array_append` en lugar de la concatenación ambigua. Y la prueba
ahora exige el motivo del rechazo, además del rechazo: un `qa_debe_fallar` con
motivo esperado falla cuando el error viene de otra parte.

**Comprobado.** El rechazo llega con el texto correcto, y nombra los campos que
faltan.

### H3 · RLS deniega en silencio, y la app lo leía como éxito

**Gravedad: alta.** Afectaba a la interfaz, no a los datos.

Un `UPDATE` que la política deja fuera de alcance toca cero filas y devuelve sin
excepción. La primera versión de la prueba de roles daba eso por permitido, y la
app habría hecho lo mismo: mostrar "guardado" sobre algo que nunca se guardó.

**Corrección.** El arnés cuenta las filas afectadas. Y en la app, toda escritura
pasa por `exigirEscritura`, que trata la respuesta de cero filas como permiso
denegado y lo dice.

**Comprobado.** El observador falla al editar una pieza, la aprobadora falla al
borrarla, y en los dos casos el motivo llega a la pantalla.

### H4 · Dos mensajes a la misma persona

**Gravedad: alta.** Es el defecto que más se habría notado desde afuera.

La regla 5 dice que un autor recibe una sola respuesta por publicación. El motor
lo comprobaba contra lo ya guardado, y el envío ocurre después de recorrer el
lote entero. Dos comentarios del mismo autor dentro del mismo lote pasaban los
dos: la restricción única de la base rechazaba el segundo registro, y para
entonces esa persona ya tenía dos mensajes.

La base protege el registro. El envío necesitaba su propia barrera.

**Corrección.** El motor lleva el conjunto de autores comprometidos en la pasada
actual, y lo consulta antes de encolar.

**Comprobado.** En la prueba del pico, veinte comentarios de autores que ya
habían escrito quedan marcados `autor_repetido` y no generan envío.

### H5 · Un fallo inesperado borraba el comentario del resumen

**Gravedad: media.**

Si la llamada a la plataforma lanzaba una excepción en lugar de devolver un
fallo, la cola la capturaba y ese comentario desaparecía del resumen: quedaba
registrado en la base y sin desenlace visible. El criterio de aceptación pide
que ninguno se pierda.

**Corrección.** El envío corre dentro de su propio `try`, y la excepción deja el
comentario en la bandeja con su motivo.

**Comprobado.** El resumen del pico trae 300 desenlaces para 300 comentarios.

### H6 · Los tipos de la base resolvían a `never`

**Gravedad: baja.** Molestaba al desarrollo, sin llegar a producción.

El tipo `Database` describía cada tabla con `Row`, `Insert` y `Update`.
supabase-js exige además `Relationships`, y sin él resolvía toda consulta a
`never`, de modo que dieciséis llamadas quedaban sin verificación de tipos.

**Corrección.** `Relationships: []` en el tipo `Fila`. Ahí salió a la luz que el
almacén escribía en una columna `texto_motivo` inexistente, que ahora existe
como `motivo` y alimenta la bandeja manual.

---

## Entrega 1 · Fundación

| Control | Resultado |
|---|---|
| Tipos estrictos | 0 errores, con `noUncheckedIndexedAccess` activo |
| Lint | 0 errores |
| Compilación de producción | Limpia, 15 rutas |
| Variables de entorno | Validadas con Zod al arrancar, el fallo nombra la que falta |
| Secretos en el repositorio | Ninguno. Los tokens viven en el entorno, y la base guarda solo el nombre de la variable |

## Entrega 2 · Esquema, RLS y reglas en la base

Trece tablas, nueve tipos enumerados, siete triggers. **24 reglas verificadas**
contra Postgres 17, cada una con su caso positivo y su caso negativo.

| Regla de la especificación | Cómo quedó garantizada |
|---|---|
| 1 · Nada se programa incompleto | Trigger que nombra lo que falta |
| 2 · Palabra clave única por marca mientras esté activa | Trigger con solapamiento de vigencias |
| 3 · La escucha se activa con el identificador externo | Trigger sobre `publications` |
| 5 · Un comentario, una respuesta | Único `(publication_id, external_comment_id)` |
| 5 · Un autor, una respuesta por publicación | Índice único parcial sobre los respondidos |
| 7 · La aprobación precede a la publicación | Trigger de estado |
| 8 · La devolución libera la fecha | Trigger sobre `approvals` |
| Cada envío queda registrado | Único sobre `dm_log.comment_id` |

## Entrega 3 · Acceso y roles

**23 casos**, la matriz completa de los cuatro roles.

| Rol | Verificado |
|---|---|
| Observador | Lee todo. Falla al crear, al editar y al aprobar. Falla al ascenderse |
| Audiovisual | Crea la pieza y la lleva hasta revisión. Falla al aprobar, al definir la palabra clave y al tocar las credenciales |
| Aprobadora | Aprueba y devuelve con comentario. Falla al firmar por otra persona, al definir la palabra clave y al borrar |
| Editora | Define palabra clave, mensaje, enlace, cuentas, aprobación y bandeja |
| Sin sesión | La parrilla y los comentarios quedan vacíos |

La validación vive en tres capas: la interfaz oculta, la Server Action comprueba
el rol, y la política de la base decide.

## Entrega 4 · Ingesta de la parrilla

**13 pruebas.** Conciliación por `sheet_row_id`, con huella de contenido para
saber si la fila cambió: correr la sincronización dos veces deja el mismo
resultado.

- La fila sin tema y la fila con fecha ilegible quedan en el log con su motivo.
- El caso especial de la sección 7 quedó cubierto: cuando la hoja cambia sobre
  una pieza ya aprobada, el cambio se aparta en `sheet_pendiente` y espera
  confirmación en lugar de pisar lo revisado.
- Las fechas entran en los dos formatos que usa el equipo.

## Entrega 5 · Preparación de la pieza

**28 pruebas de coincidencia**, la tabla completa de la regla 4.

Coinciden: exacta, minúsculas, mezclada, con tilde de más, dentro de frase larga,
con signos pegados, con letras repetidas, con la ese del plural, entre emojis,
partida por espacios, con salto de línea.

Quedan fuera: palabra distinta, comentario vacío, solo signos, solo emojis, y el
prefijo corto.

La misma regla vive en TypeScript y en Postgres, con la misma definición:
mayúsculas, sin tildes, solo letras y números.

**Observación abierta.** Las variantes derivadas incluyen la forma con una letra
caída, y sobre una frase larga eso puede disparar un falso positivo. Por eso la
interfaz las propone y deja el campo editable: lo que la editora escriba manda
sobre lo derivado.

## Entrega 6 · Aprobación, panel del día y publicación

- Estado independiente por red: el fallo en una deja intacto lo que salió en otra.
- Reintentos con espera creciente de 2, 8 y 30 minutos, hasta tres veces.
- El token vencido pausa la cuenta y avisa, en lugar de gastar intentos.
- La credencial ausente pausa y nombra la variable que falta.
- Idempotencia por restricción única `(piece_id, social_account_id)`: la misma
  pieza pasada dos veces por la cola sale una sola vez.
- El contenedor de Instagram espera el procesado hasta dos minutos antes de
  publicar, que es lo que evita el error que parece de permisos y no lo es.

## Entrega 7 · Motor de comentarios, bandeja y resultados

**15 pruebas**, con las dos del pico real.

### La prueba de 300 comentarios

Un lote armado como llega de verdad: 200 con la palabra bien escrita de autores
distintos, 40 mal escritas, 30 sin la palabra, 20 repetidos de autores que ya
habían comentado, y 10 que el webhook entregó dos veces.

| Comprobación | Resultado |
|---|---|
| Ninguno se pierde | 300 desenlaces para 300 comentarios |
| Responde a los que traen la palabra | 240, incluidas las mal escritas |
| Un mensaje por persona | 240 envíos, 240 destinatarios distintos |
| Descarta lo que no aplica | 30 sin coincidencia, 30 duplicados |
| Respeta el ritmo de la plataforma | 2 envíos por segundo, medido con reloj falso |

### La prueba de la carrera

El webhook y el sondeo procesan el mismo lote de 300 a la vez. Salen 300
respuestas, ni una repetida: las cuatro barreras de idempotencia sostienen la
concurrencia.

### Firma del webhook

**6 pruebas.** Acepta la firma correcta, rechaza la de otro secreto, el cuerpo
alterado después de firmar, la petición sin cabecera, la cabecera de otro largo y
la firma sin prefijo de algoritmo. La comparación va en tiempo constante.

### Reparto por red, según lo que permite cada API

| Red | Publicación | Respuesta |
|---|---|---|
| Instagram | Automática | Automática, respuesta privada dentro de 7 días |
| YouTube | Automática | Automática y pública, con cupo de 150 diarias |
| TikTok | Borrador al buzón | Bandeja manual con respuesta lista para copiar |

---

## Los ocho criterios de aceptación

| Criterio | Estado | Cómo quedó comprobado |
|---|---|---|
| Jess aprueba el día en una sola pantalla | Listo | `/dia` con el botón que programa y suelta |
| La pieza publicada activa su automatización sola | Listo | Trigger `activar_escucha_al_publicar`, verificado en la batería del esquema |
| La palabra escrita de forma alterna recibe el mensaje | Listo | 11 formas alternas, todas coinciden |
| 300 comentarios quedan respondidos sin perder ninguno | Listo | Prueba del pico |
| Un autor recibe una sola respuesta por publicación | Listo | Barrera en el motor más índice único |
| La devolución propone el nuevo calendario | Listo | `recalcularSemana`, con 3 pruebas |
| Cada pieza muestra detectados, enviados y clics | Listo | `/resultados` |
| Las redes sin API muestran su bandeja con respuesta lista | Listo | `/bandeja` con botón de copiar |

---

## Lo que queda abierto, y depende de trámites

| Pendiente | Qué bloquea | Cuánto tarda |
|---|---|---|
| Verificación del negocio en Meta | El App Review | 5 a 15 días hábiles |
| App Review de mensajería y webhook de comentarios | La respuesta automática en Instagram | Alrededor de 20 días |
| Auditoría de TikTok Content Posting | La publicación directa a audiencia pública | Semanas |
| Credenciales reales de las cinco cuentas | La operación completa | Depende del equipo |

Mientras corren, el código ya está: la casilla de cada canal se activa el día que
llega la aprobación. Los tres trámites arrancan el día uno, porque suman más de
un mes.

**Pregunta abierta de la verificación técnica.** Las reglas de Meta sobre enlaces
en el primer mensaje quedaron sin confirmar, porque la página de política
devolvió 404. El diseño la esquiva: el mensaje entrega un enlace propio del
dominio de SaleADS, que redirige a WhatsApp y cuenta el clic.
