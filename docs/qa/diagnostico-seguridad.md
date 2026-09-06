# Diagnóstico QA · Seguridad y rendimiento

La auditoría que faltaba. Continúa a [diagnostico.md](diagnostico.md),
[diagnostico-fases-2-3.md](diagnostico-fases-2-3.md) e
[diagnostico-integracion.md](diagnostico-integracion.md).

**Estado global.** Puerta en verde: **138 pruebas automáticas** y **85 reglas
verificadas** contra Postgres.

---

## Seguridad

Tres hallazgos. El primero es el más serio de toda la auditoría.

### S1 · Una referencia mal puesta enviaba la llave maestra a Meta

**Gravedad: crítica.**

El diseño guarda el token de cada plataforma en una variable de entorno, y la
base guarda solo el nombre de esa variable. Es una buena decisión: el secreto
queda fuera de la base y fuera del navegador.

El problema estaba en el otro extremo. El código hacía
`process.env[cuenta.credential_ref]`, y `credential_ref` es un campo de la base
que se escribe desde Ajustes. La validación pedía forma de nombre de variable,
que `SUPABASE_SERVICE_ROLE_KEY` cumple perfectamente.

Bastaba escribir ese nombre en el formulario de conectar un canal para que el
sistema leyera la llave maestra de la base de datos y la enviara a Meta como
cabecera de autorización, creyendo que era un token de Instagram. La misma
puerta servía para `CRON_SECRET`, `META_APP_SECRET` o
`GOOGLE_SERVICE_ACCOUNT_KEY`.

No hace falta mala intención: un copiar y pegar equivocado bastaba, y el error
habría sido invisible porque la publicación simplemente fallaría con un mensaje
de token inválido.

**Corrección.** La referencia se valida contra una lista de prefijos de
plataforma (`META_TOKEN_`, `TIKTOK_TOKEN_`, `YOUTUBE_TOKEN_`), con los secretos
del sistema bloqueados por nombre además del prefijo. La comprobación vive en
dos capas: al guardar la cuenta, para que el error se vea al escribirlo, y en el
punto de lectura, porque una fila puede haber entrado por otro camino.

**12 pruebas**, incluidas las que comprueban que `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET` y `AWS_SECRET_ACCESS_KEY` quedan fuera.

### S2 · El redirector podía mandar a cualquier parte

**Gravedad: media.**

`/r/{slug}` toma el destino de la base y redirige. El destino lo escribe la
editora, así que el riesgo inmediato es bajo, y el enlace lleva el dominio de
SaleADS: un destino equivocado convierte ese dominio en trampolín, y quien
recibe el mensaje ve una dirección de la marca que lo lleva a otro sitio.

**Corrección.** El destino queda dentro del embudo propio: WhatsApp y los
dominios de SaleADS, siempre por https. Se comprueba al guardarlo y otra vez al
abrirlo, porque entre las dos cosas pasa tiempo.

**8 pruebas**, incluidas las que rechazan `javascript:`, `data:`, `file:`, el
enlace en claro, y el clásico `wa.me.sitio-falso.com` que se parece al bueno.

### S3 · El secreto de los cron se comparaba letra por letra

**Gravedad: baja.**

`cronAutorizado` usaba `===`, que se detiene en la primera diferencia. El tiempo
de respuesta dice entonces cuántos caracteres coinciden, y con suficientes
intentos el secreto se reconstruye de a una letra.

**Corrección.** Comparación en tiempo constante, la misma que ya usaba la firma
del webhook. Que una de las dos puertas lo hiciera bien y la otra no era la
señal de que faltaba unificarlo.

### Lo que se revisó y quedó bien

| Punto | Estado |
|---|---|
| Firma del webhook de Meta | Verificada en tiempo constante, con 6 pruebas |
| Tokens en el navegador | Ninguno: viven en el entorno del servidor |
| Secretos en el repositorio | Ninguno, comprobado sobre el árbol y el historial |
| Escalada de privilegios | El observador falla al ascenderse, y nadie cambia su propio rol |
| Permisos solo en la interfaz | No: cada regla vive también en la base, con 23 casos que lo comprueban |
| Mensajes de error hacia afuera | La ruta pública devuelve un texto genérico y registra el detalle en el servidor |
| Bucket de videos público | Necesario, porque la plataforma descarga el archivo sin credenciales nuestras. Las rutas usan identificadores impredecibles y la copia vive 24 horas |

---

## Rendimiento

Dos consultas en bucle, en los dos momentos donde el sistema tiene más trabajo.

### R1 · Una consulta por comentario en el pico

El motor preguntaba a la base, comentario por comentario, si ese autor ya había
sido atendido. En el pico real de 300 comentarios eran 300 viajes solo para esa
comprobación, encima del envío de cada mensaje.

**Corrección.** La lista de autores atendidos de una publicación se trae de una
sola vez y se mantiene al día con lo que se va respondiendo. De 300 consultas a
una.

La regla de negocio queda intacta: las cuatro barreras de idempotencia siguen en
pie, y las 18 pruebas del motor pasan sin cambios.

### R2 · Trescientas consultas cada cinco minutos

El sondeo de respaldo recorre hasta sesenta publicaciones, y armar el contexto de
cada una cuesta cinco consultas. Eran unos trescientos viajes a la base cada
cinco minutos, casi todos para descubrir que la palabra clave ya venció y no
había nada que hacer.

