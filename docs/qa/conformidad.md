# Conformidad con la especificación

Recorrido punto por punto de `docs/ESPECIFICACION.md` contra el código. Cada
línea dice dónde vive y cómo quedó comprobada.

**Estado.** Los 6 módulos, las 10 reglas de negocio, los 9 casos especiales y los
8 criterios de aceptación, cubiertos. 142 pruebas automáticas y 90 reglas
verificadas contra Postgres.

---

## Módulo 1 · Ingesta de parrilla

| Requisito | Dónde vive | Comprobado |
|---|---|---|
| Lee la hoja y crea o actualiza piezas | `trabajos/sincronizar.ts` | Recorrido, paso 1 |
| Concilia por `sheet_row_id` | Único `(brand_id, sheet_row_id)` | Recorrido, paso 2 |
| Crear y editar piezas dentro de la app | `acciones/parrilla.ts`, parrilla y editor | Matriz de roles |
| Marca las incompletas señalando qué falta | Celda de la parrilla y aviso del editor | Trigger de programación |

## Módulo 2 · Preparación de la pieza

| Requisito | Dónde vive | Comprobado |
|---|---|---|
| Editor de caption con vista por red | Pestañas en el editor, herencia del base | 8 pruebas de caption |
| Palabra clave con variantes automáticas y edición manual | `dominio/clave.ts` | 28 pruebas |
| Recurso desde la biblioteca o alta de uno nuevo | `/recursos` | Matriz de roles |
| Enlace rastreado a WhatsApp con texto prellenado | `acciones/piezas.ts` | Recorrido, paso 4 |
| Redacción del mensaje directo | Editor de la pieza | Trigger de programación |

## Módulo 3 · Aprobación

| Requisito | Dónde vive | Comprobado |
|---|---|---|
| Vista semanal con aprobación por pieza o en bloque | Parrilla, con selección múltiple | Matriz de roles |
| Devolución con comentario, que regresa a revisión y notifica | Trigger `aplicar_aprobacion` y `avisar_devolucion` | Recorrido, paso 6 |
| Recorrido de fechas asistido, con confirmación en un clic | `calendar_proposals` y la parrilla | 6 pruebas de calendario, 3 en base |

## Módulo 4 · Publicación

| Requisito | Dónde vive | Comprobado |
|---|---|---|
| Cola por fecha y hora | `trabajos/publicar.ts` | 8 pruebas de zona horaria |
| Panel del día con video, caption, palabra y mensaje | `/dia` | Prueba de humo |
| Aprobación del día en un clic | `programarDia` | Matriz de roles |
| Publicación por API con reintentos y registro de error | Los tres adaptadores | 6 pruebas de TikTok |
| Escucha activa al quedar en vivo | Trigger `activar_escucha_al_publicar` | Recorrido, paso 10 |

## Módulo 5 · Motor de comentarios

| Requisito | Dónde vive | Comprobado |
|---|---|---|
| Webhook, con sondeo periódico de respaldo | `api/webhooks` y `cron/escuchar` | 6 pruebas de firma |
| Normalización y coincidencia por contención | `dominio/clave.ts` | 28 pruebas |
| Mensaje con el enlace rastreado | `componerMensaje` | 22 pruebas del motor |
| Una respuesta por autor y por publicación | Barrera en el motor más índice único | Pico de 300 |
| Bandeja manual con respuesta lista para copiar | `/bandeja` | Recorrido, paso 11 |

## Módulo 6 · Resultados

| Requisito | Dónde vive | Comprobado |
|---|---|---|
| Por pieza: detectados, enviados, clics | `/resultados` | Recorrido, paso 14 |
| Vista semanal comparativa por marca y por red | Tabla de comparativa | 10 pruebas de analítica |

---

## Las 10 reglas de negocio

| # | Regla | Cómo se garantiza |
|---|---|---|
| 1 | Toda pieza programada tiene palabra clave, mensaje y enlace | Trigger `pieza_lista_para_programar`, que nombra lo que falta |
| 2 | Palabra clave única por marca mientras esté activa | Trigger `preparar_keyword`, con solapamiento de vigencias |
| 3 | La automatización se activa con el identificador externo | Trigger `activar_escucha_al_publicar` |
| 4 | Coincidencia con tildes, sin tildes, mayúsculas, letras repetidas y dentro de frase | `dominio/clave.ts`, 11 formas alternas probadas |
| 5 | Un comentario, una respuesta. Un autor, una por publicación | Dos restricciones únicas más la barrera del lote |
| 6 | Los comentarios en publicaciones antiguas siguen recibiendo respuesta | `dominio/ventana.ts`, con la ventana contada desde el comentario |
| 7 | La aprobación de Jess precede a toda publicación | Trigger de estado |
| 8 | La devolución recalcula el calendario y espera confirmación | `calendar_proposals`, que nace sin aplicar |
| 9 | Toda credencial próxima a expirar avisa | `avisarTokensPorVencer`, con siete días de anticipación |
| 10 | Los recursos permanecen disponibles | La biblioteca es acumulativa, sin borrado |

