-- =====================================================================
-- WINTER ARC — Kevincito: quitar el parche de +17, borrar sus compras de
-- peseis y bloquearle comprar peseis con puntos de hábitos.
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de casino_blindaje.sql y ajustes_puntos.sql. Se puede
-- correr más de una vez.
--
-- Usuario: b1c3ff4c-9a4b-4352-be68-cccef4ad7db2 (Kevincito tontito cabezoncito)
--
-- 1) Borra su ajuste de +17 ("ajuste: reembolso comprar peseis").
-- 2) Borra TODAS sus transacciones buy_peseis: la vista leaderboard y las
--    gráficas dejan de restarle puntos, como si nunca hubiera comprado.
--    OJO: NO toca su saldo de peseis; se queda con los que ya tiene.
-- 3) casino_buy_peseis() rechaza a ese usuario (y solo a ese) con un mensaje
--    fijo. Jugar, apostar y los poderes siguen igual para él.
-- =====================================================================

-- 1) y 2) Limpieza de datos, en una sola transacción
begin;

delete from public.bonus_events
 where user_id = 'b1c3ff4c-9a4b-4352-be68-cccef4ad7db2'
   and type = 'adjustment'
   and label = 'ajuste: reembolso comprar peseis';

delete from public.casino_transactions
 where user_id = 'b1c3ff4c-9a4b-4352-be68-cccef4ad7db2'
   and type = 'buy_peseis';

commit;

-- 3) Comprar peseis: igual que en casino_blindaje.sql, con el bloqueo al inicio
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
  -- Kevincito no puede gastar puntos de hábitos en el casino
  if v_user = 'b1c3ff4c-9a4b-4352-be68-cccef4ad7db2'::uuid then
    raise exception 'No puedes gastar tus puntos de hábitos en el casino, eres un pobre pendejo Kevin';
  end if;
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

-- Verificación: debe dar habit_points 22, bonus_points 0, spent_points 0, total_points 22
select display_name, habit_points, bonus_points, weekly_bonus_points, spent_points, total_points
  from public.leaderboard
 where user_id = 'b1c3ff4c-9a4b-4352-be68-cccef4ad7db2';
