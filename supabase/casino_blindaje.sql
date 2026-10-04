-- =====================================================================
-- WINTER ARC — Blindaje del casino (2026-10-03)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de casino.sql, ajedrez_y_tragamonedas.sql y easter_egg.sql.
-- Se puede correr más de una vez. No borra saldos ni movimientos.
--
-- IMPORTANTE: córrelo y en seguida sube el código nuevo (git push).
-- Mientras tanto la versión vieja de la app no puede apostar (casino_apply ya no existe).
--
-- Qué cambia:
--   1) Cada apuesta abre una "ronda" (casino_rounds). El premio solo se puede pagar
--      contra una ronda abierta, una sola vez, y nunca más de apuesta × multiplicador
--      máximo del juego (ruleta 36, tragamonedas 250, blackjack 2.5). La función
--      genérica casino_apply (que sumaba cualquier monto) se elimina.
--   2) Comprar 5,000 peseis y el easter egg exigen estar "en quiebra de verdad":
--      saldo 0 Y sin una mano de blackjack (ni otra ronda reciente) abierta.
--   3) Límite de velocidad: máximo 12 apuestas por usuario cada 10 segundos.
--   4) Auditoría: cada movimiento guarda la ruta que lo hizo, la ronda y el saldo final,
--      y cualquier cambio de saldo (incluso hecho a mano) queda en casino_balance_audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) MOVIMIENTOS: nuevo tipo 'bet_refund' y columnas de auditoría
-- ---------------------------------------------------------------------
alter table public.casino_transactions drop constraint if exists casino_transactions_type_check;
alter table public.casino_transactions add constraint casino_transactions_type_check
  check (type in ('bet', 'bet_win', 'bet_refund', 'buy_peseis', 'unlock_power', 'admin_grant', 'easter_egg'));

alter table public.casino_transactions
  add column if not exists source text,          -- ruta o función que hizo el movimiento
  add column if not exists round_id bigint,      -- ronda de juego (apuestas y premios)
  add column if not exists balance_after bigint; -- saldo justo después del movimiento

-- ---------------------------------------------------------------------
-- 2) RONDAS DE JUEGO: una por apuesta (en blackjack, una por mano)
--    Privada: solo el servidor (service_role) la usa.
-- ---------------------------------------------------------------------
create table if not exists public.casino_rounds (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('ruleta', 'blackjack', 'tragamonedas')),
  stake bigint not null check (stake > 0),
  max_multiplier numeric not null check (max_multiplier > 0),
  raised boolean not null default false,   -- blackjack: ya dobló
  payout bigint check (payout is null or payout >= 0),
  status text not null default 'open' check (status in ('open', 'settled', 'refunded')),
  source text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists casino_rounds_user_created on public.casino_rounds (user_id, created_at desc);
create index if not exists casino_rounds_open on public.casino_rounds (user_id) where status = 'open';
alter table public.casino_rounds enable row level security;
-- Sin políticas: nadie la lee ni la escribe desde el navegador.

-- Multiplicador máximo que permite la lógica de cada juego (incluye lo apostado)
create or replace function public.casino_max_multiplier(p_game text)
returns numeric
language sql immutable
as $$
  select case p_game
    when 'ruleta' then 36         -- pleno paga 35:1
    when 'tragamonedas' then 250  -- 7️⃣7️⃣7️⃣
    when 'blackjack' then 2.5     -- blackjack natural paga 3:2
  end::numeric;
$$;

-- ---------------------------------------------------------------------
-- 3) AUDITORÍA DE SALDOS: cualquier cambio en casino_balance queda registrado,
--    venga de donde venga (funciones, servidor o SQL a mano).
-- ---------------------------------------------------------------------
create table if not exists public.casino_balance_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  old_balance bigint,
  new_balance bigint not null,
  delta bigint not null,
  db_role text not null default current_user,
  created_at timestamptz not null default now()
);
create index if not exists casino_balance_audit_user on public.casino_balance_audit (user_id, created_at desc);
alter table public.casino_balance_audit enable row level security;
-- Sin políticas: solo se consulta desde el SQL Editor de Supabase.

create or replace function public.casino_balance_audit_trigger()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.casino_balance_audit (user_id, old_balance, new_balance, delta)
    values (new.user_id, null, new.balance, new.balance);
  elsif new.balance is distinct from old.balance then
    insert into public.casino_balance_audit (user_id, old_balance, new_balance, delta)
    values (new.user_id, old.balance, new.balance, new.balance - old.balance);
  end if;
  return new;
end;
$$;

drop trigger if exists casino_balance_audit on public.casino_balance;
create trigger casino_balance_audit
  after insert or update on public.casino_balance
  for each row execute function public.casino_balance_audit_trigger();

