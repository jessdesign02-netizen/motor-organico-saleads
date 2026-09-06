# Diagnóstico QA · Entrega 11 · Auditoría de integración

Los defectos que aparecen entre módulos, cuando cada pieza funciona sola y
juntas no. Continúa a [diagnostico.md](diagnostico.md) y
[diagnostico-fases-2-3.md](diagnostico-fases-2-3.md).

**Estado global.** Puerta en verde: **124 pruebas automáticas** y **85 reglas
verificadas** contra Postgres. Tipos, lint y compilación limpios.

---

## Los dos defectos que impedían operar

### H13 · Publicar desde el enlace de Drive habría fallado siempre

**Gravedad: crítica.** Es el defecto que habría dejado el sistema sin publicar
una sola pieza, con todo lo demás en verde.

Instagram, TikTok y YouTube descargan el video por su cuenta desde una URL. El
trabajo de publicación entregaba `pieces.drive_url`, que es el enlace que el
equipo pega en la hoja. Ese enlace pide sesión de Google y devuelve una página
HTML, así que Meta habría recibido una página en lugar de un archivo de video.

El esquema ya preveía `storage_path` para la copia pública, y nada la llenaba:
el campo existía y el camino que lo usaba nunca se construyó.

**Corrección.** El módulo que faltaba, completo:

- `descargarDeDrive` baja el archivo con la cuenta de servicio, y reconoce las
  tres formas en que Drive comparte un enlace. **7 pruebas.**
- `prepararVideoDePieza` sube la copia a un bucket público, guarda su ruta y el
  peso, y deja escrito en la pieza cualquier fallo para que la pantalla lo diga.
- El trabajo se adelanta seis horas a la salida, porque un video grande tarda y
  la cola de publicación corre cada cinco minutos.
- La publicación exige la copia lista. Sin ella, reintenta con espera creciente
  en lugar de mandar un enlace que la plataforma no puede abrir.
- La copia se marca para borrarse 24 horas después de publicar, y un trabajo por
  hora la retira. El original vive en Drive: esta copia existe solo para el
  momento de salir.

También aparecieron dos límites que ahora se comprueban antes de intentar: el
techo de 1 GB de un Reel, y que el archivo de Drive sea de verdad un video.

### H14 · Cambiar la fecha hacía desaparecer la pieza

**Gravedad: alta.** Callado, que es lo peor.

La parrilla busca por `pieces.semana`. Al crear una pieza, la semana se calculaba
desde la fecha. Al cambiar la fecha desde el editor, no: la pieza conservaba la
semana vieja y dejaba de aparecer en la parrilla de su nueva fecha, sin aviso.
Seguía existiendo, seguía programándose, y nadie la veía.

**Corrección.** Un trigger deriva la semana de la fecha en cada inserción y en
cada actualización, así que ningún camino puede desincronizarlas: ni el editor,
ni la sincronización, ni el recorrido de fechas, ni lo que se escriba después.
La migración repara de paso lo que ya estuviera torcido.

**4 pruebas contra la base**: la semana se corrige aunque llegue mal, mover la
fecha mueve la semana, el domingo pertenece a la semana que empezó el lunes, y
quitar la fecha conserva la semana para que la pieza quede en su columna.

---

## Los otros tres

### H15 · El desfase horario estaba escrito a mano

`programarDia` armaba el instante con `-05:00` pegado al texto. Funciona
mientras Colombia no cambie de horario y ninguna marca opere desde otro país, y
deja de funcionar en silencio el día que alguna de las dos cosas pase.

**Corrección.** `instanteDe` convierte con la zona por nombre, tomada de
`ZONA_HORARIA`. **8 pruebas**, incluidas dos que comprueban el horario de verano
de una zona que sí lo usa, para que la conversión quede probada de verdad y no
solo en la zona que nunca cambia.

### H16 · Las marcas se creaban a mano en la base

El arranque dependía de alguien con acceso al SQL, y la especificación pone el
alta de marcas dentro del trabajo de la editora.

**Corrección.** Alta y ajuste de marcas desde Ajustes, con el mapa de columnas
por defecto ya cargado.

### H17 · Los roles no se podían cambiar desde la app

La matriz de permisos estaba construida y probada, y asignarlos exigía volver a
la base.

**Corrección.** Cambio de rol desde Ajustes, con una regla propia: nadie cambia
su propio rol. Una editora que se degrada por error dejaría el sistema sin quien
apruebe, y recuperarlo pediría entrar por SQL.

---

## Entrega 12 · Los dos últimos puntos de la especificación

### La devolución avisa

El módulo 3 pide que la devolución notifique, y hasta ahora solo cambiaba el
estado. El aviso se crea desde el mismo trigger que aplica la devolución, así
que llega venga por donde venga: desde la parrilla, desde el editor, o desde
cualquier camino que se escriba después.

**3 reglas verificadas**: la devolución deja su aviso, el aviso lleva el motivo
que escribió quien devolvió, y aprobar no genera ninguno.

### H18 · El trigger nuevo dejaba a nadie devolver una pieza

