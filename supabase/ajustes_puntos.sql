-- =====================================================================
-- WINTER ARC — Ajustes manuales de puntos reales (reembolsos, correcciones)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de migracion.sql y cardio_distancia.sql (modifica bonus_events).
-- Se puede correr más de una vez.
--
-- Qué hace: agrega un nuevo tipo de bonus_events, "adjustment", para que el
-- admin pueda sumar o restar puntos reales a cualquier usuario con una nota
-- (label). Como la vista "leaderboard" y las gráficas de hábitos/stats ya
-- suman TODOS los bonus_events sin importar el tipo, un ajuste aparece solo
-- al insertarse: en la gráfica del usuario y en el ranking/gráficas
-- compartidas de sus grupos (incluido "LOS PERROS"). No toca peseis ni el
-- casino: es puntos reales, igual que un hábito o un bonus de libro.
--
-- Solo el admin puede crear ajustes (para sí mismo o para cualquier otro
-- usuario); nadie más puede insertar type = 'adjustment'.
-- =====================================================================

-- 1) Columna para la nota del ajuste (ej. "ajuste: reembolso comprar peseis")
alter table public.bonus_events add column if not exists label text;

-- 2) Nuevo tipo válido
alter table public.bonus_events drop constraint if exists bonus_events_type_check;
alter table public.bonus_events
  add constraint bonus_events_type_check check (type in ('book', 'half_marathon', 'cardio_distance', 'adjustment'));

alter table public.bonus_events drop constraint if exists bonus_valido;
alter table public.bonus_events
  add constraint bonus_valido check (
    (type = 'book'
      and points = 5
      and char_length(trim(coalesce(book_title, ''))) >= 1
      and char_length(trim(coalesce(review_text, ''))) >= 20)
    or
    (type = 'half_marathon'
      and points = 50
      and distance_km >= 21
      and photo_path is not null)
    or
    (type = 'cardio_distance'
      and points = 5
      and activity_id is not null
      and activity_type in ('running', 'bici', 'natacion')
      and distance_km is not null)
    or
    (type = 'adjustment'
      and points <> 0
      and char_length(trim(coalesce(label, ''))) >= 1)
  );

-- 3) Solo el admin inserta ajustes; libro y medio maratón siguen siendo de cada quien
drop policy if exists "bonus: insertar los míos" on public.bonus_events;
create policy "bonus: insertar los míos" on public.bonus_events
  for insert to authenticated
  with check (
    (user_id = auth.uid() and type in ('book', 'half_marathon') and date <= (now() at time zone 'America/Mexico_City')::date)
    or (type = 'adjustment' and public.is_app_admin())
  );

-- (El reembolso puntual de +17 a Kevincito se quitó el 2026-10-07: sus compras
-- de peseis se borraron en supabase/kevincito_fix.sql y ya no hace falta.)
