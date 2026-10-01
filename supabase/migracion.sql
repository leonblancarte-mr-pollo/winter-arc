-- =====================================================================
-- WINTER ARC — Migración completa de la base de datos
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- Se puede correr una sola vez en un proyecto nuevo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PERFILES (nombre para mostrar de cada usuario)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 30),
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando alguien se registra.
-- El nombre viene en los metadatos del registro (display_name).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2) HÁBITOS MARCADOS (una fila = un hábito cumplido en un día)
--    Solo fechas de la carrera (1 oct – 31 dic 2026) y nunca a futuro.
-- ---------------------------------------------------------------------
create table public.habit_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null check (date between '2026-10-01' and '2026-12-31'),
  habit_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date, habit_key)
);

-- ---------------------------------------------------------------------
-- 3) BONUS (libro terminado +5, medio maratón +50)
--    Las reglas se validan aquí para que nadie pueda inventar puntos.
-- ---------------------------------------------------------------------
create table public.bonus_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null check (type in ('book', 'half_marathon')),
  points int not null,
  date date not null check (date between '2026-10-01' and '2026-12-31'),
  book_title text,
  review_text text,
  distance_km numeric(6, 2),
  photo_path text,
  created_at timestamptz not null default now(),
  constraint bonus_valido check (
    (type = 'book'
      and points = 5
      and char_length(trim(coalesce(book_title, ''))) >= 1
      and char_length(trim(coalesce(review_text, ''))) >= 20)
    or
    (type = 'half_marathon'
      and points = 50
      and distance_km >= 21
      and photo_path is not null)
  )
);

-- ---------------------------------------------------------------------
-- 4) ACTIVIDADES MANUALES (km de running, bici, etc.)
-- ---------------------------------------------------------------------
create table public.activities (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  type text not null check (type in ('running', 'bici', 'natacion', 'caminata', 'otro')),
  distance_km numeric(7, 2) not null check (distance_km > 0 and distance_km < 1000),
  duration_min int check (duration_min is null or duration_min > 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) SETS DE GYM IMPORTADOS DE HEVY (privados)
--    El "unique" evita duplicados si subes el mismo CSV dos veces.
-- ---------------------------------------------------------------------
create table public.workout_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_title text,
  workout_start timestamptz not null,
  workout_end timestamptz,
  exercise_title text not null,
  set_index int not null,
  set_type text,
  weight_kg numeric(7, 2),
  reps int,
  distance_km numeric(7, 3),
  duration_seconds int,
  rpe numeric(3, 1),
  created_at timestamptz not null default now(),
  unique (user_id, workout_start, exercise_title, set_index)
);

-- ---------------------------------------------------------------------
-- 6) CHAT GRUPAL
-- ---------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Índices para que las consultas sean rápidas
create index on public.habit_checks (user_id, date);
create index on public.bonus_events (user_id);
create index on public.activities (user_id, date);
create index on public.workout_sets (user_id, workout_start);
create index on public.messages (created_at desc);

-- ---------------------------------------------------------------------
-- 7) SEGURIDAD (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.habit_checks  enable row level security;
alter table public.bonus_events  enable row level security;
alter table public.activities    enable row level security;
alter table public.workout_sets  enable row level security;
alter table public.messages      enable row level security;

-- Perfiles: todos con sesión leen; cada quien edita el suyo
create policy "perfiles: leer" on public.profiles
  for select to authenticated using (true);
create policy "perfiles: editar el mío" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Hábitos: todos leen; cada quien marca/desmarca los suyos (sin días futuros)
create policy "hábitos: leer" on public.habit_checks
  for select to authenticated using (true);
create policy "hábitos: insertar los míos" on public.habit_checks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and date <= (now() at time zone 'America/Mexico_City')::date
  );
create policy "hábitos: borrar los míos" on public.habit_checks
  for delete to authenticated using (user_id = auth.uid());

-- Bonus: todos leen; cada quien registra/borra los suyos
create policy "bonus: leer" on public.bonus_events
  for select to authenticated using (true);
create policy "bonus: insertar los míos" on public.bonus_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and date <= (now() at time zone 'America/Mexico_City')::date
  );
create policy "bonus: borrar los míos" on public.bonus_events
  for delete to authenticated using (user_id = auth.uid());

-- Actividades: todos leen; cada quien escribe las suyas
create policy "actividades: leer" on public.activities
  for select to authenticated using (true);
create policy "actividades: insertar las mías" on public.activities
  for insert to authenticated with check (user_id = auth.uid());
create policy "actividades: editar las mías" on public.activities
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "actividades: borrar las mías" on public.activities
  for delete to authenticated using (user_id = auth.uid());

-- Gym (Hevy): PRIVADO, solo el dueño lee y escribe
create policy "gym: leer los míos" on public.workout_sets
  for select to authenticated using (user_id = auth.uid());
create policy "gym: insertar los míos" on public.workout_sets
  for insert to authenticated with check (user_id = auth.uid());
create policy "gym: editar los míos" on public.workout_sets
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gym: borrar los míos" on public.workout_sets
  for delete to authenticated using (user_id = auth.uid());

-- Chat: todos leen; cada quien escribe como sí mismo
create policy "chat: leer" on public.messages
  for select to authenticated using (true);
create policy "chat: escribir como yo" on public.messages
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8) RANKING (vista con el total de puntos de cada usuario)
--    total = hábitos cumplidos + bonus (libro/medio maratón) + bonus semanales
--    Bonus semanales (semana de lunes a domingo):
--      3+ días de cardio en la semana = +5
--      5+ días de gym en la semana    = +5
-- ---------------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = true) as
with habitos as (
  select user_id, count(*)::int as pts
  from public.habit_checks
  group by user_id
),
bonus as (
  select user_id, sum(points)::int as pts
  from public.bonus_events
  group by user_id
),
semanas as (
  select
    user_id,
    date_trunc('week', date)::date as semana,
    count(*) filter (where habit_key = 'cardio') as cardio,
    count(*) filter (where habit_key = 'gym') as gym
  from public.habit_checks
  group by user_id, date_trunc('week', date)
),
semanal as (
  select
    user_id,
    sum(case when cardio >= 3 then 5 else 0 end + case when gym >= 5 then 5 else 0 end)::int as pts
  from semanas
  group by user_id
)
select
  p.id as user_id,
  p.display_name,
  coalesce(h.pts, 0) as habit_points,
  coalesce(b.pts, 0) as bonus_points,
  coalesce(s.pts, 0) as weekly_bonus_points,
  coalesce(h.pts, 0) + coalesce(b.pts, 0) + coalesce(s.pts, 0) as total_points
from public.profiles p
left join habitos h on h.user_id = p.id
left join bonus   b on b.user_id = p.id
left join semanal s on s.user_id = p.id;

grant select on public.leaderboard to authenticated;

-- ---------------------------------------------------------------------
-- 9) CHAT EN TIEMPO REAL
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------
-- 10) FOTOS DE EVIDENCIA (Storage, bucket "evidencias")
--     Todos con sesión pueden verlas; cada quien sube solo a su carpeta.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "evidencias: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidencias');

create policy "evidencias: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "evidencias: borrar las mías" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
