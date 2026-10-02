-- =====================================================================
-- WINTER ARC — Casino (peseis), poderes y avatar "burro"
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- Se corre UNA sola vez, después de migracion.sql. No borra datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PERFILES: campo para el avatar de "burro" (lo pone el poder de 100,000)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_override text
  check (avatar_override is null or avatar_override in ('burro'));

-- Cada quien puede seguir cambiando SU nombre, pero NO puede quitarse el burro.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2) SALDO DE PESEIS (uno por usuario, arranca en 10,000)
--    Nadie lo puede modificar desde el navegador: solo el servidor.
-- ---------------------------------------------------------------------
create table public.casino_balance (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance bigint not null default 10000 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) HISTORIAL DE MOVIMIENTOS (para auditar)
--    bet          = apuesta que sale de tu saldo (negativo)
--    bet_win      = lo que te regresa una apuesta ganada o empatada (positivo)
--    buy_peseis   = compra de 5,000 peseis por 1 punto de hábitos
--    unlock_power = desbloqueo de un poder (negativo)
-- ---------------------------------------------------------------------
create table public.casino_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('bet', 'bet_win', 'buy_peseis', 'unlock_power')),
  amount bigint not null,
  game text check (game is null or game in ('ruleta', 'blackjack')),
  points_cost int not null default 0 check (points_cost >= 0),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index on public.casino_transactions (user_id, created_at desc);
create index on public.casino_transactions (type) where type = 'buy_peseis';

-- ---------------------------------------------------------------------
-- 4) BLACKJACK: mazo y mano en curso de cada usuario
--    Privado: ni siquiera el dueño lo puede leer (para que no vea la carta oculta).
-- ---------------------------------------------------------------------
create table public.casino_blackjack (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  shoe jsonb not null default '[]'::jsonb,
  hand jsonb,
  version int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) PODERES: desbloqueos permanentes y registro de cada uso
-- ---------------------------------------------------------------------
create table public.power_unlocks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  power_type text not null check (power_type in ('rename', 'burro')),
  created_at timestamptz not null default now(),
  primary key (user_id, power_type)
);

create table public.power_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  power_type text not null check (power_type in ('rename', 'burro')),
  detail text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6) SEGURIDAD (Row Level Security)
--    Todos pueden LEER saldos, movimientos y poderes (transparencia).
--    Nadie puede ESCRIBIR directo: solo las funciones de abajo y el servidor.
-- ---------------------------------------------------------------------
alter table public.casino_balance      enable row level security;
alter table public.casino_transactions enable row level security;
alter table public.casino_blackjack    enable row level security;
alter table public.power_unlocks       enable row level security;
alter table public.power_log           enable row level security;

create policy "casino saldo: leer" on public.casino_balance
  for select to authenticated using (true);
create policy "casino movimientos: leer" on public.casino_transactions
  for select to authenticated using (true);
create policy "poderes: leer" on public.power_unlocks
  for select to authenticated using (true);
create policy "poderes log: leer" on public.power_log
  for select to authenticated using (true);
-- casino_blackjack no tiene políticas: solo el servidor (service_role) lo usa.

-- ---------------------------------------------------------------------
-- 7) SALDO INICIAL: 10,000 peseis a cada cuenta nueva y a las que ya existen
-- ---------------------------------------------------------------------
create or replace function public.handle_new_profile_casino()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.casino_balance (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_profile_created_casino
  after insert on public.profiles
  for each row execute function public.handle_new_profile_casino();

insert into public.casino_balance (user_id)
select id from public.profiles
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 8) MOVER SALDO (solo la usa el servidor de la app con la llave service_role)
--    Suma/resta de forma atómica, nunca deja el saldo en negativo y registra el movimiento.
-- ---------------------------------------------------------------------
create or replace function public.casino_apply(
  p_user uuid, p_delta bigint, p_type text, p_game text, p_meta jsonb default null
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
begin
  insert into public.casino_balance (user_id) values (p_user) on conflict do nothing;
  update public.casino_balance
     set balance = balance + p_delta, updated_at = now()
   where user_id = p_user and balance + p_delta >= 0
  returning balance into v_balance;
  if v_balance is null then
    raise exception 'saldo insuficiente';
  end if;
  insert into public.casino_transactions (user_id, type, amount, game, meta)
  values (p_user, p_type, p_delta, p_game, p_meta);
  return v_balance;
end;
$$;

revoke all on function public.casino_apply(uuid, bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.casino_apply(uuid, bigint, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 9) RANKING: ahora resta los puntos gastados en comprar peseis
--    y expone el avatar de burro. (Mismas columnas de antes + 2 nuevas al final)
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
),
gastados as (
  select user_id, sum(points_cost)::int as pts
  from public.casino_transactions
  where type = 'buy_peseis'
  group by user_id
)
select
  p.id as user_id,
  p.display_name,
  coalesce(h.pts, 0) as habit_points,
  coalesce(b.pts, 0) as bonus_points,
  coalesce(s.pts, 0) as weekly_bonus_points,
  coalesce(h.pts, 0) + coalesce(b.pts, 0) + coalesce(s.pts, 0) - coalesce(g.pts, 0) as total_points,
  coalesce(g.pts, 0) as spent_points,
  p.avatar_override
from public.profiles p
left join habitos  h on h.user_id = p.id
left join bonus    b on b.user_id = p.id
left join semanal  s on s.user_id = p.id
left join gastados g on g.user_id = p.id;

grant select on public.leaderboard to authenticated;

-- ---------------------------------------------------------------------
-- 10) COMPRAR 5,000 PESEIS por 1 punto de hábitos (solo con saldo en 0)
-- ---------------------------------------------------------------------
create or replace function public.casino_buy_peseis()
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance bigint;
  v_points int;
