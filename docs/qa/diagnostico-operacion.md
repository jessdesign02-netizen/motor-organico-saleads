# Diagnóstico QA · Entrega 19 · Qué se ve cuando algo falla

Las pruebas cubren que el sistema haga lo correcto. Esta pasada mira lo otro:
qué ve una persona cuando algo se rompe, y si los trabajos terminan dentro de su
ventana de tiempo.

**Estado.** Puerta en verde: **295 pruebas automáticas** y **90 reglas**
verificadas contra Postgres.

---

## O1 · Un fallo de la base se veía como una semana sin piezas

**Gravedad: alta.** El más engañoso de todos los encontrados.

Las páginas leían así:

```
const { data: piezas } = await supabase.from('pieces')...
```

El campo `error` se ignoraba, y `data` llegaba en nulo. La pantalla entonces
mostraba la parrilla vacía, con su mensaje de "aún no hay piezas".

Una persona que abre la parrilla el lunes y la ve vacía concluye que la
sincronización no trajo nada, y se pone a revisar la hoja de cálculo. El problema
estaba en otra parte, y nada en la pantalla lo insinuaba.

**Corrección.** `lib/consulta.ts` distingue las tres situaciones: datos, vacío de
verdad, y fallo. El fallo se propaga con el nombre de lo que se estaba leyendo, y
lo recoge la pantalla de error.

**6 pruebas**, entre ellas la que fija la distinción que importa: una pieza que
no existe devuelve null, y un fallo de conexión lanza.

## O2 · No había pantalla de error

Sin `error.tsx`, un fallo dejaba la pantalla por defecto de Next: fondo blanco y
un texto genérico, sin camino de vuelta ni señal de dónde mirar.

Ahora hay tres pantallas:

| Pantalla | Cuándo aparece |
|---|---|
| Error global | Un fallo fuera de la aplicación, con enlace al diagnóstico y botón de reintentar |
| Error de sección | Un fallo dentro, conservando el menú para seguir trabajando en lo demás |
| No encontrado | Una pieza eliminada o un enlace mal copiado |

Y una de carga, porque sin ella la navegación se queda quieta y parece que el
clic no llegó.

## O3 · Dos trabajos corrían sin límite de tiempo declarado

`limpiar` y `avisos` no declaraban `maxDuration`, así que tomaban el valor por
defecto de la plataforma. La limpieza borra archivos en bucle y los avisos
recorren todas las cuentas: una corrida grande se cortaba a la mitad, sin error
visible, dejando el trabajo hecho a medias.

**Corrección.** Los seis trabajos declaran ahora su ventana, ajustada a lo que
hacen: 300 segundos los que hablan con las plataformas, 120 la limpieza, 60 la
sincronización y los avisos.

La limpieza además se lleva como mucho cien copias por corrida. Corre cada hora,
así que lo que no quepa se va en la siguiente: terminar a tiempo importa más que
vaciarlo todo de una vez.

---

## Lo que se revisó y estaba bien

| Punto | Estado |
|---|---|
| El tope de publicaciones por corrida | 50, muy por encima de las 12 diarias en el peor día |
| El estado por red | Independiente: un fallo en una deja intacto lo que salió en otra |
| El doble clic | El botón se bloquea, y la base tampoco admite publicar dos veces |
| La pieza eliminada | La pantalla de no encontrado, en lugar de un error |
| El sondeo con muchas publicaciones | Descarta por vigencia antes de armar contextos |

---

## Entrega 20 · Dos corridas del mismo trabajo

Los seis trabajos corren cada pocos minutos. Cuando una corrida tarda más que su
intervalo, la plataforma lanza la siguiente encima. Esta pasada mira qué pasa
entonces.

### O4 · Dos corridas podían publicar la misma pieza dos veces

**Gravedad: crítica.** Se habría visto desde afuera, en la cuenta.

El trabajo de publicación leía su lote y después marcaba cada fila como
"publicando". Entre esas dos cosas hay una ventana, y publicar un reel la abre de
par en par: crear el contenedor, esperar hasta dos minutos de procesado, publicar.
Con el trabajo corriendo cada cinco minutos, una publicación lenta y la siguiente
corrida leen el mismo lote, y las dos publican.

Las restricciones de la base no lo evitan: es la misma fila, no dos.

**Corrección.** La fila se toma con un update que exige que siga en el estado en
que se leyó. La corrida que llega segunda toca cero filas y sigue de largo.

### O5 · Lo mismo con los mensajes que esperaban reintento

**Gravedad: alta.**

El trabajo de reintento leía los comentarios en estado fallido y después los
reabría. Dos corridas veían el mismo lote, y esa persona recibía dos mensajes,
que es justo lo que las cuatro barreras de idempotencia existen para evitar.

**Corrección.** El update es quien selecciona: toma y reabre en un solo paso, así
que no queda ventana entre medias.

### Comprobado donde ocurre

El compare-and-swap solo vale si la base lo hace atómico, así que las dos
comprobaciones corren contra Postgres, no contra el doble:

| Comprobación | Resultado |
|---|---|
| La primera corrida toma la publicación | Pasa |
| La segunda no encuentra la fila, y la pieza sale una sola vez | Pasa |
| El reintento lo toma una sola corrida, y esa persona recibe un solo mensaje | Pasa |

Más 5 pruebas en TypeScript sobre el mecanismo: que la fila quede en
"publicando" mientras la plataforma responde, y que la segunda corrida no
encuentre nada que hacer.

**Sobre el alcance de estas pruebas.** El doble de Supabase es síncrono, así que
no modela dos corridas de verdad simultáneas: lo que prueba es el mecanismo, y
la atomicidad se comprueba contra Postgres, que es donde vive.

---

## Estado al cierre

**300 pruebas automáticas** y **94 reglas** verificadas contra Postgres.