**Corrección.** Las vigencias se resuelven en una sola consulta, antes del
recorrido. El contexto completo se arma solo para las publicaciones que siguen
vivas. En una semana normal, con dos o tres piezas con palabra clave activa, el
trabajo pasa de trescientas consultas a unas quince.

---

## Cobertura acumulada

| Capa | Comprobaciones |
|---|---|
| Palabra clave y coincidencia | 28 |
| Motor de comentarios | 18 |
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
| **Pruebas automáticas** | **138** |
| **Reglas contra Postgres** | **85** |

---

## Balance final de la auditoría

Veintiún defectos encontrados y corregidos. Cinco habrían impedido operar:
publicar desde un enlace que la plataforma no puede abrir, dos mensajes a la
misma persona, la palabra clave repetida entrando a la base, la pieza que
desaparecía al cambiarle la fecha, y el trigger que dejaba a nadie devolver.

Uno habría entregado la llave maestra de la base a un tercero.

El patrón que más se repitió fue el silencio: RLS que deniega sin error, un
trigger que rechaza por la razón equivocada, una excepción que borra el
comentario del resumen, un campo derivado que se queda atrás, una referencia que
lee lo que no debía. Ninguno se veía desde la pantalla.

Lo que los encontró no fue mirar el código con más cuidado, sino tres cosas
concretas: preguntar a cada prueba por el motivo y no solo por el resultado,
correr las baterías enteras después de cada cambio aunque pareciera tocar otra
cosa, y levantar la aplicación para pedirle las rutas de verdad.

---

## Entrega 15 · Los adaptadores de plataforma, y la interfaz

### Lo que faltaba probar

TikTok tenía sus 6 pruebas desde la Fase 2. Instagram y YouTube, ninguna, y son
los dos que hacen el trabajo: Instagram publica y responde en privado, YouTube
publica y responde en público.

**22 pruebas de Instagram** y **16 de YouTube**, sobre la secuencia real de cada
API y sobre la clasificación de sus errores, que es lo que decide si un fallo se
reintenta o se rinde.

| Qué se comprobó | Instagram | YouTube |
|---|---|---|
| La secuencia completa de publicación | Contenedor, espera de procesado, publicación y permalink | Descarga del video, subida multiparte y enlace del Short |
| Los límites de la plataforma | Título recortado a 100, descripción completa | El caption entero en la descripción |
| El error que se reintenta | Límite de tasa, caída del servidor | Ritmo excedido, servidor caído |
| El error que se rinde | Permiso ausente, video rechazado, ventana cerrada | Cuota diaria agotada |
| La respuesta | Dirigida por `comment_id`, con el id de la Página | Dentro del hilo, con `parentId` |
| La lectura de comentarios | Convierte y filtra por fecha, tolera el comentario sin autor | Convierte los hilos, descarta el que llega sin id |

Distinguir el error que se reintenta del que se rinde importa más de lo que
parece: reintentar una cuota agotada gasta los tres intentos en una hora, y
rendirse ante un límite de ritmo pierde una publicación que habría salido sola.

### H23 · El reintento subía el video otra vez

**Gravedad: alta.** Salió de escribir las pruebas, y ninguna de ellas lo tocaba.

Publicar en Instagram son dos llamadas con un procesado de hasta dos minutos en
medio. Si el intento se cortaba ahí, el reintento empezaba de cero: subía el
video otra vez y dejaba el contenedor anterior huérfano, gastando cuota de las
100 diarias.

El caso peor era otro. Si la publicación llegó a Meta y la respuesta se perdió en
el camino, el reintento habría publicado **dos veces la misma pieza**. Las
restricciones de la base protegen contra publicar dos veces desde el sistema, y
no contra publicar dos veces en la plataforma.

**Corrección.** El contenedor se guarda en la publicación y el reintento lo
retoma en lugar de crear otro. Cuando Meta rechaza el video, el contenedor no se
guarda: ese ya no sirve y el reintento parte de cero.

**4 pruebas**: el contenedor vuelve en el fallo por procesado lento, se retoma
sin crear otro, sobrevive también a una caída de red, y queda fuera cuando el
video fue rechazado.

### La interfaz

Tres problemas, en la herramienta que el equipo usa cada día.

**Ningún formulario se bloqueaba mientras enviaba.** Con diez formularios y
acciones que tardan, el patrón es predecible: se pulsa, no se ve nada, se vuelve
a pulsar. En "Crear pieza" eso creaba dos piezas.

**Cero accesibilidad.** Veinte campos usaban el texto de relleno como única
etiqueta, que desaparece al escribir. Ahora cada campo lleva la suya, los
resultados se anuncian con `role` según hayan salido bien o mal, y las pestañas
de red son pestañas también para un lector de pantalla.

**El botón de copiar fallaba en silencio.** `navigator.clipboard` falla sin https
o sin permiso, y no había manejo de ese caso. Ahora lo dice y recuerda que el
texto está a la vista.

---

## Cobertura, al cierre

| Capa | Comprobaciones |
|---|---|
| Palabra clave y coincidencia | 28 |
| Motor de comentarios | 22 |
| Instagram | 22 |
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
| **Pruebas automáticas** | **180** |
| **Reglas contra Postgres** | **90** |
