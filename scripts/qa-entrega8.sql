-- Puerta QA de la Entrega 8: caption por red, propuestas de calendario y el
-- paso de borrador a revisión.

\set ON_ERROR_STOP on
\set QUIET on

-- ---------------------------------------------------------------------------
-- Caption por red
-- ---------------------------------------------------------------------------

select qa_afirmar(
  (select captions_red from pieces where id = 'dddddddd-0000-0000-0000-000000000001') = '{}'::jsonb,
  'la pieza nace con todas las redes heredando el caption base');

update pieces
   set caption_base = 'caption base',
       captions_red = '{"instagram": "solo para IG"}'::jsonb
 where id = 'dddddddd-0000-0000-0000-000000000001';

select qa_afirmar(
  (select captions_red ->> 'instagram' from pieces where id = 'dddddddd-0000-0000-0000-000000000001') = 'solo para IG',
  'la red con caption propio lo conserva');

select qa_afirmar(
  (select captions_red ->> 'tiktok' from pieces where id = 'dddddddd-0000-0000-0000-000000000001') is null,
  'la red sin caption propio queda vacía para heredar del base');

-- ---------------------------------------------------------------------------
-- Propuestas de calendario
-- ---------------------------------------------------------------------------

insert into calendar_proposals (brand_id, semana, propuesta, motivo)
values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-07',
        '[{"id": "dddddddd-0000-0000-0000-000000000002", "fecha": "2026-09-08", "tema": "Creatividad"}]'::jsonb,
        'una pieza volvió a revisión');

select qa_afirmar(
  (select count(*) from calendar_proposals where semana = '2026-09-07') = 1,
  'la propuesta queda guardada sin aplicarse');

select qa_afirmar(
  (select aplicada_at from calendar_proposals where semana = '2026-09-07') is null,
  'la propuesta nace sin aplicar: la confirmación es de la persona');

select qa_debe_fallar(
  $$insert into calendar_proposals (brand_id, semana, propuesta)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-07', '[]'::jsonb)$$,
  'una sola propuesta viva por marca y semana', 'duplicate key');

select qa_afirmar(
  (select count(*) from calendar_proposals
    where brand_id = 'aaaaaaaa-0000-0000-0000-000000000002') = 0,
  'la propuesta de una marca deja libre a la otra');

-- ---------------------------------------------------------------------------
-- El paso de borrador a revisión
-- ---------------------------------------------------------------------------

insert into pieces (id, brand_id, semana, tema, estado)
values ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
        '2026-09-07', 'Pieza recién llegada', 'borrador');

update pieces set estado = 'revision'
 where id = 'dddddddd-0000-0000-0000-00000000000a' and estado = 'borrador';

select qa_afirmar(
  (select estado from pieces where id = 'dddddddd-0000-0000-0000-00000000000a') = 'revision',
  'la pieza en borrador pasa a revisión');

-- El mismo movimiento sobre una pieza que ya avanzó no toca nada, porque la
-- condición de estado la deja fuera.
update pieces set estado = 'revision'
 where id = 'dddddddd-0000-0000-0000-000000000001' and estado = 'borrador';

select qa_afirmar(
  (select estado from pieces where id = 'dddddddd-0000-0000-0000-000000000001') = 'publicado',
  'el envío a revisión deja quieta a la pieza que ya salió');

\echo ''
\echo '=== Entrega 8: verificada ==='
