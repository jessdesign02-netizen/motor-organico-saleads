# Manual del equipo

Qué hace cada persona en la herramienta, y qué pasa si algo sale distinto de lo
esperado. La guía técnica de instalación vive aparte, en
[puesta-en-marcha.md](puesta-en-marcha.md).

---

## Ema, Diego e Iván · audiovisual

**No necesitan cuenta en la herramienta.** Su trabajo sigue igual: el video a
Drive y la fila en la hoja de cálculo.

Lo que cambió: la hoja se lee sola cada quince minutos. Ya nadie copia esa fila a
otra parte.

### Lo que la fila necesita

| Columna | Por qué importa |
|---|---|
| Pieza | Es el nombre con el que la pieza aparece. Sin esto, la fila se ignora |
| Link de Drive | De ahí se baja el video para publicar. Sin esto, la pieza entra pero no puede salir |
| Fecha de publicación | Coloca la pieza en su día. Vale `12/09/2026` o `2026-09-12` |
| Hook | Sirve para medir qué tipo de arranque funciona mejor |
| Formato base | reel, short, carrusel |
| Responsable | Quién grabó o editó |
| Recursos | El nombre del material que se entrega. Se vincula solo si ya está en la biblioteca |

**La carpeta de Drive va compartida** con la cuenta de servicio del sistema, en
modo lectura. Si un video queda en una carpeta sin compartir, la pieza aparece en
la parrilla y falla al publicar, con el motivo escrito.

Una fila que se corrige después vuelve a leerse: la herramienta detecta el cambio
y actualiza la pieza. La excepción es una pieza que Karen ya aprobó, y ahí el
cambio espera confirmación en lugar de pisar lo revisado.

---

## Jessica · editora

Es quien manda en el sistema. Todo lo demás pasa por aquí.

### Cada día

1. **`/dia`** muestra lo que va a salir hoy: video, caption, palabra clave y el
   mensaje que recibirá quien comente. Se revisa de una mirada.
2. El botón **Aprobar el día y soltar** programa esas publicaciones. Es el único
   punto donde el sistema espera una decisión humana.
3. **`/bandeja`** trae lo que necesita una mano: TikTok, que carece de API de
   respuesta, y los casos que el sistema no pudo cerrar solo. Cada uno llega con
   la respuesta lista para copiar.
4. **`/avisos`** avisa de lo que salió mal: una publicación fallida, un video que
   no bajó, un acceso por vencer.

### Al preparar una pieza

En cada pieza se escribe el caption, se define la palabra clave, se elige el
recurso y se redacta el mensaje. El enlace rastreado se arma solo.

**Sobre la palabra clave.** Se guarda en mayúsculas y sin tildes, y la
coincidencia ya perdona lo que la gente escribe de verdad: tildes, mayúsculas,
signos pegados, letras repetidas, la palabra dentro de una frase larga y el
plural. Las variantes que se escriben a mano son para las formas que se escriben
distinto de verdad, no para eso.

Una palabra clave no se repite dentro de la misma marca mientras esté activa. Si
la herramienta la rechaza, es porque otra pieza viva la está usando.

**Sobre el caption por red.** Hay pestañas por red. La que se deja vacía hereda
el caption base, así que solo hace falta escribir lo que cambia.

**Sobre el mensaje.** `{enlace}` y `{palabra}` se reemplazan al enviar. Si el
mensaje se olvida del enlace, el sistema lo agrega igual: nadie recibe un mensaje
sin la forma de llegar al recurso.

### Lo que la herramienta impide, a propósito

Una pieza no se programa sin fecha, hora, palabra clave, mensaje y enlace. Al
intentarlo, dice cuál de esas cosas falta. No es un capricho: una pieza que sale
sin su automatización es una pieza que no genera nada.

---

## Karen · aprobadora

### La semana

**`/parrilla`** muestra la semana completa de cada marca. Se aprueba pieza por
pieza, o se marca la semana entera y se aprueba de una vez.

Cada pieza dice qué le falta, si le falta algo. Aprobar una pieza incompleta se
puede, y esa pieza se detendrá después, al programarse.

### Devolver

La devolución pide un motivo escrito. Eso regresa la pieza a revisión, libera su
fecha, cancela sus salidas pendientes y deja un aviso.

Después de devolver, la parrilla ofrece **proponer un nuevo calendario**: las
piezas que venían después corren un día. La propuesta se muestra antes de
aplicarse, y se confirma con un clic o se descarta. Nunca se aplica sola.

---

## Preguntas que van a salir

**Una pieza no aparece en la parrilla.** `/diagnostico` trae la última
sincronización con el motivo de cada fila que se quedó fuera. Casi siempre es
una fila sin tema, o una fecha escrita a mano que el sistema no entiende.

**Publiqué y nadie recibió el mensaje.** La escucha se enciende sola cuando la
publicación devuelve su identificador. Si no se encendió, la publicación no llegó
a salir: `/avisos` tiene el error.

**Alguien comentó la palabra y no recibió nada.** Tres motivos posibles, y los
tres se ven en `/bandeja`: el comentario lleva más de siete días, esa persona ya
había recibido su mensaje en esa publicación, o la plataforma rechazó el envío y
el caso está esperando su turno para reintentarlo.

**Comenté yo misma para probar y no me llegó.** Cada persona recibe un solo
mensaje por publicación. El segundo comentario propio queda registrado sin
respuesta.

**Se me fue un doble clic en aprobar.** El botón se bloquea mientras trabaja, y
la base tampoco admite publicar dos veces la misma pieza en la misma cuenta.

**El video no sube.** La pieza guarda el último error de Drive. Casi siempre es
la carpeta sin compartir con la cuenta de servicio.

**¿Se puede recuperar una pieza devuelta?** Se corrige, se le pone fecha otra vez
y se vuelve a aprobar. El historial de la pieza guarda cada decisión con su
comentario.

---

## Lo que el sistema hace solo, sin que nadie mire

| Cada | Qué hace |
|---|---|
| 15 minutos | Lee la hoja y trae las filas nuevas o cambiadas |
| 30 minutos | Baja de Drive el video de lo que sale pronto |
| 5 minutos | Publica lo que ya tiene hora, con tres reintentos si falla |
| 5 minutos | Revisa comentarios que el webhook pudo perderse, y reintenta los mensajes que la plataforma rechazó |
| 1 hora | Borra las copias de video que ya cumplieron |
| Cada día a las 8 | Revisa los accesos por vencer |
