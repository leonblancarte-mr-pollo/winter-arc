-- =====================================================================
-- WINTER ARC — Override de admin: registrar hábitos de días anteriores
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de migracion.sql, evidencia_habitos.sql, edicion_hoy_ayer.sql
-- y grupos.sql (usa public.is_app_admin()). Se puede correr más de una vez.
--
-- Qué hace: SOLO el 2026-10-05 (hora de Ciudad de México), el admin de la
-- app (public.is_app_admin(), hoy nada más leon.blancarte@gmail.com) puede
-- tachar/destachar SUS PROPIOS hábitos oficiales y subir su propia evidencia
-- de cualquier día de la carrera, no solo hoy/ayer. Sigue siendo SOLO para
-- su propia cuenta: no puede tocar los hábitos de otra persona.
--
-- Cada vez que se use fuera de la ventana normal (hoy/ayer) queda guardado
-- en admin_overrides_log: quién, cuándo, para qué día y qué hábito, y si
-- fue para marcarlo o para borrarlo. A partir del 2026-10-06,
-- is_admin_override_day() regresa falso sola y todo vuelve a la regla
-- normal (solo hoy y ayer, supabase/edicion_hoy_ayer.sql).
--
-- No cambia hábitos personales (custom_habit_checks): esos siguen con la
-- regla de siempre.
-- =====================================================================

-- ¿Hoy es el día del override? Misma fecha que ADMIN_OVERRIDE_DAY en
-- src/lib/constants.ts: cámbiala en los dos lugares si se repite.
create or replace function public.is_admin_override_day()
returns boolean
language sql stable
as $$
  select (now() at time zone 'America/Mexico_City')::date = date '2026-10-05';
$$;

-- Bitácora: queda todo lo que se tocó fuera de la ventana normal de hoy/ayer
create table if not exists public.admin_overrides_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  habit_key text not null,
  action text not null check (action in ('insertar', 'borrar')),
  created_at timestamptz not null default now()
);

alter table public.admin_overrides_log enable row level security;

drop policy if exists "bitácora override: el admin lee la suya" on public.admin_overrides_log;
create policy "bitácora override: el admin lee la suya" on public.admin_overrides_log
  for select to authenticated using (admin_id = auth.uid() and public.is_app_admin());

-- 1) Hábitos oficiales: el admin puede tachar/destachar cualquier día SUYO,
--    pero solo el 2026-10-05
drop policy if exists "hábitos: insertar los míos" on public.habit_checks;
create policy "hábitos: insertar los míos" on public.habit_checks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_editable_day(date) or (public.is_app_admin() and public.is_admin_override_day()))
  );

drop policy if exists "hábitos: borrar los míos" on public.habit_checks;
create policy "hábitos: borrar los míos" on public.habit_checks
  for delete to authenticated
  using (
    user_id = auth.uid()
    and (public.is_editable_day(date) or (public.is_app_admin() and public.is_admin_override_day()))
  );

-- 2) Evidencia fotográfica: misma regla (se guarda/quita junto con el hábito)
drop policy if exists "evidencia hábitos: insertar la mía" on public.habit_evidence;
create policy "evidencia hábitos: insertar la mía" on public.habit_evidence
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_editable_day(date) or (public.is_app_admin() and public.is_admin_override_day()))
    and photo_path like auth.uid()::text || '/habitos/%'
  );

drop policy if exists "evidencia hábitos: borrar la mía" on public.habit_evidence;
create policy "evidencia hábitos: borrar la mía" on public.habit_evidence
  for delete to authenticated
  using (
    user_id = auth.uid()
    and (public.is_editable_day(date) or (public.is_app_admin() and public.is_admin_override_day()))
  );

-- 3) Bitácora automática: se registra solo cuando el día usado NO es hoy/ayer
--    (si fuera hoy/ayer no hizo falta el override, así que no se guarda nada)
create or replace function public.log_admin_habit_override()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.habit_checks;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  if not public.is_editable_day(v_row.date) then
    insert into public.admin_overrides_log (admin_id, date, habit_key, action)
    values (auth.uid(), v_row.date, v_row.habit_key, case when tg_op = 'DELETE' then 'borrar' else 'insertar' end);
  end if;
  return v_row;
end;
$$;

drop trigger if exists habit_checks_admin_override_log on public.habit_checks;
create trigger habit_checks_admin_override_log
  after insert or delete on public.habit_checks
  for each row execute function public.log_admin_habit_override();
