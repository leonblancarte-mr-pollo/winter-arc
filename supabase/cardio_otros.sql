-- =====================================================================
-- WINTER ARC — Opción "Otros" al tachar Cardio (foto + tiempo + descripción)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de migracion.sql y cardio_distancia.sql. Se puede correr
-- más de una vez.
--
-- Qué cambia: al tachar Cardio, además de running/bici/natación ahora se
-- puede elegir "Otros". Para "Otros" no se piden km: solo foto (ya la pide
-- el flujo normal de evidencia), minutos y una descripción de la actividad.
-- Se guarda en "activities" igual que los demás (type = 'otro'), pero sin
-- distance_km. No da el bonus de +5 por distancia (el trigger de
-- cardio_distancia.sql ya ignora cualquier tipo que no sea
-- running/bici/natación) ni anuncio en el chat de "hizo tantos km"
-- (announce_activity ya solo anuncia esos 3 tipos).
-- =====================================================================

-- 1) Qué se hizo, para type = 'otro' (las demás actividades no la usan)
alter table public.activities add column if not exists description text;

-- 2) distance_km ya no es obligatorio para 'otro'; para los demás tipos sigue igual
alter table public.activities alter column distance_km drop not null;
alter table public.activities drop constraint if exists activities_distance_km_check;
alter table public.activities
  add constraint activities_distance_km_check check (
    (type = 'otro' and distance_km is null) or (type <> 'otro' and distance_km > 0 and distance_km < 1000)
  );

-- 3) 'otro' sí necesita minutos y descripción (los demás tipos los dejan opcionales)
alter table public.activities drop constraint if exists activities_otro_valido;
alter table public.activities
  add constraint activities_otro_valido check (
    type <> 'otro' or (duration_min is not null and duration_min > 0 and char_length(trim(coalesce(description, ''))) >= 1)
  );