-- ---------------------------------------------------------------------
-- 4) ¿EL USUARIO ESTÁ EN QUIEBRA DE VERDAD?
--    Saldo 0 y sin fichas en la mesa: ni mano de blackjack abierta (últimas 24 h)
--    ni otra ronda abierta en los últimos 5 minutos.
-- ---------------------------------------------------------------------
create or replace function public.casino_is_broke(p_user uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select balance from public.casino_balance where user_id = p_user), 0) = 0
     and not exists (
       select 1 from public.casino_rounds r
        where r.user_id = p_user and r.status = 'open'
          and ((r.game = 'blackjack' and r.created_at > now() - interval '24 hours')
               or r.created_at > now() - interval '5 minutes')
     );
$$;
revoke all on function public.casino_is_broke(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) APOSTAR: cobra la apuesta y abre una ronda. Regresa {round_id, balance}.
-- ---------------------------------------------------------------------
drop function if exists public.casino_apply(uuid, bigint, text, text, jsonb);

create or replace function public.casino_place_bet(
  p_user uuid, p_game text, p_stake bigint, p_source text, p_meta jsonb default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_mult numeric := public.casino_max_multiplier(p_game);
  v_balance bigint;
  v_round bigint;
begin
  if p_user is null then raise exception 'sin usuario'; end if;
  if v_mult is null then raise exception 'juego desconocido'; end if;
  if p_stake is null or p_stake < 1 or p_stake > 100000000000 then raise exception 'apuesta fuera de rango'; end if;

  -- Bloquea el saldo del usuario: sus apuestas se procesan una por una
  insert into public.casino_balance (user_id) values (p_user) on conflict do nothing;
  select balance into v_balance from public.casino_balance where user_id = p_user for update;

  -- Límite de velocidad (contra scripts que repiten la petición)
  if (select count(*) from public.casino_rounds
       where user_id = p_user and created_at > now() - interval '10 seconds') >= 12 then
    raise exception 'demasiado rápido';
  end if;

  if v_balance < p_stake then raise exception 'saldo insuficiente'; end if;

  update public.casino_balance set balance = balance - p_stake, updated_at = now()
   where user_id = p_user
  returning balance into v_balance;

  insert into public.casino_rounds (user_id, game, stake, max_multiplier, source)
  values (p_user, p_game, p_stake, v_mult, p_source)
  returning id into v_round;

  insert into public.casino_transactions (user_id, type, amount, game, meta, source, round_id, balance_after)
  values (p_user, 'bet', -p_stake, p_game, p_meta, p_source, v_round, v_balance);

  return jsonb_build_object('round_id', v_round, 'balance', v_balance);
end;
$$;

-- ---------------------------------------------------------------------
-- 6) DOBLAR (blackjack): cobra otra vez la apuesta original, una sola vez por mano
-- ---------------------------------------------------------------------
create or replace function public.casino_raise_bet(
  p_user uuid, p_round bigint, p_extra bigint, p_source text, p_meta jsonb default null
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  r public.casino_rounds%rowtype;
  v_balance bigint;
begin
  select * into r from public.casino_rounds where id = p_round for update;
  if not found or r.user_id is distinct from p_user or r.status <> 'open' then raise exception 'ronda inválida'; end if;
  if r.game <> 'blackjack' or r.raised or p_extra is distinct from r.stake then raise exception 'no se puede doblar'; end if;

  update public.casino_balance set balance = balance - p_extra, updated_at = now()
   where user_id = p_user and balance >= p_extra
  returning balance into v_balance;
  if v_balance is null then raise exception 'saldo insuficiente'; end if;

  update public.casino_rounds set stake = stake + p_extra, raised = true where id = p_round;
  insert into public.casino_transactions (user_id, type, amount, game, meta, source, round_id, balance_after)
  values (p_user, 'bet', -p_extra, r.game, coalesce(p_meta, '{}'::jsonb) || '{"double": true}', p_source, p_round, v_balance);
  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) PAGAR: cierra la ronda y paga el premio (0 si perdió). Una sola vez por ronda
--    y nunca más de apuesta × multiplicador máximo del juego.
-- ---------------------------------------------------------------------
create or replace function public.casino_settle(
  p_user uuid, p_round bigint, p_payout bigint, p_source text, p_meta jsonb default null
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  r public.casino_rounds%rowtype;
  v_balance bigint;
begin
  select * into r from public.casino_rounds where id = p_round for update;
  if not found or r.user_id is distinct from p_user or r.status <> 'open' then raise exception 'ronda inválida'; end if;
  if p_payout is null or p_payout < 0 or p_payout > floor(r.stake * r.max_multiplier) then
    raise exception 'premio fuera de rango';
  end if;

  update public.casino_rounds set status = 'settled', payout = p_payout, closed_at = now() where id = p_round;

  if p_payout > 0 then
    update public.casino_balance set balance = balance + p_payout, updated_at = now()
     where user_id = p_user
    returning balance into v_balance;
    insert into public.casino_transactions (user_id, type, amount, game, meta, source, round_id, balance_after)
    values (p_user, 'bet_win', p_payout, r.game, p_meta, p_source, p_round, v_balance);
  else
    select balance into v_balance from public.casino_balance where user_id = p_user;
  end if;
  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) DEVOLVER: si la jugada no se pudo guardar, regresa exactamente lo apostado
