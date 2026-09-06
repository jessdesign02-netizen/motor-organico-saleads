# TikTok y YouTube · qué hace falta

Los dos trámites que corren en paralelo al de Meta. Ninguno bloquea a los otros,
así que los tres arrancan el mismo día.

---

## TikTok · auditoría de Content Posting

### Qué desbloquea

Sin la auditoría, todo lo que un cliente sin auditar publica queda restringido a
visibilidad privada. Por eso el sistema entrega el video al buzón del creador y
la persona lo suelta desde la app de TikTok.

Con la auditoría aprobada, el video sale directo a audiencia pública. El cambio
es encender una casilla en Ajustes: el código de las dos rutas ya está y tiene
sus pruebas.

### Qué pedir

| Punto | Detalle |
|---|---|
| Scope | `video.publish`, con aprobación previa de la aplicación |
| Auditoría | Content Posting API, para levantar la restricción de visibilidad |
| Endpoint que usa el sistema | `POST /v2/post/publish/video/init/` con `PULL_FROM_URL` |

### Justificación, para pegar

> SaleADS administra su propia cuenta de TikTok y la de su fundador. La
> aplicación publica en esas dos cuentas el contenido que el equipo de contenido
> prepara y aprueba internamente, en la fecha y hora definidas. El volumen es de
> siete publicaciones semanales por cuenta. No se publica en cuentas de terceros
> ni se distribuye contenido de otros creadores.

### Lo que queda fuera del alcance de TikTok

El API público de TikTok deja fuera la lectura y la respuesta a comentarios de
videos propios, y también los mensajes directos. La Research API los lee, y está
reservada a investigadores académicos aprobados.

Por eso TikTok trabaja con bandeja manual completa: los comentarios se atienden
desde la app, y el sistema entrega la respuesta sugerida lista para copiar. Esa
decisión no cambia con la auditoría, porque no depende de ella.

---

## YouTube · ampliación de cuota

### Qué desbloquea

La cuota diaria por defecto es de 10.000 unidades para la mayoría de los métodos,
con un bucket propio de 100 llamadas al día para subir videos.

| Operación | Costo | Cuántas caben al día |
|---|---|---|
| Subir un Short | 1 unidad del bucket de subidas | 100 |
| Leer un hilo de comentarios | 1 unidad | Miles |
| Responder un comentario | 50 unidades | 200, y menos si se lee mucho |

El cupo por defecto del sistema es de 150 respuestas diarias, que deja margen
para la lectura. El desborde pasa a la bandeja manual con su motivo, así que
agotar la cuota no pierde a nadie: solo mueve el trabajo a una mano.

### Cuándo pedir la ampliación

Con siete publicaciones semanales por marca, las subidas caben de sobra. La
ampliación se vuelve necesaria cuando las respuestas diarias se acerquen a 150 de
forma sostenida: eso significa unos 150 comentarios con la palabra clave al día,
que sería una señal excelente.

`/resultados` muestra el conteo, y el aviso de cupo agotado llega solo. Conviene
pedirla al ver el primer día que roce el techo, porque el trámite tarda días.

### Qué configurar

| Punto | Detalle |
|---|---|
| Credenciales | `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET` desde Google Cloud |
| Scope | `https://www.googleapis.com/auth/youtube.force-ssl` |
| Cupo por cuenta | Se ajusta en Ajustes, sobre el valor por defecto de 150 |

---

## Los tres trámites, en una sola vista

| Trámite | Qué bloquea | Cuánto tarda | Mientras tanto |
|---|---|---|---|
| Verificación de negocio en Meta | El App Review | 5 a 15 días hábiles | Nada más depende de ella |
| App Review de mensajería | La respuesta automática en Instagram | ~20 días | Los comentarios caen a la bandeja manual |
| Auditoría de TikTok | La publicación directa | Semanas | El video va al buzón del creador |
| Ampliación de cuota de YouTube | Más de 150 respuestas diarias | Días | El desborde va a la bandeja |

Las dos primeras van en serie, porque la segunda exige la primera. Las otras dos
corren en paralelo desde el primer día.