**Precisión sobre la regla 6.** Meta cierra la respuesta privada a los 7 días del
comentario, no de la publicación. La regla se cumple en su lectura correcta: un
comentario nuevo sobre una publicación vieja sí recibe respuesta. El comentario
que lleva más de una semana sin atender pasa a la bandeja con su motivo.

---

## Los 9 casos especiales de la sección 7

| Situación | Comportamiento pedido | Cómo quedó |
|---|---|---|
| La publicación falla en una red | Reintento con espera creciente, hasta tres veces, y aviso con el error | Esperas de 2, 8 y 30 minutos. El aviso llega al agotar los intentos, no antes: un fallo pasajero se resuelve solo |
| Sale en una red y falla en otra | Cada red con su estado, la automatización se activa donde sí salió | Estado por publicación. El trigger enciende la escucha con la primera que sale |
| Llegan 300 comentarios en minutos | Cola con control de tasa, sin perder comentarios | 2 envíos por segundo, medidos con reloj falso. 300 desenlaces para 300 comentarios |
| La palabra dentro de una frase larga | Coincide | Coincidencia por contención, probada con frase, emojis y saltos de línea |
| El autor comenta dos veces | Una sola respuesta | Barrera en el lote más índice único parcial |
| El mensaje falla por límites de la plataforma | Queda en cola con reintento, y pasa a bandeja manual tras agotar intentos | Tres intentos con espera creciente, y el trabajo `reintentarMensajes` cada 5 minutos |
| La red carece de API de respuesta | Bandeja manual con respuesta sugerida | TikTok completo, con botón de copiar |
| El token expira | Pausa la publicación de esa cuenta y avisa | La cuenta se desactiva sola, y el aviso llega siete días antes |
| La hoja cambia con la pieza aprobada | Marca la diferencia y pide confirmación | `sheet_pendiente`, con la diferencia campo por campo |

---

## Los 8 criterios de aceptación

| Criterio | Cómo quedó comprobado |
|---|---|
| Jess aprueba el día en una sola pantalla y las publicaciones salen a su hora | `/dia` con el botón que programa, y la conversión de zona con 8 pruebas |
| Una pieza publicada activa su automatización sin intervención | Recorrido, paso 10: el trigger la enciende con el identificador externo |
| Un comentario con la palabra escrita de forma alterna recibe el mensaje | 11 formas alternas, todas coinciden |
| 300 comentarios quedan respondidos sin perder ninguno | 300 desenlaces para 300 comentarios, y la misma prueba con webhook y sondeo a la vez |
| Un mismo autor recibe una sola respuesta por publicación | 240 envíos a 240 destinatarios distintos en el pico |
| La devolución propone el nuevo calendario | `recalcularSemana` con 6 pruebas, y la propuesta que espera confirmación |
| Cada pieza muestra detectados, enviados y clics | `/resultados`, verificado en el recorrido |
| Las redes sin API muestran su bandeja con respuesta lista | `/bandeja`, con TikTok, la ventana vencida y el desborde de cupo |

---

## Lo que quedó fuera de la especificación, y por qué

| Decisión | Motivo |
|---|---|
| YouTube responde en automático | La especificación lo mandaba a bandeja manual. El API sí lo permite, a 50 unidades por respuesta, así que responde dentro de un cupo diario y desborda a la bandeja |
| El video pasa por Storage antes de publicar | La especificación previó `storage_path` sin decir quién lo llena. Las plataformas descargan desde una URL pública, y el enlace de Drive pide sesión |
| La semana se deriva de la fecha en la base | La especificación la trata como campo propio. Derivarla cierra el camino a que la parrilla y la fecha digan cosas distintas |
| Las credenciales se validan por prefijo | La especificación pide `credential_ref` sin acotar su forma. Sin acotarla, una referencia mal puesta enviaba un secreto del sistema a la plataforma |
