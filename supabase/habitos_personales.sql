-- =====================================================================
-- WINTER ARC — Hábitos personales (privados, NO suman puntos)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Se puede correr más de una vez sin problema.
--
-- Cada usuario crea sus propios hábitos extra. Solo él los ve: ningún
-- otro usuario puede leerlos (ni en el ranking ni en su perfil público).
-- No tocan la vista "leaderboard" ni las tablas de la carrera.
-- =====================================================================

-- 1) Los hábitos personales
create table if not exists public.custom_habits (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  icon text,                                   -- opcional (hoy todos usan el mismo ícono)
  archived boolean not null default false,     -- archivar = ocultar sin borrar el historial
  created_at timestamptz not null default now()
);

-- 2) Sus casillas tachadas (mismo patrón que habit_checks)
create table if not exists public.custom_habit_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  custom_habit_id bigint not null references public.custom_habits (id) on delete cascade,
  date date not null check (date between '2026-10-01' and '2026-12-31'),
  created_at timestamptz not null default now(),
  unique (user_id, custom_habit_id, date)
);

create index if not exists custom_habits_user_idx on public.custom_habits (user_id);
create index if not exists custom_habit_checks_user_idx on public.custom_habit_checks (user_id, date);

-- 3) Seguridad: cada quien SOLO ve y toca lo suyo
alter table public.custom_habits       enable row level security;
alter table public.custom_habit_checks enable row level security;

drop policy if exists "hábitos personales: ver los míos" on public.custom_habits;
create policy "hábitos personales: ver los míos" on public.custom_habits
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "hábitos personales: crear los míos" on public.custom_habits;
create policy "hábitos personales: crear los míos" on public.custom_habits
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "hábitos personales: editar los míos" on public.custom_habits;
create policy "hábitos personales: editar los míos" on public.custom_habits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "hábitos personales: borrar los míos" on public.custom_habits;
create policy "hábitos personales: borrar los míos" on public.custom_habits
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "casillas personales: ver las mías" on public.custom_habit_checks;
create policy "casillas personales: ver las mías" on public.custom_habit_checks
  for select to authenticated using (user_id = auth.uid());
-- Solo se tacha un hábito propio, y nunca un día futuro (igual que los hábitos oficiales)
drop policy if exists "casillas personales: marcar las mías" on public.custom_habit_checks;
create policy "casillas personales: marcar las mías" on public.custom_habit_checks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and date <= (now() at time zone 'America/Mexico_City')::date
    and exists (select 1 from public.custom_habits h where h.id = custom_habit_id and h.user_id = auth.uid())
  );
drop policy if exists "casillas personales: borrar las mías" on public.custom_habit_checks;
create policy "casillas personales: borrar las mías" on public.custom_habit_checks
  for delete to authenticated using (user_id = auth.uid());
