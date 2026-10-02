-- =====================================================================
-- WINTER ARC — Ajedrez entre amigos + Tragamonedas
-- Pega TODO este archivo en Supabase > SQL Editor > New query > Run
-- Se corre UNA sola vez, después de casino.sql. No borra datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CASINO: permitir el juego "tragamonedas" y los regalos manuales de peseis
-- ---------------------------------------------------------------------
alter table public.casino_transactions drop constraint if exists casino_transactions_game_check;
alter table public.casino_transactions add constraint casino_transactions_game_check
  check (game is null or game in ('ruleta', 'blackjack', 'tragamonedas'));

alter table public.casino_transactions drop constraint if exists casino_transactions_type_check;
alter table public.casino_transactions add constraint casino_transactions_type_check
  check (type in ('bet', 'bet_win', 'buy_peseis', 'unlock_power', 'admin_grant'));

-- ---------------------------------------------------------------------
-- 2) INVITACIONES DE AJEDREZ
-- ---------------------------------------------------------------------
create table public.chess_invitations (
  id bigint generated always as identity primary key,
  from_user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  game_id uuid,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user_id <> to_user_id)
);
-- Solo una invitación pendiente a la vez entre las mismas dos personas (en ese sentido)
create unique index chess_invitations_one_pending
  on public.chess_invitations (from_user_id, to_user_id) where status = 'pending';
create index on public.chess_invitations (to_user_id, status);

-- ---------------------------------------------------------------------
-- 3) PARTIDAS DE AJEDREZ
--    fen = posición actual, pgn = historial de jugadas.
--    turn_deadline = hasta cuándo puede mover quien tiene el turno (24 horas).
-- ---------------------------------------------------------------------
create table public.chess_games (
  id uuid primary key default gen_random_uuid(),
  white_user_id uuid not null references public.profiles (id) on delete cascade,
  black_user_id uuid not null references public.profiles (id) on delete cascade,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  last_move text,
  status text not null default 'active'
    check (status in ('active', 'white_won', 'black_won', 'draw', 'abandoned')),
  end_reason text check (end_reason is null or end_reason in
    ('checkmate', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_moves', 'timeout')),
  turn_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (white_user_id <> black_user_id)
);
create index on public.chess_games (white_user_id, status);
create index on public.chess_games (black_user_id, status);

-- ---------------------------------------------------------------------
-- 4) SEGURIDAD (Row Level Security)
--    Cada invitación y cada partida solo la ven las 2 personas involucradas.
--    Las jugadas y aceptar invitaciones pasan por el servidor (no se escriben directo).
-- ---------------------------------------------------------------------
alter table public.chess_invitations enable row level security;
alter table public.chess_games       enable row level security;

create policy "ajedrez invitaciones: ver las mías" on public.chess_invitations
  for select to authenticated
  using (auth.uid() in (from_user_id, to_user_id));

create policy "ajedrez invitaciones: invitar" on public.chess_invitations
  for insert to authenticated
  with check (from_user_id = auth.uid() and status = 'pending' and game_id is null);

create policy "ajedrez invitaciones: cancelar la mía pendiente" on public.chess_invitations
  for delete to authenticated
  using (from_user_id = auth.uid() and status = 'pending');

create policy "ajedrez partidas: ver las mías" on public.chess_games
  for select to authenticated
  using (auth.uid() in (white_user_id, black_user_id));
-- Sin políticas de escritura en chess_games: solo el servidor (service_role) guarda jugadas.

-- ---------------------------------------------------------------------
-- 5) RELOJ DE 24 HORAS: marca como perdidas las partidas donde se acabó el tiempo.
--    La app la llama cada vez que alguien abre la pantalla de Ajedrez.
--    Pierde quien tenía el turno (la letra w/b del FEN dice a quién le toca).
-- ---------------------------------------------------------------------
create or replace function public.chess_expire_games()
returns int
language sql
security definer set search_path = public
as $$
  with expired as (
    update public.chess_games
       set status = case when split_part(fen, ' ', 2) = 'w' then 'black_won' else 'white_won' end,
           end_reason = 'timeout',
           turn_deadline = null,
           updated_at = now()
     where status = 'active' and turn_deadline < now()
    returning 1
  )
  select count(*)::int from expired;
$$;

revoke all on function public.chess_expire_games() from public, anon;
grant execute on function public.chess_expire_games() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) TIEMPO REAL: el tablero se actualiza solo cuando el otro mueve
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.chess_games;
alter publication supabase_realtime add table public.chess_invitations;
