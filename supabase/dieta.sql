-- =====================================================================
-- WINTER ARC — Hábito nuevo "Dieta" (10mo hábito): anuncio en el chat
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de evidencia_habitos.sql. Se puede correr más de una vez.
--
-- habit_checks NO necesita cambios: guarda el hábito por su key ("dieta")
-- y la vista leaderboard suma cualquier hábito marcado. Lo único que cambia
-- es el anuncio automático al guardar la foto de evidencia: se agrega
-- "dieta" a la lista. Los demás textos quedan exactamente igual.
-- (Con grupos.sql, el anuncio se copia solo a todos los grupos del usuario.)
-- =====================================================================

create or replace function public.announce_habit_evidence()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  nombre text;
  texto text;
begin
  -- Un solo anuncio por hábito y día, aunque se destache y se vuelva a subir
  if exists (
    select 1 from public.messages
    where is_system and user_id = new.user_id
      and photo_path like '%/habitos/' || new.date::text || '\_' || new.habit_key || '\_%'
  ) then
    return new;
  end if;

  select display_name into nombre from public.profiles where id = new.user_id;
  nombre := coalesce(nombre, 'Alguien');

  texto := case new.habit_key
    when 'gym'      then format('💪 %s fue al gym', nombre)
    when 'cardio'   then format('🏃 %s hizo cardio', nombre)
    when 'leer'     then format('📖 %s leyó hoy', nombre)
    when 'pasos'    then format('👣 %s cumplió sus 10,000 pasos', nombre)
    when 'pantalla' then format('📵 %s se mantuvo bajo 5 hrs de pantalla', nombre)
    when 'dieta'    then format('🥗 %s cuidó su dieta', nombre)
    else null
  end;
  if texto is null then
    return new;
  end if;

  insert into public.messages (user_id, content, is_system, photo_path)
  values (new.user_id, texto, true, new.photo_path);
  return new;
end;
$$;
