-- =====================================================================
-- WINTER ARC — Solo se pueden tachar/destachar hábitos de HOY y AYER
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de migracion.sql, habitos_personales.sql y evidencia_habitos.sql.
-- Se puede correr más de una vez.
--
-- No borra ni cambia ningún dato: solo cambia las reglas de quién puede
-- insertar/borrar de aquí en adelante. Lo ya marcado se queda igual.
-- Antes de ayer = solo lectura. Días futuros siguen bloqueados.
-- La misma regla vive en la app: isEditableDay() en src/lib/dates.ts
-- =====================================================================

-- ¿Este día todavía se puede editar? (hoy o ayer, hora de la Ciudad de México)
create or replace function public.is_editable_day(p_date date)
returns boolean
language sql stable
as $$
  select p_date between (now() at time zone 'America/Mexico_City')::date - 1
                    and (now() at time zone 'America/Mexico_City')::date;
$$;

-- 1) Hábitos oficiales (los que suman puntos)
drop policy if exists "hábitos: insertar los míos" on public.habit_checks;
create policy "hábitos: insertar los míos" on public.habit_checks
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_editable_day(date));

drop policy if exists "hábitos: borrar los míos" on public.habit_checks;
create policy "hábitos: borrar los míos" on public.habit_checks
  for delete to authenticated
  using (user_id = auth.uid() and public.is_editable_day(date));

-- 2) Evidencia fotográfica (se guarda/quita junto con el hábito)
drop policy if exists "evidencia hábitos: insertar la mía" on public.habit_evidence;
create policy "evidencia hábitos: insertar la mía" on public.habit_evidence
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_editable_day(date)
    and photo_path like auth.uid()::text || '/habitos/%'
  );

drop policy if exists "evidencia hábitos: borrar la mía" on public.habit_evidence;
create policy "evidencia hábitos: borrar la mía" on public.habit_evidence
  for delete to authenticated
  using (user_id = auth.uid() and public.is_editable_day(date));

-- 3) Hábitos personales (privados, sin puntos): misma regla
drop policy if exists "casillas personales: marcar las mías" on public.custom_habit_checks;
create policy "casillas personales: marcar las mías" on public.custom_habit_checks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_editable_day(date)
    and exists (select 1 from public.custom_habits h where h.id = custom_habit_id and h.user_id = auth.uid())
  );

drop policy if exists "casillas personales: borrar las mías" on public.custom_habit_checks;
create policy "casillas personales: borrar las mías" on public.custom_habit_checks
  for delete to authenticated
  using (user_id = auth.uid() and public.is_editable_day(date));