**Gravedad: alta.** Lo atrapó la batería de roles en la primera corrida.

El trigger insertaba en `notices`, y la política de esa tabla permite leer y
marcar como leído, no crear. Con la sesión de la aprobadora, el insert chocaba
con RLS y hacía fallar la devolución entera: la regla ya probada
"la aprobadora devuelve con comentario" pasó a rojo de inmediato.

**Corrección.** El trigger corre con `security definer`, porque el aviso lo
genera el sistema y no la persona. Nadie necesita permiso de escritura sobre los
avisos para devolver una pieza.

Vale anotar de dónde salió: ninguna prueba nueva lo encontró. Lo encontró una
prueba vieja, al correr entera la batería después de un cambio que parecía
tocar otra cosa.

### El recurso de la hoja se vincula solo

El módulo 1 lee la columna Recursos, y ese nombre se quedaba sin uso. Ahora la
ingesta lo busca en la biblioteca de esa marca comparando sin tildes ni
mayúsculas, y lo vincula a la pieza. El recurso nombrado que todavía no existe
queda en el log de sincronización con su motivo, para que alguien lo cargue.

---

## Prueba de humo sobre la app levantada

| Camino | Esperado | Obtenido |
|---|---|---|
| `/api/cron/video` sin cabecera | Rechazo | 401 |
| `/api/cron/video` con `CRON_SECRET` | Pasa | 200 |
| `/api/cron/limpiar` sin cabecera | Rechazo | 401 |
| `/api/cron/limpiar` con `CRON_SECRET` | Pasa | 200 |
| `/api/cron/avisos` sin cabecera | Rechazo | 401 |
| `/api/cron/avisos` con `CRON_SECRET` | Pasa | 200 |
| `/ajustes` sin sesión | Redirección | 307 a la entrada |
| `/recursos` sin sesión | Redirección | 307 a la entrada |

---

## Cobertura acumulada

| Capa | Comprobaciones |
|---|---|
| Palabra clave y coincidencia | 28 |
| Motor de comentarios | 18 |
| Guardia de rutas | 14 |
| Ingesta de la parrilla | 13 |
| Analítica de resultados | 10 |
| Caption por red | 8 |
| Zona horaria | 8 |
| Enlaces de Drive | 7 |
| TikTok | 6 |
| Firma del webhook | 6 |
| Calendario | 6 |
| **Pruebas automáticas** | **124** |
| Reglas de negocio en la base | 33 |
| Matriz de roles | 23 |
| Entrega 8 | 9 |
| Entrega 11 | 8 |
| Entrega 12 | 3 |
| Recorrido completo | 21 |
| **Reglas contra Postgres** | **85** |

---

## El recorrido completo

Las baterías anteriores prueban cada regla por separado. Esta prueba la costura:
los siete triggers actuando juntos sobre una misma pieza, en el orden real, con
todo lo que puede salir mal por el camino.

**21 pasos verificados**, de la fila de la hoja al lead:

| Paso | Qué comprueba |
|---|---|
| 1 | La pieza entra desde la hoja en borrador, y su semana se deriva sola |
| 2 | Correr la sincronización dos veces no la duplica |
| 4 | La palabra clave se guarda normalizada, venga como venga escrita |
| 5 | Nada se programa sin la aprobación |
| 6 | La devolución regresa a revisión, libera la fecha y deja su aviso |
| 7 | La pieza corregida vuelve a quedar aprobada |
| 8 | La escucha sigue apagada mientras la pieza no sale |
| 10 | La publicación en vivo enciende la escucha sin que nadie la toque |
| 11 | El comentario con la palabra recibe su mensaje, la entrega repetida del webhook no genera un segundo, la misma persona tampoco, y el comentario fuera de ventana pasa a la bandeja con su motivo |
| 13 | La copia del video queda lista para borrarse |
| 14 | La pieza cierra con un detectado, un mensaje enviado y un clic |
| 15 | La palabra vuelve a estar libre para la semana siguiente |

Ninguna regla nueva salió de aquí, y eso es el resultado: las reglas probadas por
separado se sostienen cuando actúan juntas.

---

## Balance de la auditoría completa

Dieciocho defectos encontrados y corregidos en doce entregas. Cuatro habrían
impedido operar: la publicación desde un enlace que la plataforma no puede
abrir, dos mensajes a la misma persona, la palabra clave repetida entrando a la
base, y la pieza que desaparecía de la parrilla al cambiarle la fecha.

El patrón que más se repitió fue el silencio: RLS que deniega sin error, un
trigger que rechaza por la razón equivocada, una excepción que borra el
comentario del resumen, un campo derivado que se queda atrás. Ninguno se veía
desde la pantalla, y todos se veían desde una prueba que preguntara por el
motivo y no solo por el resultado.

## Lo que sigue dependiendo de trámites

Verificación de negocio en Meta, App Review de mensajería, auditoría de TikTok
Content Posting, y las credenciales de las cinco cuentas. El código de las tres
fases está completo, y cada casilla se enciende el día que llega su aprobación.
El paso a paso está en [docs/puesta-en-marcha.md](../puesta-en-marcha.md).
