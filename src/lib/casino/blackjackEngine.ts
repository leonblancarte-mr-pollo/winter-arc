// Motor del Blackjack (sin base de datos): repartir, turno del dealer y pagos.
// Lo usa la ruta del servidor /api/casino/blackjack; está separado para poder probarlo solo.
import { handValue, isBlackjack, newDeck, type BlackjackPublicHand, type BlackjackResult, type Card } from "./blackjack";
import { shuffle } from "./rng";

export type Hand = {
  bet: number;
  player: Card[];
  dealer: Card[];
  doubled: boolean;
  status: "player" | "done";
  result?: BlackjackResult;
  payout?: number;
  roundId?: number; // ronda en casino_rounds (la apuesta cobrada); nunca se manda al navegador
};
export type Row = { shoe: Card[]; hand: Hand | null; version: number };

// Saca una carta del mazo. Si se acaba, se arma una baraja nueva revuelta
// (sin las cartas que ya están en la mesa) y se sigue repartiendo.
export function draw(row: Row): Card {
  if (row.shoe.length === 0) {
    const onTable = new Set([...(row.hand?.player ?? []), ...(row.hand?.dealer ?? [])]);
    row.shoe = shuffle(newDeck().filter((c) => !onTable.has(c)));
  }
  return row.shoe.pop()!;
}

// Reparte una mano nueva en el orden real: jugador, dealer (arriba), jugador, dealer (abajo)
export function dealHand(row: Row, bet: number, roundId?: number) {
  row.hand = { bet, player: [], dealer: [], doubled: false, status: "player", roundId };
  row.hand.player.push(draw(row));
  row.hand.dealer.push(draw(row));
  row.hand.player.push(draw(row));
  row.hand.dealer.push(draw(row));
}

// El dealer pide hasta llegar a 17; se planta en CUALQUIER 17, incluso suave (As+6)
export function dealerPlays(row: Row) {
  const hand = row.hand!;
  while (handValue(hand.dealer).total < 17) hand.dealer.push(draw(row));
}

// Decide el resultado y cuánto se paga (incluye la apuesta si ganó o empató)
export function settle(row: Row) {
  const hand = row.hand!;
  const p = handValue(hand.player).total;
  const playerBJ = isBlackjack(hand.player) && !hand.doubled;
  const dealerBJ = isBlackjack(hand.dealer);
  let result: BlackjackResult;
  let payout = 0;
  if (p > 21) {
    result = "bust";
  } else if (playerBJ && dealerBJ) {
    result = "push";
    payout = hand.bet;
  } else if (playerBJ) {
    result = "blackjack";
    payout = hand.bet + Math.floor((hand.bet * 3) / 2); // paga 3:2 (se redondea hacia abajo)
  } else if (dealerBJ) {
    result = "dealer_blackjack";
  } else {
    dealerPlays(row);
    const d = handValue(hand.dealer).total;
    if (d > 21 || p > d) {
      result = "win";
      payout = hand.bet * 2;
    } else if (p === d) {
      result = "push";
      payout = hand.bet;
    } else {
      result = "lose";
    }
  }
  hand.status = "done";
  hand.result = result;
  hand.payout = payout;
}

// Lo que se le manda al navegador: nunca la carta oculta del dealer ni el mazo
export function toPublic(hand: Hand | null): BlackjackPublicHand | null {
  if (!hand) return null;
  const hidden = hand.status === "player";
  return {
    bet: hand.bet,
    player: hand.player,
    dealer: hidden ? [hand.dealer[0], null] : hand.dealer,
    status: hand.status,
    canDouble: hidden && hand.player.length === 2 && !hand.doubled,
    result: hand.result,
    payout: hand.payout,
  };
}
