// Tragamonedas de 3 carretes. Cada carrete es independiente y cada símbolo tiene un "peso"
// (qué tan seguido sale). El resultado lo saca el SERVIDOR con crypto.getRandomValues.
//
// Tabla de pagos (lo que regresa, en veces tu apuesta, ya incluye lo apostado):
//   7️⃣7️⃣7️⃣ ×250 | 💎💎💎 ×75 | ⭐⭐⭐ ×25 | 🔔🔔🔔 ×14 | 🍇🍇🍇 ×9 | 🍋🍋🍋 ×7 | 🍒🍒🍒 ×5
//   Dos iguales (cualquier posición) ×1.5 (se redondea hacia abajo)
//   Nada: pierdes la apuesta
// Retorno al jugador ≈ 95.6% (la casa gana ≈ 4.4% a la larga, menos que la ruleta).
import { randomInt } from "./rng";

export const SLOT_SYMBOLS = [
  { id: "cherry", glyph: "🍒", weight: 8, three: 5 },
  { id: "lemon", glyph: "🍋", weight: 7, three: 7 },
  { id: "grape", glyph: "🍇", weight: 6, three: 9 },
  { id: "bell", glyph: "🔔", weight: 5, three: 14 },
  { id: "star", glyph: "⭐", weight: 4, three: 25 },
  { id: "diamond", glyph: "💎", weight: 2, three: 75 },
  { id: "seven", glyph: "7️⃣", weight: 1, three: 250 },
] as const;

export const PAIR_MULTIPLIER = 1.5;
const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((s, x) => s + x.weight, 0);

// Un carrete: símbolo al azar según su peso
export function spinReel(): number {
  let r = randomInt(TOTAL_WEIGHT);
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    r -= SLOT_SYMBOLS[i].weight;
    if (r < 0) return i;
  }
  return 0;
}

export type SlotOutcome = { kind: "three" | "pair" | "none"; symbol: number | null; multiplier: number };

// Qué se ganó con 3 símbolos (índices de SLOT_SYMBOLS)
export function evaluate(reels: number[]): SlotOutcome {
  const [a, b, c] = reels;
  if (a === b && b === c) return { kind: "three", symbol: a, multiplier: SLOT_SYMBOLS[a].three };
  if (a === b || a === c) return { kind: "pair", symbol: a, multiplier: PAIR_MULTIPLIER };
  if (b === c) return { kind: "pair", symbol: b, multiplier: PAIR_MULTIPLIER };
  return { kind: "none", symbol: null, multiplier: 0 };
}

// Cuánto regresa una apuesta (incluye lo apostado), redondeado hacia abajo
export function payoutFor(bet: number, outcome: SlotOutcome) {
  return Math.floor(bet * outcome.multiplier);
}

// Retorno teórico exacto al jugador (para la prueba y para mostrarlo en pantalla)
export function theoreticalReturn() {
  let rtp = 0;
  for (const s of SLOT_SYMBOLS) {
    const p = s.weight / TOTAL_WEIGHT;
    rtp += p ** 3 * s.three + 3 * p ** 2 * (1 - p) * PAIR_MULTIPLIER;
  }
  return rtp;
}
