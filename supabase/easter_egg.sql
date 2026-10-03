-- =====================================================================
-- WINTER ARC — EASTER EGG de la ruleta (secreto, solo diversión entre amigos)
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Corre después de casino.sql y ajedrez_y_tragamonedas.sql. Se puede repetir.
--
-- Para QUITAR el easter egg: borra la función y la ruta
--   drop function if exists public.casino_easter_egg(uuid);
--   y elimina src/app/api/casino/easter-egg/ y los bloques "EASTER EGG"
--   de src/app/(app)/casino/ruleta/page.tsx
-- =====================================================================

-- 1) Permite el nuevo tipo de movimiento en el historial
alter table public.casino_transactions drop constraint if exists casino_transactions_type_check;
alter table public.casino_transactions add constraint casino_transactions_type_check
  check (type in ('bet', 'bet_win', 'buy_peseis', 'unlock_power', 'admin_grant', 'easter_egg'));

-- 2) Da 50 peseis SOLO si el saldo es exactamente 0. La condición va en el mismo UPDATE,
--    así que dos peticiones a la vez no pueden cobrar el bono dos veces.
create or replace function public.casino_easter_egg(p_user uuid)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
begin
  update public.casino_balance
     set balance = balance + 50, updated_at = now()
   where user_id = p_user and balance = 0
  returning balance into v_balance;
  if v_balance is null then
    raise exception 'no aplica';
  end if;
  insert into public.casino_transactions (user_id, type, amount, game, meta)
  values (p_user, 'easter_egg', 50, 'ruleta', null);
  return v_balance;
end;
$$;

-- Solo el servidor de la app (llave service_role) puede llamarla
revoke all on function public.casino_easter_egg(uuid) from public, anon, authenticated;
grant execute on function public.casino_easter_egg(uuid) to service_role;
