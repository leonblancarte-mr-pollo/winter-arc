// Blackjack: cartas, valor de una mano y forma pública del estado del juego.
// Reglas: 1 baraja, el dealer se planta en 17 suave (S17), blackjack paga 3:2,
// doblar solo con las primeras 2 cartas, sin dividir (split) ni seguro en esta versión.

// Una carta es rango + palo, por ejemplo "AS" (As de picas) o "10H" (10 de corazones)
export type Card = string;

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["S", "H", "D", "C"];

export function newDeck(): Card[] {
  return SUITS.flatMap((s) => RANKS.map((r) => r + s));
}

export function rankOf(card: Card) {
  return card.slice(0, -1);
}
export function suitOf(card: Card) {
  return card.slice(-1);
}

function cardValue(card: Card) {
  const r = rankOf(card);
  if (r === "A") return 1;
  if (r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

// Valor de una mano. "soft" = hay un As contando como 11.
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (rankOf(c) === "A") aces++;
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}

export function isBlackjack(cards: Card[]) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export type BlackjackResult = "blackjack" | "win" | "push" | "lose" | "bust" | "dealer_blackjack";

// Lo que el servidor le manda al navegador (nunca incluye la carta oculta ni el mazo)
export type BlackjackPublicHand = {
  bet: number; // apuesta total (ya incluye el doble si dobló)
  player: Card[];
  dealer: (Card | null)[]; // null = carta boca abajo
  status: "player" | "done";
  canDouble: boolean;
  result?: BlackjackResult;
  payout?: number; // lo que regresó al saldo (incluye la apuesta si ganó/empató)
};

export const RESULT_TEXT: Record<BlackjackResult, string> = {
  blackjack: "Blackjack",
  win: "Ganaste",
  push: "Empate",
  lose: "Perdiste",
  bust: "Te pasaste",
  dealer_blackjack: "Blackjack del dealer",
};
