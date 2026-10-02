-- =====================================================================
-- WINTER ARC — Evidencia fotográfica de hábitos + anuncio en el chat
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Requiere haber corrido antes migracion.sql y anuncios_chat.sql.
-- Se puede correr más de una vez sin problema.
--
-- No toca habit_checks ni la vista "leaderboard": los puntos siguen igual.
-- Las fotos viven en el bucket "evidencias" que ya existe, dentro de la
-- carpeta de cada usuario (<user_id>/habitos/...), así que las políticas
-- de Storage actuales ya cubren subir/ver/borrar. No hay que cambiarlas.
-- =====================================================================

-- 1) Qué foto corresponde a qué hábito de qué día
create table if not exists public.habit_evidence (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null check (date between '2026-10-01' and '2026-12-31'),
  habit_key text not null,
  photo_path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date, habit_key)
);

create index if not exists habit_evidence_user_idx on public.habit_evidence (user_id, date);

-- 2) Seguridad: cualquiera con sesión VE las fotos (salen en el chat y en los perfiles);
--    cada quien solo sube y borra las suyas
alter table public.habit_evidence enable row level security;

drop policy if exists "evidencia hábitos: leer" on public.habit_evidence;
create policy "evidencia hábitos: leer" on public.habit_evidence
  for select to authenticated using (true);

drop policy if exists "evidencia hábitos: insertar la mía" on public.habit_evidence;
create policy "evidencia hábitos: insertar la mía" on public.habit_evidence
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and date <= (now() at time zone 'America/Mexico_City')::date
    and photo_path like auth.uid()::text || '/habitos/%'
  );

drop policy if exists "evidencia hábitos: borrar la mía" on public.habit_evidence;
create policy "evidencia hábitos: borrar la mía" on public.habit_evidence
  for delete to authenticated using (user_id = auth.uid());

-- 3) Los mensajes de sistema pueden llevar una foto ("Ver foto" en el chat)
alter table public.messages add column if not exists photo_path text;

-- 4) Anuncio automático al guardar la evidencia (el trigger lo publica, nadie lo escribe a mano)
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

drop trigger if exists announce_habit_evidence_trigger on public.habit_evidence;
create trigger announce_habit_evidence_trigger
  after insert on public.habit_evidence
  for each row execute function public.announce_habit_evidence();
