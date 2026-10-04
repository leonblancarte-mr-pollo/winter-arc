-- =====================================================================
-- WINTER ARC — Bonus de cardio por distancia (+5) y actividad desde el calendario
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de migracion.sql, anuncios_chat.sql, evidencia_habitos.sql
-- y edicion_hoy_ayer.sql. Se puede correr más de una vez.
--
-- Al tachar "Cardio" en el calendario, la app guarda la foto, marca el hábito
-- y registra la actividad (tipo, km, minutos) en "activities" con
-- from_habit = true. Un trigger de la base revisa la distancia y, si llega
-- al umbral, crea el bonus en bonus_events (type = 'cardio_distance', +5):
--   running  >= 5 km
--   bici     >= 20 km
--   natación >= 2 km
-- Nadie puede insertar ese bonus a mano: solo el trigger.
--
-- Reglas:
--   * Máximo UN bonus de distancia por usuario y día (el flujo del calendario
--     registra una actividad por cada vez que se tacha Cardio).
--   * Solo hoy o ayer, dentro de la carrera, y con la foto de cardio de ese día.
--   * Si se destacha Cardio, se borran las actividades de ese día que vinieron
--     del calendario y, con ellas, su bonus (on delete cascade).
--   * Si se borra la actividad (lista de Stats), también se va el bonus.
-- No cambia la vista leaderboard: ya suma cualquier fila de bonus_events.
-- =====================================================================

-- 1) Actividades que vienen de tachar Cardio en el calendario
alter table public.activities
  add column if not exists from_habit boolean not null default false;

-- 2) bonus_events acepta el nuevo tipo y guarda de qué actividad salió
alter table public.bonus_events
  add column if not exists activity_id bigint references public.activities (id) on delete cascade,
  add column if not exists activity_type text;

alter table public.bonus_events drop constraint if exists bonus_events_type_check;
alter table public.bonus_events
  add constraint bonus_events_type_check check (type in ('book', 'half_marathon', 'cardio_distance'));

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
  );

create unique index if not exists bonus_cardio_distance_actividad
  on public.bonus_events (activity_id) where type = 'cardio_distance';
create unique index if not exists bonus_cardio_distance_dia
  on public.bonus_events (user_id, date) where type = 'cardio_distance';

-- 3) Los usuarios solo registran libro y medio maratón; el de distancia lo crea el trigger
drop policy if exists "bonus: insertar los míos" on public.bonus_events;
create policy "bonus: insertar los míos" on public.bonus_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and type in ('book', 'half_marathon')
    and date <= (now() at time zone 'America/Mexico_City')::date
  );

-- 4) Umbral de cada tipo (null = ese tipo no tiene bonus). Misma regla que
--    CARDIO_DISTANCE_BONUS en src/lib/constants.ts
create or replace function public.cardio_bonus_min_km(p_type text)
returns numeric
language sql immutable
as $$
  select case p_type when 'running' then 5 when 'bici' then 20 when 'natacion' then 2 else null end::numeric;
$$;

-- 5) Otorga el bonus al registrar la actividad
create or replace function public.grant_cardio_distance_bonus()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_min numeric := public.cardio_bonus_min_km(new.type);
begin
  if not new.from_habit or v_min is null or new.distance_km < v_min then
    return new;
  end if;
  if new.date not between date '2026-10-01' and date '2026-12-31' or not public.is_editable_day(new.date) then
    return new;
  end if;
  -- Solo si ese día ya tiene la foto de cardio (la app la guarda antes que la actividad)
  if not exists (
    select 1 from public.habit_evidence
    where user_id = new.user_id and date = new.date and habit_key = 'cardio'
  ) then
    return new;
  end if;

  insert into public.bonus_events (user_id, type, points, date, distance_km, activity_id, activity_type)
  values (new.user_id, 'cardio_distance', 5, new.date, new.distance_km, new.id, new.type)
  on conflict (user_id, date) where type = 'cardio_distance' do nothing;
  return new;
end;
$$;

-- El nombre empieza con "activities_" para que corra ANTES que announce_activity_trigger
-- (Postgres corre los triggers del mismo evento en orden alfabético)
drop trigger if exists activities_cardio_bonus_trigger on public.activities;
create trigger activities_cardio_bonus_trigger
  after insert on public.activities
  for each row execute function public.grant_cardio_distance_bonus();

-- 6) Destachar Cardio borra la actividad que se registró con él (y su bonus, por cascade)
create or replace function public.remove_cardio_habit_activities()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.habit_key = 'cardio' then
    delete from public.activities
    where user_id = old.user_id and date = old.date and from_habit;
  end if;
  return old;
end;
$$;

drop trigger if exists habit_checks_cardio_cleanup_trigger on public.habit_checks;
create trigger habit_checks_cardio_cleanup_trigger
  after delete on public.habit_checks
  for each row execute function public.remove_cardio_habit_activities();

-- 7) Anuncio del bonus en el chat (mismo trigger de libro y medio maratón)
create or replace function public.announce_bonus()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  nombre text;
  texto text;
begin
  select display_name into nombre from public.profiles where id = new.user_id;
  nombre := coalesce(nombre, 'Alguien');

  if new.type = 'book' then
    texto := format(
      E'🏆 %s terminó ''%s'' y ganó +%s pts. Su reseña: ''%s''',
      nombre,
      left(trim(new.book_title), 120),
      new.points,
      left(trim(new.review_text), 500) || case when char_length(trim(new.review_text)) > 500 then '…' else '' end
    );
  elsif new.type = 'half_marathon' then
    texto := format('🎉 %s corrió 21km y ganó +%s pts. ¡Verifícalo en su perfil!', nombre, new.points);
  elsif new.type = 'cardio_distance' then
    texto := case new.activity_type
      when 'bici'     then format('🚴 %s rodó %skm en bici y ganó un bonus de +%s pts', nombre, trim_scale(new.distance_km), new.points)
      when 'natacion' then format('🏊 %s nadó %skm y ganó un bonus de +%s pts', nombre, trim_scale(new.distance_km), new.points)
      else                 format('🏃 %s corrió %skm y ganó un bonus de +%s pts', nombre, trim_scale(new.distance_km), new.points)
    end;
  else
    return new;
  end if;

  insert into public.messages (user_id, content, is_system) values (new.user_id, texto, true);
  return new;
end;
$$;

-- 8) Anuncio de actividad: si ya ganó el bonus de distancia, no se repite
--    (el mensaje del bonus ya dice los km)
create or replace function public.announce_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  nombre text;
  tipo text;
  texto text;
begin
  if new.type not in ('running', 'bici', 'natacion') then
    return new;
  end if;
  if not (new.distance_km > 3 or coalesce(new.duration_min, 0) > 20) then
    return new;
  end if;
  if exists (select 1 from public.bonus_events where activity_id = new.id) then
    return new;
  end if;

  select display_name into nombre from public.profiles where id = new.user_id;
  nombre := coalesce(nombre, 'Alguien');
  tipo := case new.type when 'natacion' then 'natación' else new.type end;

  texto := format('🏃 %s hizo %s por %skm', nombre, tipo, trim_scale(new.distance_km));
  if new.duration_min is not null then
    texto := texto || format(' / %smin', new.duration_min);
  end if;

  insert into public.messages (user_id, content, is_system) values (new.user_id, texto, true);
  return new;
end;
$$;
