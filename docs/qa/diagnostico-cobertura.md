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

---

## Entrega 17 · Los trabajos programados

La última capa sin pruebas: publicar, sincronizar, preparar el video y avisar.
Todos hablan con la base, así que la elección era no probarlos o levantar
Postgres para cada caso.

Se construyó un doble en memoria del cliente de Supabase, acotado a lo que el
código usa de verdad. Falla ruidosamente ante lo que no conoce: un doble que
devuelve vacío ante una consulta que no entiende haría pasar pruebas que no
prueban nada.

**48 pruebas nuevas.**

### C3 · El aviso de publicación fallida nunca llegaba

**Gravedad: alta.** Lo encontró la primera prueba que lo buscó.

La cola tiene tres esperas y tres intentos. El aviso se disparaba cuando ya no
quedaba espera que programar, y en el tercer intento la espera de treinta minutos
todavía existe: quien descarta ese cuarto intento es el tope, más adelante.

La condición nunca se cumplía. Una publicación que agotaba sus tres intentos se
quedaba en fallida, en silencio, y nadie se enteraba hasta mirar la parrilla.

**Corrección.** El aviso mira si quedan intentos, no si queda espera. Con dos
pruebas que fijan las dos mitades: avisa al agotar el tercero, y calla mientras
queden intentos, porque un fallo pasajero se resuelve solo.

### Lo que quedó comprobado

**Publicación**, 15 pruebas. Guarda el identificador que devuelve la plataforma,
marca la copia del video para borrarla al día siguiente, envía el caption de la
red y no el base, programa el reintento a los dos minutos, guarda el contenedor
para retomarlo, deja de intentar al tercero, respeta el turno del reintento,
salta la cuenta en pausa, pausa la del token vencido y avisa, se detiene cuando
falta la variable de la credencial, y se detiene cuando esa referencia apunta a
un secreto del sistema.

Esa última cierra el círculo del hallazgo de seguridad: la barrera actúa también
en el momento de publicar, no solo al guardar la cuenta.

**Sincronización**, 14 pruebas. Correrla dos veces deja el mismo resultado,
actualiza cuando la fila cambia, descarta con su motivo la fila sin tema y la de
fecha ilegible, sigue con las buenas aunque una venga mal, y aparta el cambio que
llega sobre una pieza ya aprobada sin pisar lo revisado. Más el vínculo del
recurso, que lo encuentra escrito con otras mayúsculas o sin tilde, y deja
constancia del que todavía no existe.

**Video**, 11 pruebas. Baja de Drive y deja la copia en Storage, reutiliza la que
ya existe, rechaza el video que pasa el techo de 1 GB, deja el error escrito y
avisa, y borra la copia que ya cumplió sin tocar la que todavía sirve.

**Avisos**, 8 pruebas. Avisa del acceso que vence dentro de la semana, calla ante
el que tiene meses, salta la cuenta en pausa, y la clave lleva la fecha, de modo
que renovar el token silencia el aviso sin que nadie lo archive.

### Un recordatorio de por qué las pruebas afirman el motivo

Al escribir la de sincronización usé el nombre de campo equivocado: la columna de
la hoja se llama `pieza`, y el campo ya convertido se llama `tema`. Una prueba
falló, y otra pasó por la razón equivocada: comprobaba que una pieza publicada no
se actualizara, y no se actualizaba porque el cambio nunca llegaba.

Es el mismo patrón del segundo hallazgo de la Fase 1. Una prueba en verde por el
motivo equivocado es peor que una en rojo.

---

## Cobertura, al cierre de la entrega 17

| Capa | Comprobaciones |
|---|---|
| Palabra clave y coincidencia | 28 |
| Esquemas de entrada | 28 |
| Motor de comentarios | 22 |
| Instagram | 22 |
| Lectura del webhook | 21 |
| YouTube | 16 |
| Trabajo de publicación | 15 |
| Guardia de rutas | 14 |
| Seguridad | 14 |
| Sincronización | 14 |
| Ingesta de la parrilla | 13 |
| Trabajo del video | 11 |
| Analítica de resultados | 10 |
| Caption por red | 8 |
| Zona horaria | 8 |
| Avisos | 8 |
| Enlaces de Drive | 7 |
| TikTok | 6 |
| Firma del webhook | 6 |
| Calendario | 6 |
| **Pruebas automáticas** | **277** |
| **Reglas contra Postgres** | **90** |
