# Prompt inicial para Claude Code

Copia este texto como primer mensaje en Claude Code, con CLAUDE.md y docs/ESPECIFICACION.md ya dentro del repositorio.

---

Vamos a construir el Motor Orgánico de SaleADS. Lee CLAUDE.md y docs/ESPECIFICACION.md completos antes de escribir código.

## Contexto

Aplicación web que publica contenido orgánico de dos marcas (SaleADS y Juanads) en Instagram, TikTok y YouTube, y responde sola los comentarios que traen una palabra clave, enviando un mensaje directo con un enlace de WhatsApp. El embudo de WhatsApp ya existe y queda fuera de alcance.

## Stack obligatorio

- Next.js 14+ con App Router
- TypeScript estricto
- Supabase para base de datos, autenticación y almacenamiento
- Tailwind CSS
- Zod para validación
- Cola con reintentos para el procesamiento de comentarios y envío de mensajes

## Tarea de esta sesión

Antes de programar, haz esto en orden.

**Paso 1. Verificación técnica.** Consulta la documentación oficial vigente y respóndeme con enlaces a la fuente de cada punto de la sección 10 de CLAUDE.md. Marca con claridad lo que no puedas confirmar. Este paso define el alcance real, así que va primero.

**Paso 2. Plan.** Con esos hallazgos, propón el plan de la Fase 1 dividido en entregas verificables, señalando qué queda automático y qué queda en bandeja manual según lo que permita cada API.

**Paso 3. Espera mi visto bueno.** Comienza a programar cuando yo confirme el plan.

## Orden de construcción de la Fase 1

1. Proyecto Next.js con TypeScript y Tailwind.
2. Supabase con el esquema completo de la sección 4 de la especificación, más políticas RLS por rol.
3. Autenticación y roles (editora, aprobadora, audiovisual, observador).
4. Ingesta de la parrilla desde la hoja de cálculo, con conciliación por sheet_row_id.
5. Editor de pieza con caption por red, palabra clave con generación de variantes, recurso y enlace rastreado.
6. Flujo de aprobación con devolución y recálculo de calendario.
7. Panel del día con aprobación en un clic y publicación en Instagram.
8. Motor de comentarios de Instagram con normalización de texto, coincidencia por variantes, cola con control de tasa e idempotencia.
9. Bandeja manual para TikTok y YouTube.
10. Panel de resultados por pieza.

## Cómo quiero que trabajes

- Valida las reglas de negocio en frontend y en backend.
- Cada envío de mensaje queda registrado con su resultado.
- Idempotencia estricta. Un comentario recibe una sola respuesta, aunque el sondeo lo vea dos veces.
- Cero secretos en el repositorio, todo en variables de entorno.
- Prueba el motor de comentarios con un caso de 300 comentarios simulados antes de darlo por terminado.
- Cuando una decisión técnica cambie el alcance, dímelo antes de implementarla.

Empieza por el Paso 1.
