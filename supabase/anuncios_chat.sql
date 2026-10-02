-- =====================================================================
-- WINTER ARC — Anuncios automáticos en el chat
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Se puede correr más de una vez sin problema.
--
-- Cuando alguien registra un libro, el medio maratón o una actividad de
-- cardio "grande", la base de datos publica sola un mensaje de sistema en
-- el chat (messages.is_system = true). Lo hace un trigger en el mismo
-- instante en que se guarda el registro, así que nadie puede escribirlos
-- a mano ni falsificarlos.
-- =====================================================================

-- 1) Marca de mensaje de sistema
alter table public.messages
  add column if not exists is_system boolean not null default false;

create index if not exists messages_system_idx on public.messages (created_at desc) where is_system;

-- 2) Los usuarios solo pueden escribir mensajes normales
--    (los de sistema solo los insertan los triggers de abajo, que corren con permisos de dueño)
drop policy if exists "chat: escribir como yo" on public.messages;
create policy "chat: escribir como yo" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and is_system = false);

-- 3) Libro terminado y medio maratón
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
  else
    return new;
  end if;

  insert into public.messages (user_id, content, is_system) values (new.user_id, texto, true);
  return new;
end;
$$;

drop trigger if exists announce_bonus_trigger on public.bonus_events;
create trigger announce_bonus_trigger
  after insert on public.bonus_events
  for each row execute function public.announce_bonus();

-- 4) Cardio (running / bici / natación) de más de 3 km o más de 20 min.
--    Las caminatas y "otro" no se anuncian, para no llenar el chat.
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

drop trigger if exists announce_activity_trigger on public.activities;
create trigger announce_activity_trigger
  after insert on public.activities
  for each row execute function public.announce_activity();