begin
  if v_user is null then raise exception 'sin sesión'; end if;
  insert into public.casino_balance (user_id) values (v_user) on conflict do nothing;
  select balance into v_balance from public.casino_balance where user_id = v_user for update;
  if v_balance > 0 then raise exception 'solo puedes comprar cuando tu saldo es 0'; end if;
  select total_points into v_points from public.leaderboard where user_id = v_user;
  if coalesce(v_points, 0) < 1 then raise exception 'no tienes puntos suficientes'; end if;

  insert into public.casino_transactions (user_id, type, amount, points_cost)
  values (v_user, 'buy_peseis', 5000, 1);
  update public.casino_balance set balance = balance + 5000, updated_at = now()
   where user_id = v_user
  returning balance into v_balance;
  return v_balance;
end;
$$;

revoke all on function public.casino_buy_peseis() from public, anon;
grant execute on function public.casino_buy_peseis() to authenticated;

-- ---------------------------------------------------------------------
-- 11) DESBLOQUEAR UN PODER (se paga con peseis, una sola vez, para siempre)
--     rename = 50,000 peseis   |   burro = 100,000 peseis
-- ---------------------------------------------------------------------
create or replace function public.casino_unlock_power(p_power text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cost bigint;
  v_balance bigint;
begin
  if v_user is null then raise exception 'sin sesión'; end if;
  v_cost := case p_power when 'rename' then 50000 when 'burro' then 100000 end;
  if v_cost is null then raise exception 'poder desconocido'; end if;
  if exists (select 1 from public.power_unlocks where user_id = v_user and power_type = p_power) then
    raise exception 'ya tienes este poder';
  end if;

  update public.casino_balance
     set balance = balance - v_cost, updated_at = now()
   where user_id = v_user and balance >= v_cost
  returning balance into v_balance;
  if v_balance is null then raise exception 'saldo insuficiente'; end if;

  insert into public.power_unlocks (user_id, power_type) values (v_user, p_power);
  insert into public.casino_transactions (user_id, type, amount, meta)
  values (v_user, 'unlock_power', -v_cost, jsonb_build_object('power', p_power));
  return v_balance;
end;
$$;

revoke all on function public.casino_unlock_power(text) from public, anon;
grant execute on function public.casino_unlock_power(text) to authenticated;

-- ---------------------------------------------------------------------
-- 12) USAR PODERES sobre OTRO usuario (queda registrado en power_log)
-- ---------------------------------------------------------------------
create or replace function public.power_rename_user(p_target uuid, p_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_user is null then raise exception 'sin sesión'; end if;
  if not exists (select 1 from public.power_unlocks where user_id = v_user and power_type = 'rename') then
    raise exception 'no tienes este poder';
  end if;
  if p_target = v_user then raise exception 'el poder es para usarlo en otro usuario'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 30 then
    raise exception 'el nombre debe tener entre 1 y 30 caracteres';
  end if;
  update public.profiles set display_name = v_name where id = p_target;
  if not found then raise exception 'ese usuario no existe'; end if;
  insert into public.power_log (user_id, target_user_id, power_type, detail)
  values (v_user, p_target, 'rename', v_name);
end;
$$;

create or replace function public.power_burro_user(p_target uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'sin sesión'; end if;
  if not exists (select 1 from public.power_unlocks where user_id = v_user and power_type = 'burro') then
    raise exception 'no tienes este poder';
  end if;
  if p_target = v_user then raise exception 'el poder es para usarlo en otro usuario'; end if;
  update public.profiles set avatar_override = 'burro' where id = p_target;
  if not found then raise exception 'ese usuario no existe'; end if;
  insert into public.power_log (user_id, target_user_id, power_type)
  values (v_user, p_target, 'burro');
end;
$$;

revoke all on function public.power_rename_user(uuid, text) from public, anon;
revoke all on function public.power_burro_user(uuid) from public, anon;
grant execute on function public.power_rename_user(uuid, text) to authenticated;
grant execute on function public.power_burro_user(uuid) to authenticated;
