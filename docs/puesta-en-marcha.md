# Puesta en marcha

De un repositorio recién clonado a la primera semana publicando sola. Cada paso
dice cómo comprobar que quedó bien antes de pasar al siguiente.

La pantalla `/diagnostico` recorre todo esto y marca qué falta, así que sirve de
mapa mientras avanzas.

---

## 1. Levantarlo en local

```
npm install
cp .env.example .env.local
```

En `.env.local` llena por ahora las tres de Supabase. El resto entra después.

```
npm run dev
```

**Comprobación.** http://localhost:3000 lleva a la pantalla de entrada.

---

## 2. La base

Un solo comando, con la cadena de conexión que da Supabase en Project Settings,
Database, Connection string, URI:

```
./scripts/arrancar.sh "postgresql://postgres:TU-CLAVE@db.xxxxx.supabase.co:5432/postgres"
```

Aplica las once migraciones en orden, corre el seed y comprueba que las quince
tablas, el RLS y los nueve triggers quedaron en su sitio. Se puede correr varias
veces: lo que ya está aplicado lo dice y sigue.

Después crea tu usuario en Authentication, Add user, con tu correo. Luego corre
`0003_accesos.sql`, que te deja como editora. El script lo recuerda al terminar.

**Comprobación.** Entras con tu correo y ves la parrilla vacía. `/ajustes`
muestra SaleADS y Juanads.

---

## 3. La hoja de cálculo

1. En Google Cloud, crea un proyecto y una cuenta de servicio.
2. Habilita **Google Sheets API** y **Google Drive API**.
3. Genera una llave JSON. De ahí salen `GOOGLE_SERVICE_ACCOUNT_EMAIL` y
   `GOOGLE_SERVICE_ACCOUNT_KEY` (el campo `private_key`, con los `\n` tal como
   vienen).
4. Comparte la hoja **y la carpeta de Drive con los videos** con ese correo, en
   modo lectura. Sin el acceso a Drive, la hoja entra y el video no.
5. En `/ajustes`, pega el id de la hoja de cada marca. El id es lo que va entre
   `/d/` y `/edit` en la URL.

**Comprobación.** Llama a `/api/cron/sincronizar` con la cabecera del cron. En
`/diagnostico` aparece la última corrida, con las filas leídas y el motivo de
cada una que se quedó fuera.

---

## 4. Las cuentas de red

El token vive en una variable de entorno, y la base guarda solo el nombre de esa
variable. Para la cuenta de Instagram de SaleADS:

```
META_TOKEN_SALEADS=EAAG...
META_TOKEN_SALEADS_PAGE_ID=1234567890
```

En `/ajustes`, Conectar un canal, pon `META_TOKEN_SALEADS` en la referencia. La
app nunca ve el token, solo el nombre.

**Comprobación.** El canal aparece activo, con su fecha de vencimiento. El aviso
de renovación llega solo, siete días antes.

---

## 5. Meta

Tres trámites en este orden, y suman más de un mes: empiézalos el primer día.

1. **Verificación del negocio** en Meta Business Manager. De 5 a 15 días hábiles.
   Un correo de dominio propio acorta el trámite a la mitad.
2. **App Review** de `instagram_business_manage_messages` y del webhook de
   comentarios, con la app en modo Live. Alrededor de 20 días. Piden un
   screencast donde se vea el flujo completo y reproducible: entrar, aceptar el
   permiso, y que un mensaje real salga y entre por API.
3. **Webhook.** Apunta el campo `comments` a `/api/webhooks/instagram`, con
   `META_WEBHOOK_VERIFY_TOKEN` como token de verificación.

**Comprobación.** Meta acepta la suscripción del webhook. Un comentario de
prueba con la palabra clave llega a la bandeja o recibe su mensaje.

Mientras el App Review corre, todo lo demás funciona: la parrilla, la aprobación,
la publicación en Instagram y en YouTube, y la bandeja manual.

---

## 6. TikTok y YouTube

**TikTok.** El scope `video.publish` y la auditoría de Content Posting. Sin la
auditoría, todo lo que sale queda en visibilidad privada, así que el flujo deja
el video en el buzón del creador y la persona lo suelta desde la app. El día que
la auditoría pase, enciende la casilla de publicación directa en `/ajustes`.

**YouTube.** `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET` desde Google Cloud,
con el scope `youtube.force-ssl`. La subida vive en un bucket propio de 100
llamadas diarias. Las respuestas cuestan 50 unidades sobre 10.000, así que el
cupo por defecto es de 150 al día y el desborde pasa a la bandeja.

---

## 7. Desplegar

En Vercel, importa el repositorio y carga las mismas variables, más:

```
APP_URL=https://tu-dominio
CRON_SECRET=<una cadena larga y aleatoria>
```

`vercel.json` declara los seis trabajos programados:

| Ruta | Cadencia |
|---|---|
| `/api/cron/sincronizar` | cada 15 minutos |
| `/api/cron/video` | cada 30 minutos |
| `/api/cron/publicar` | cada 5 minutos |
| `/api/cron/escuchar` | cada 5 minutos |
| `/api/cron/limpiar` | cada hora |
| `/api/cron/avisos` | cada día a las 8 |

**Comprobación.** `/diagnostico` con todos los puntos en verde.

---

## 8. La primera semana

1. El equipo audiovisual llena la hoja y sube los videos a Drive.
2. La sincronización trae las piezas en menos de quince minutos.
3. En cada pieza escribes el caption, defines la palabra clave, eliges el recurso
   y redactas el mensaje. El enlace rastreado se arma solo.
4. Karen aprueba la semana desde la parrilla, por pieza o en bloque.
5. Cada mañana, `/dia` muestra lo que va a salir. Un clic lo programa.
6. Media hora antes, el video baja de Drive y queda listo en Storage.
7. A la hora fijada, la publicación sale y la escucha se activa sola con el
   identificador que devuelve la plataforma.
8. Los comentarios con la palabra reciben su mensaje. Lo que necesita una mano
   queda en `/bandeja` con la respuesta lista para copiar.
9. `/resultados` dice qué palabra, qué tema y qué hora trajeron gente.

---

## Cuando algo no sale

| Señal | Dónde mirar |
|---|---|
| Una pieza no aparece en la parrilla | `/diagnostico`, última sincronización: dice el motivo de cada fila que se quedó fuera |
| No se deja programar | La pieza dice qué le falta, arriba del editor |
| La publicación falla | `/avisos` trae el error de la plataforma. Los reintentos van a 2, 8 y 30 minutos |
| El video no sube | La pieza guarda el último error de Drive. Casi siempre es la carpeta sin compartir |
| Los comentarios no reciben respuesta | Revisa que el App Review esté aprobado y que la palabra clave esté activa |
| Un comentario quedó sin atender | `/bandeja` dice por qué: ventana vencida, cupo agotado, o red sin API de respuesta |
