# App Review de Meta · qué presentar

El trámite más largo del camino crítico: verificación del negocio de 5 a 15 días
hábiles, y luego alrededor de 20 días de revisión. Este documento reúne lo que
piden, con el texto listo para pegar.

Fuente de los tiempos y requisitos: `docs/00-verificacion-tecnica.md`.

---

## Orden de los pasos

1. **Verificación del negocio** en Meta Business Manager. Va primero: el App
   Review la exige. Un correo de dominio propio acorta el trámite a la mitad
   frente a un Gmail, así que conviene usar uno de saleads.ai.
2. **App en modo Live** en el App Dashboard. Sin esto, Meta no envía una sola
   notificación de webhook, aunque la suscripción quede registrada.
3. **La cuenta de Instagram, profesional y pública.** El webhook de comentarios
   exige las dos cosas.
4. **App Review** de los permisos, con el screencast.

---

## Permisos a solicitar, y por qué

Cada permiso se justifica por lo que el sistema hace con él. Meta rechaza las
justificaciones genéricas, así que van atadas a una pantalla concreta.

### `instagram_business_basic`

> La aplicación identifica la cuenta profesional de Instagram que administra la
> empresa, para asociar cada publicación programada con la cuenta correcta.
> SaleADS opera dos marcas, y sin este permiso la aplicación no puede saber en
> cuál de las dos está publicando.

### `instagram_business_content_publish`

> La aplicación publica los reels que el equipo de contenido prepara y aprueba
> dentro de la herramienta. El video se sube a la cuenta profesional en la fecha
> y hora que el equipo definió. Volumen actual: siete publicaciones semanales
> por marca. Sin este permiso, el equipo tendría que publicar cada pieza a mano
> desde el teléfono, que es el trabajo manual que la aplicación reemplaza.

### `instagram_business_manage_comments`

> La aplicación lee los comentarios de las publicaciones propias de la empresa
> para detectar cuál de ellos contiene la palabra clave que el llamado a la
> acción pide comentar. La aplicación no lee comentarios de cuentas ajenas.

### `instagram_business_manage_messages`

> Cuando alguien comenta la palabra clave que la publicación pidió, la aplicación
> le envía una respuesta privada con el enlace al recurso gratuito que se ofreció
> en esa publicación. Es la entrega de aquello que la persona pidió al comentar.
> La respuesta se envía una sola vez por comentario, dentro de la ventana de
> siete días, y solo a quien comentó de forma voluntaria en una publicación de
> la empresa.

---

## Guion del screencast

Meta rechaza el screencast que no puedan reproducir. Tiene que verse el flujo
completo, con la cuenta de prueba que ellos van a usar. Duración objetivo: de
tres a cinco minutos, sin cortes dentro de cada bloque.

| Momento | Qué se ve |
|---|---|
| 0:00 | La pantalla de entrada de la aplicación. Se escribe el correo y la clave del usuario de prueba, y se entra |
| 0:20 | La parrilla de la semana, con las piezas y su estado |
| 0:35 | Se abre una pieza. Se ve el caption, la palabra clave y el mensaje que se va a enviar |
| 1:00 | El panel del día. Se aprueba el día y la publicación queda programada |
| 1:20 | La publicación aparece ya en vivo en la cuenta de Instagram de prueba, con su enlace |
| 1:45 | Desde otra cuenta, se comenta la palabra clave en esa publicación |
| 2:05 | La aplicación recibe el comentario y envía la respuesta privada. Se ve llegar el mensaje en la bandeja de la cuenta que comentó |
| 2:35 | De vuelta en la aplicación, la pantalla de resultados muestra el comentario detectado y el mensaje enviado |
| 3:00 | La bandeja manual, con un caso que quedó fuera de la ventana y su motivo |

Cada permiso solicitado tiene que aparecer usándose en el video, en el orden en
que se solicitó.

---

## Lo que Meta pide por escrito, además del video

| Documento | Dónde vive | Estado |
|---|---|---|
| Política de privacidad, con URL pública | `docs/tramites/politica-de-privacidad.md`, para publicar en el dominio | Redactada |
| Instrucciones de prueba paso a paso | Este documento, sección siguiente | Listas |
| Usuario de prueba con su clave | Se crea en Supabase, en Authentication | Pendiente de credenciales |
| Eliminación de datos, con URL | Incluida en la política de privacidad | Redactada |

---

## Instrucciones de prueba, para pegar en el formulario

> 1. Entre a https://[dominio]/ingresar con el correo y la clave que aparecen en
>    las credenciales de prueba de esta solicitud.
> 2. La pantalla inicial muestra el calendario de contenido de la semana. Abra
>    cualquier pieza para ver su caption, su palabra clave y el mensaje que se
>    enviará a quien comente esa palabra.
> 3. Vaya a "El día". Verá lo que está programado para hoy. El botón "Aprobar el
>    día y soltar" programa esas publicaciones en Instagram.
> 4. Una vez publicado, comente la palabra clave que indica el caption desde
>    cualquier cuenta de Instagram. En pocos segundos recibirá un mensaje
>    privado con el enlace al recurso.
> 5. En "Resultados" verá el comentario detectado y el mensaje enviado.
> 6. En "Bandeja" verá los comentarios que el sistema deja para respuesta manual,
>    con el motivo por el que no se respondieron en automático.

---

## Errores que hacen fallar la revisión

- **La app en modo Development.** El webhook no entrega nada, y el revisor ve un
  flujo que no responde.
- **La cuenta de Instagram privada.** El webhook de comentarios exige que la
  cuenta profesional sea pública.
- **Una justificación genérica.** "Para mejorar la experiencia del usuario" se
  rechaza. Cada permiso va atado a lo que hace en una pantalla concreta.
- **Un screencast con cortes en el momento clave.** El envío del mensaje tiene
  que verse ocurrir, sin edición entre el comentario y la llegada del mensaje.
- **Credenciales de prueba que no funcionan.** Conviene entrar con ellas en una
  ventana de incógnito antes de enviar.
