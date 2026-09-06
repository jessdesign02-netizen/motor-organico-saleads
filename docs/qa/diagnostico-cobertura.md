# Diagnóstico QA · Entrega 16 · La cobertura que faltaba

Los tres huecos que quedaban: el webhook, los esquemas de entrada y las rutas de
plataforma. Continúa a los informes anteriores.

**Estado.** Puerta en verde: **229 pruebas automáticas** y **90 reglas
verificadas** contra Postgres.

---

## El webhook, que es por donde entra cada lead

La firma tenía sus 6 pruebas desde la Fase 1. La lectura de la carga, ninguna, y
es lo que decide si un comentario se convierte en lead o se pierde.

El parseo vivía dentro de la ruta, así que lo primero fue sacarlo a
`redes/webhook-meta.ts`. **21 pruebas** sobre lo que llega bien y sobre lo que
llega de cualquier otra forma.

| Situación | Comportamiento |
|---|---|
| Varios comentarios en una entrega | Se leen todos |
| Varias entradas en la misma carga | Se leen todas, con su publicación |
| Los segundos de Meta | Se convierten a milisegundos |
| Un objeto que no es de Instagram | Se descarta con su motivo |
| Campos que no son comentarios | Se descartan sin perder los que sí lo son |
| Un comentario sin id, o sin publicación | Se descarta nombrando cuál |
| Un texto ausente, o que no es texto | Se trata como texto vacío |
| Un comentario roto entre varios buenos | Los buenos siguen su camino |

Esa última fila importa más de lo que parece. Romperse ante un comentario mal
formado habría hecho que Meta reintentara el lote completo, y los buenos se
habrían quedado esperando detrás del malo.

### C1 · El sistema se respondía a sí mismo

**Hallazgo de comportamiento.** Cuando alguien del equipo comentaba la palabra
clave en la propia publicación, para probar o para dar ejemplo, el sistema le
enviaba el mensaje. Meta permite una sola respuesta privada por comentario y una
por persona: gastarla con la propia cuenta dejaba a esa persona sin poder
recibirla si comentaba de verdad.

Ahora los comentarios de las cuentas propias quedan fuera, y las dos marcas se
excluyen entre sí. **4 pruebas.**

### C2 · Una consulta por comentario en el webhook

La ruta buscaba la publicación de cada comentario por separado. Un lote de una
publicación con tráfico trae decenas, y Meta espera una respuesta rápida: si
tarda, reintenta la entrega entera.

Ahora las publicaciones se resuelven de una sola consulta.

---

## Los esquemas de entrada

Dieciocho acciones de servidor validaban con Zod, y esa validación no tenía una
sola prueba. Es la primera barrera contra lo que llega mal escrito, y sus
mensajes son los que la persona lee en pantalla.

Los esquemas salieron a `acciones/esquemas.ts`, fuera del archivo con
`'use server'`, que es lo que impedía probarlos. **28 pruebas.**

Lo que quedó comprobado, más allá de que acepten lo válido:

- El tema corto, la palabra clave de dos letras y el mensaje de una palabra se
  rechazan **con el motivo que la persona necesita leer**, no con un error
  genérico.
- La fecha en formato del día a día (`12/09/2026`) se rechaza aquí, aunque la
  ingesta sí la entienda: son dos entradas distintas y la del formulario ya viene
  de un campo de fecha.
- El token pegado donde va el nombre de la variable se rechaza. Es el error más
  probable de todos al conectar un canal.
- `SUPABASE_SERVICE_ROLE_KEY` se rechaza diciendo que es un secreto del sistema.

### Un detalle que salió de escribirlas

Zod comprueba la **versión** del identificador, no solo su forma. Los que genera
Postgres con `gen_random_uuid()` son de versión 4 y pasan; un identificador
inventado a mano, no. Vale saberlo: si alguna vez se insertan filas con ids
escritos a mano, las acciones los rechazarán.

---

## Cobertura, al cierre

| Capa | Comprobaciones |
|---|---|
| Palabra clave y coincidencia | 28 |
| Esquemas de entrada | 28 |
| Motor de comentarios | 22 |
| Instagram | 22 |
| Lectura del webhook | 21 |
| YouTube | 16 |
| Guardia de rutas | 14 |
| Seguridad | 14 |
| Ingesta de la parrilla | 13 |
| Analítica de resultados | 10 |
| Caption por red | 8 |
| Zona horaria | 8 |
| Enlaces de Drive | 7 |
| TikTok | 6 |
| Firma del webhook | 6 |
| Calendario | 6 |
| **Pruebas automáticas** | **229** |
| **Reglas contra Postgres** | **90** |

Con esto no queda una capa del sistema sin pruebas: desde la normalización de la
palabra clave hasta la secuencia de cada API, pasando por los triggers, la matriz
de roles, la lectura del webhook, los esquemas de entrada y el recorrido completo
de una pieza.
