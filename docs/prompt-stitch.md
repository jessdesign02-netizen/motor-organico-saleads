# Prompt para Google Stitch

Cómo usarlo: en [stitch.withgoogle.com](https://stitch.withgoogle.com), elegir **Web**
(no App: esto es una herramienta de escritorio), pegar el prompt principal y generar.
Después pedir pantalla por pantalla con los prompts de seguimiento.

El prompt va en español a propósito: Stitch escribe los textos de la interfaz en el
idioma del prompt, y esta herramienta la usa un equipo que trabaja en español.

---

## Prompt principal

```
Diseña una aplicación web de escritorio en español llamada "Motor Orgánico".

QUÉ ES
Una herramienta interna de operaciones para una agencia de marketing. Publica el
contenido orgánico de dos marcas (SaleADS y Juanads) en Instagram, TikTok y YouTube,
y responde automáticamente los comentarios que traen una palabra clave, enviando un
mensaje directo con un enlace. Es un CRM de conversaciones, no una red social.
La usan cuatro personas: una editora, una aprobadora, el equipo audiovisual y
observadores.

ESTRUCTURA
Barra lateral fija a la izquierda de 240px, con fondo blanco roto y una línea fina de
separación. De arriba abajo:
- Nombre "Motor Orgánico" y debajo, en gris pequeño, "SaleADS · Juanads"
- Bloque de usuario: avatar circular con la inicial, nombre y rol debajo en gris
- Menú principal con icono de línea a la izquierda de cada nombre:
  Dashboard, Contactos, Chat en vivo, Publicaciones, Parrilla, Resultados,
  Automatizaciones, Configuración
- Un subtítulo gris en mayúsculas pequeñas que dice "OPERACIÓN" y debajo:
  El día, Avisos, Recursos, Diagnóstico
- Abajo del todo, "Salir"
"Chat en vivo" y "Avisos" llevan una burbuja con un número a la derecha, en ámbar
suave. La sección activa se marca con un fondo gris muy claro y texto más oscuro.
El contenido ocupa el resto del ancho, con un máximo de 1100px y respiración generosa.

LENGUAJE VISUAL
Modo claro únicamente, sereno y de alta legibilidad. Estilo editorial y sobrio, más
cercano a Linear o Notion que a un panel de analítica colorido. Nada de degradados,
nada de sombras fuertes, nada de esquinas muy redondeadas.

Colores exactos:
- Fondo de página #f9f9f7
- Tarjetas y barra lateral #fcfcfb
- Fondo hundido (bloques de cita, celdas suaves) #f2f1ed
- Texto principal #0b0b0b, secundario #52514e, apagado #898781
- Líneas y bordes #e1e0d9, bordes marcados #c3c2b7
- Acento de datos: azul #2a78d6, naranja #eb6834, verde agua #1baf7a

Etiquetas de estado, siempre con texto además del color, en píldora pequeña:
- Neutro: fondo #f2f1ed, texto #4a4945
- Bien: fondo #e0f2e0, texto #0a6b0a
- Aviso: fondo #fcf1d6, texto #7a5600
- Información: fondo #e2edfb, texto #1c5cab
- Serio: fondo #fbe8de, texto #8a3a17
- Crítico: fondo #fae2e2, texto #9b1f1f

Tipografía del sistema (system-ui). Títulos de página 20px semibold, títulos de
tarjeta 14px semibold, cuerpo 14px, apoyos 12px. Cifras grandes en 30px semibold.
Bordes redondeados de 12px en tarjetas y 8px en botones y píldoras.
Tarjetas con borde de 1px y sin sombra. Un solo botón oscuro por pantalla; el resto
con borde y fondo blanco.

PANTALLA A DISEÑAR PRIMERO: Dashboard
- Saludo "Hola, Jess" y debajo la fecha escrita en palabras
- Una franja destacada con borde oscuro: "2 piezas están listas para salir hoy" y un
  botón oscuro "Abrir el día"
- Cuatro tarjetas de cifra en fila: Comentarios con la palabra, Mensajes enviados,
  Clics al enlace, Esperan tu mano. Cada una con la etiqueta arriba en gris pequeño,
  la cifra grande debajo, y una nota gris de contexto
- Dos tarjetas lado a lado: "Sale hoy" (lista con hora en negrita, título de la pieza,
  marca y etiqueta de estado) y "Avisos" (lista con píldora de tipo, tiempo relativo y
  el titular)
- Una tarjeta ancha "La semana" con cuatro botones de acceso rápido
```

---

## Prompts de seguimiento, uno por pantalla

Pegar cada uno como mensaje nuevo en la misma conversación de Stitch, para que
mantenga el sistema visual.

**Chat en vivo** — la pantalla más importante:
```
Ahora diseña la pantalla "Chat en vivo", con el mismo sistema visual.
Es un CRM de conversaciones: muestra en tiempo real lo que el agente automático ya
está haciendo. Dos columnas.

Arriba: tres pestañas de filtro (Todas, Necesitan tu mano, Respondidas) cada una con
su número al lado en gris, y a la derecha un indicador "En vivo" con un punto verde
que late.

Columna izquierda, 320px: lista de conversaciones. Cada una con el usuario en negrita
(@andrea.mkt), el tiempo relativo a la derecha en gris (hace 2 h), debajo una línea
del último mensaje truncada, y debajo una píldora de estado y el nombre de la red.
La conversación seleccionada tiene fondo gris claro.

Columna derecha: el hilo. Cabecera con el usuario, la red y el nombre de la pieza como
enlace, y a la derecha los botones "Ver el post" y "Copiar respuesta".
Debajo una fila de datos separada por una línea: Palabra, Clics al enlace, Estado.
Luego los mensajes como burbujas de chat: lo que escribió la persona a la izquierda en
gris claro, lo que respondió el sistema a la derecha en azul muy suave. Bajo cada
burbuja, en gris pequeño, "Comentó" o "El sistema respondió" y el tiempo.
```

**Parrilla**:
```
Ahora la pantalla "Parrilla", con el mismo sistema visual.
Calendario semanal de dos marcas. Título "Parrilla" y debajo "Del 7 al 13 de
septiembre". A la derecha, flechas de semana anterior y siguiente.
Por cada marca: su nombre, al lado en gris "8 piezas · 3 sin aprobar", y a la derecha
un botón oscuro "Aprobar" con un enlace gris "Marcar las 3".
Debajo, siete columnas iguales, una por día, cada una una tarjeta con borde fino. La
cabecera de cada columna es el nombre del día y el número, y la de hoy lleva borde
oscuro y una píldora negra pequeña que dice "hoy".
Dentro de cada día, tarjetas pequeñas de pieza: casilla de selección, título en dos
líneas, y debajo una píldora de estado y la hora en gris.
Al final una franja azul muy suave: "Propuesta de calendario", con tres líneas de
"tal pieza pasa al 8 de septiembre" y dos botones.
```

**Automatizaciones**:
```
Ahora "Automatizaciones", con el mismo sistema visual.
Lista de reglas de palabra clave. Cabecera con el total y cuántas están escuchando.
Cada regla es una tarjeta ancha:
- Cabecera: la palabra clave en mayúsculas y grande (PRESUPUESTO), al lado un punto
  verde con el texto "escuchando", y a la derecha la etiqueta de estado de la pieza.
  Debajo en gris: nombre de la pieza, marca, fecha y redes.
- Cuerpo en dos columnas: a la izquierda "También responde a" con las variantes
  separadas por puntos, y debajo "Mensaje que envía" en un bloque gris claro.
  A la derecha tres cifras apiladas en cajas grises: Detectados, Mensajes enviados,
  Clics al enlace.
```

**Contactos**:
```
Ahora "Contactos", con el mismo sistema visual.
Una tabla dentro de una tarjeta, sin bordes verticales, con líneas horizontales muy
finas. Columnas: Persona (usuario en negrita y debajo en gris "3 piezas"), Red,
Último comentario (dos líneas truncadas y debajo una píldora de estado), Comentarios,
Recibió, Cuándo. Todas las columnas numéricas alineadas a la derecha.
Cabecera de la tabla en gris pequeño, sin fondo.
```

**Resultados**:
```
Ahora "Resultados", con el mismo sistema visual.
Panel semanal. Arriba cuatro tarjetas de cifra. Debajo una tarjeta ancha "Por marca y
por red" con una tabla, donde cada fila lleva una barra horizontal fina de color
azul mostrando la magnitud junto al número.
Después tres tarjetas en fila: "Palabras clave", "Temas" y "Tipos de hook", cada una
una lista de cinco filas con la etiqueta a la izquierda, el número a la derecha, y una
barra fina debajo ocupando el ancho proporcional.
Sin gráficos de torta, sin ejes dobles, sin colores de arcoíris: máximo tres colores
de datos y siempre con la cifra escrita al lado.
```

**Publicaciones y Configuración**:
```
Ahora "Publicaciones": tres tarjetas apiladas con tabla dentro, tituladas "No salieron",
"En cola" y "En vivo", en ese orden. Columnas: Pieza (título y debajo la marca en gris,
y si falló, el error en naranja oscuro), Red, Estado en píldora, Intentos, Cuándo, y un
enlace "Ver".

Y "Configuración": tarjetas apiladas de "Canales" (una fila por cuenta conectada, con
red, arroba, estado del token y dos interruptores), "Marcas" y "Equipo" (lista de
personas con su rol en un desplegable).
```

---

## Qué hacer con lo que devuelva

Stitch entrega HTML con Tailwind propio, no el sistema de tokens de este proyecto. El
camino es: quedarse con la dirección visual —proporciones, jerarquía, densidad,
tratamiento de tablas y tarjetas— y trasladarla a `src/app/globals.css` y
`src/app/ui.tsx`, que es donde vive el sistema. Pegar el HTML de Stitch directamente
rompería el modo demo, los estados de carga y las validaciones de rol.

Los colores del prompt son los que ya están en `globals.css`, así que lo que Stitch
devuelva va a encajar de entrada.
