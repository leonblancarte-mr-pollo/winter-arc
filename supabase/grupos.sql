-- =====================================================================
-- WINTER ARC — GRUPOS (ranking y chat por grupo)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de todos los demás .sql (migracion, anuncios_chat,
-- evidencia_habitos, casino...). Se puede correr más de una vez.
--
-- Qué cambia:
--   * Tablas groups y group_members.
--   * El chat (messages) se separa por grupo con messages.group_id.
--   * Los anuncios automáticos (libro, medio maratón, cardio, evidencia)
--     se copian a TODOS los grupos del usuario que los genera.
--   * Grupo "WINTER ARC ORIGINAL" con todos los usuarios actuales y todos
--     los mensajes que ya existen.
-- Qué NO cambia: hábitos, puntos, vista leaderboard, evidencia, casino, ajedrez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ADMINS DE LA APP (quién puede crear grupos)
--    Se marca por user_id en una tabla; el correo solo se usa aquí para
--    encontrar el id. Nadie puede escribir en esta tabla desde la app.
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.app_admins (user_id)
select id from auth.users where lower(email) = 'leon.blancarte@gmail.com'
on conflict do nothing;

alter table public.app_admins enable row level security;

-- Cada quien puede ver solo si ÉL es admin (para mostrar "Crear grupo")
drop policy if exists "admins: ver el mío" on public.app_admins;
create policy "admins: ver el mío" on public.app_admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_app_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2) TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- ¿El usuario con sesión es miembro de este grupo?
-- security definer para que las políticas de group_members no se llamen a sí mismas.
create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 3) SEGURIDAD DE GRUPOS
--    Leer: solo los grupos (y miembros) de los grupos a los que perteneces.
--    Crear / unirse: solo con las funciones de abajo (no hay insert directo).
-- ---------------------------------------------------------------------
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "grupos: ver los míos" on public.groups;
create policy "grupos: ver los míos" on public.groups
  for select to authenticated using (public.is_group_member(id));

drop policy if exists "miembros: ver los de mis grupos" on public.group_members;
create policy "miembros: ver los de mis grupos" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

-- Salirse de un grupo (opcional; la app aún no tiene botón)
drop policy if exists "miembros: salirme" on public.group_members;
create policy "miembros: salirme" on public.group_members
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 4) CREAR GRUPO (solo admin). Código opcional; si no se da, se genera
--    uno de 6 caracteres sin letras confusas (sin 0/O/1/I/L).
--    El creador queda como miembro automáticamente.
-- ---------------------------------------------------------------------
create or replace function public.create_group(p_name text, p_code text default null)
returns public.groups
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text := upper(nullif(trim(coalesce(p_code, '')), ''));
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  if not public.is_app_admin() then
    raise exception 'Solo el admin puede crear grupos';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'El nombre debe tener entre 1 y 40 caracteres';
  end if;

  if v_code is null then
    loop
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
        into v_code
        from generate_series(1, 6);
      exit when not exists (select 1 from public.groups where code = v_code);
    end loop;
  elsif v_code !~ '^[A-Z0-9]{4,12}$' then
    raise exception 'El código debe tener de 4 a 12 letras o números';
  elsif exists (select 1 from public.groups where code = v_code) then
    raise exception 'Ese código ya existe';
  end if;

  insert into public.groups (name, code, created_by)
  values (trim(p_name), v_code, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid());
  return v_group;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) UNIRSE CON CÓDIGO (cualquier usuario). Si ya era miembro, no pasa nada.
-- ---------------------------------------------------------------------
create or replace function public.join_group(p_code text)
returns public.groups
language plpgsql
security definer set search_path = public
as $$
declare
  v_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  select * into v_group from public.groups where code = upper(trim(coalesce(p_code, '')));
  if v_group.id is null then
    raise exception 'Código no válido';
  end if;
  insert into public.group_members (group_id, user_id)
  values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return v_group;
end;
$$;

revoke all on function public.create_group(text, text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ---------------------------------------------------------------------
-- 6) MIGRACIÓN: grupo "WINTER ARC ORIGINAL" con TODOS los usuarios actuales
-- ---------------------------------------------------------------------
insert into public.groups (name, code, created_by)
select 'WINTER ARC ORIGINAL', 'WINTER',
       (select user_id from public.app_admins a join public.profiles p on p.id = a.user_id limit 1)
where not exists (select 1 from public.groups where name = 'WINTER ARC ORIGINAL');

insert into public.group_members (group_id, user_id)
select g.id, p.id
from public.groups g cross join public.profiles p
where g.name = 'WINTER ARC ORIGINAL'
on conflict (group_id, user_id) do nothing;

-- ---------------------------------------------------------------------
-- 7) CHAT POR GRUPO
-- ---------------------------------------------------------------------
alter table public.messages
  add column if not exists group_id uuid references public.groups (id) on delete cascade;

-- Todos los mensajes que ya existen pasan al grupo original
update public.messages
   set group_id = (select id from public.groups where name = 'WINTER ARC ORIGINAL')
 where group_id is null;

create index if not exists messages_group_idx on public.messages (group_id, created_at desc);

-- Antes de guardar un mensaje:
--  * Anuncio de sistema sin grupo (los triggers de libro, cardio y evidencia):
--    se copia a cada grupo del usuario y el original no se guarda.
--  * Mensaje normal sin grupo (versión vieja de la app abierta): va a su
--    primer grupo. Si no tiene grupos, se rechaza.
create or replace function public.messages_route_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.group_id is not null then
    return new;
  end if;

  if new.is_system then
    insert into public.messages (user_id, content, is_system, photo_path, created_at, group_id)
    select new.user_id, new.content, true, new.photo_path, new.created_at, gm.group_id
    from public.group_members gm
    where gm.user_id = new.user_id;
    return null;
  end if;

  select gm.group_id into new.group_id
  from public.group_members gm
  where gm.user_id = new.user_id
  order by gm.joined_at, gm.id
  limit 1;
  if new.group_id is null then
    raise exception 'Únete a un grupo para usar el chat';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_route_group_trigger on public.messages;
create trigger messages_route_group_trigger
  before insert on public.messages
  for each row execute function public.messages_route_group();

-- Ya no puede quedar ningún mensaje sin grupo
alter table public.messages alter column group_id set not null;

-- Leer y escribir: solo miembros del grupo
drop policy if exists "chat: leer" on public.messages;
create policy "chat: leer" on public.messages
  for select to authenticated using (public.is_group_member(group_id));

drop policy if exists "chat: escribir como yo" on public.messages;
create policy "chat: escribir como yo" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and is_system = false and public.is_group_member(group_id));