-- ---------------------------------------------------------------------
create or replace function public.casino_refund(p_user uuid, p_round bigint, p_source text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  r public.casino_rounds%rowtype;
  v_balance bigint;
begin
  select * into r from public.casino_rounds where id = p_round for update;
  if not found or r.user_id is distinct from p_user or r.status <> 'open' then raise exception 'ronda inválida'; end if;

  update public.casino_rounds set status = 'refunded', payout = r.stake, closed_at = now() where id = p_round;
  update public.casino_balance set balance = balance + r.stake, updated_at = now()
   where user_id = p_user
  returning balance into v_balance;
  insert into public.casino_transactions (user_id, type, amount, game, source, round_id, balance_after)
  values (p_user, 'bet_refund', r.stake, r.game, p_source, p_round, v_balance);
  return v_balance;
end;
$$;

-- Solo el servidor de la app (llave service_role) puede mover saldo de juegos
revoke all on function public.casino_place_bet(uuid, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.casino_raise_bet(uuid, bigint, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.casino_settle(uuid, bigint, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.casino_refund(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.casino_place_bet(uuid, text, bigint, text, jsonb) to service_role;
grant execute on function public.casino_raise_bet(uuid, bigint, bigint, text, jsonb) to service_role;
grant execute on function public.casino_settle(uuid, bigint, bigint, text, jsonb) to service_role;
grant execute on function public.casino_refund(uuid, bigint, text) to service_role;

-- ---------------------------------------------------------------------
-- 9) MANOS DE BLACKJACK QUE ESTABAN EN CURSO: se les abre su ronda (la apuesta
--    ya se cobró con la versión anterior) para que se puedan terminar y cobrar.
-- ---------------------------------------------------------------------
do $$
declare
  h record;
  v_round bigint;
begin
  for h in
    select user_id, (hand->>'bet')::bigint as bet
      from public.casino_blackjack
     where hand->>'status' = 'player' and hand->>'roundId' is null and (hand->>'bet')::bigint > 0
  loop
    insert into public.casino_rounds (user_id, game, stake, max_multiplier, raised, source)
    values (h.user_id, 'blackjack', h.bet, public.casino_max_multiplier('blackjack'), false, 'migracion:casino_blindaje')
    returning id into v_round;
    update public.casino_blackjack
       set hand = jsonb_set(hand, '{roundId}', to_jsonb(v_round)), version = version + 1, updated_at = now()
     where user_id = h.user_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 10) COMPRAR 5,000 PESEIS por 1 punto: ahora exige quiebra de verdad
--     (antes bastaba con saldo 0, aunque tuvieras toda tu apuesta en una mano de blackjack)
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
  -- El candado hace que dos compras al mismo tiempo se procesen una por una
  select balance into v_balance from public.casino_balance where user_id = v_user for update;
  if v_balance > 0 then raise exception 'solo puedes comprar cuando tu saldo es 0'; end if;
  if not public.casino_is_broke(v_user) then
    raise exception 'termina tu mano de blackjack antes de comprar peseis';
  end if;
  select total_points into v_points from public.leaderboard where user_id = v_user;
  if coalesce(v_points, 0) < 1 then raise exception 'no tienes puntos suficientes'; end if;

  update public.casino_balance set balance = balance + 5000, updated_at = now()
   where user_id = v_user
  returning balance into v_balance;
  insert into public.casino_transactions (user_id, type, amount, points_cost, source, balance_after)
  values (v_user, 'buy_peseis', 5000, 1, 'rpc:casino_buy_peseis', v_balance);
  return v_balance;
end;
$$;

revoke all on function public.casino_buy_peseis() from public, anon;
grant execute on function public.casino_buy_peseis() to authenticated;

-- ---------------------------------------------------------------------
-- 11) EASTER EGG: mismo bono de 50, pero también exige quiebra de verdad
-- ---------------------------------------------------------------------
create or replace function public.casino_easter_egg(p_user uuid)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
begin
  insert into public.casino_balance (user_id) values (p_user) on conflict do nothing;
  select balance into v_balance from public.casino_balance where user_id = p_user for update;
  if v_balance <> 0 or not public.casino_is_broke(p_user) then raise exception 'no aplica'; end if;

  update public.casino_balance set balance = balance + 50, updated_at = now()
   where user_id = p_user
  returning balance into v_balance;
  insert into public.casino_transactions (user_id, type, amount, game, source, balance_after)
  values (p_user, 'easter_egg', 50, 'ruleta', 'api/casino/easter-egg', v_balance);
  return v_balance;
end;
$$;

revoke all on function public.casino_easter_egg(uuid) from public, anon, authenticated;
grant execute on function public.casino_easter_egg(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 12) DESBLOQUEAR PODER: misma lógica, ahora con ruta y saldo final en el historial
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
  insert into public.casino_transactions (user_id, type, amount, meta, source, balance_after)
  values (v_user, 'unlock_power', -v_cost, jsonb_build_object('power', p_power), 'rpc:casino_unlock_power', v_balance);
  return v_balance;
end;
$$;

revoke all on function public.casino_unlock_power(text) from public, anon;
grant execute on function public.casino_unlock_power(text) to authenticated;
