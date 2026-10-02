// Ruleta americana: 38 casilleros (0, 00 y 1-36).
// El "00" se representa internamente como 37.

export const DOUBLE_ZERO = 37;

// Orden real de los números alrededor de una rueda americana
export const WHEEL_ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  DOUBLE_ZERO, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
];

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = "green" | "red" | "black";

export function colorOf(n: number): PocketColor {
  if (n === 0 || n === DOUBLE_ZERO) return "green";
  return RED.has(n) ? "red" : "black";
}

export function labelOf(n: number) {
  return n === DOUBLE_ZERO ? "00" : String(n);
}

export type BetType = "straight" | "red" | "black" | "even" | "odd" | "low" | "high" | "dozen" | "column";

// value: número (straight, 0-37), docena (1-3) o columna (1-3)
export type RouletteBet = { type: BetType; value?: number; amount: number };

// Cuánto regresa la apuesta por cada peseis apostado si gana (incluye lo apostado)
export function payoutMultiplier(type: BetType) {
  if (type === "straight") return 36; // paga 35:1
  if (type === "dozen" || type === "column") return 3; // paga 2:1
  return 2; // rojo/negro, par/impar, 1-18/19-36 pagan 1:1
}

export function betWins(bet: Pick<RouletteBet, "type" | "value">, n: number): boolean {
  if (bet.type === "straight") return bet.value === n;
  // 0 y 00 pierden en todas las apuestas de afuera
  if (n === 0 || n === DOUBLE_ZERO) return false;
  switch (bet.type) {
    case "red":
      return colorOf(n) === "red";
    case "black":
      return colorOf(n) === "black";
    case "even":
      return n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "low":
      return n <= 18;
    case "high":
      return n >= 19;
    case "dozen":
      return Math.ceil(n / 12) === bet.value;
    case "column":
      return ((n - 1) % 3) + 1 === bet.value;
  }
  return false;
}

// Identificador único de cada casilla del tablero (para juntar apuestas en la misma casilla)
export function betKey(bet: Pick<RouletteBet, "type" | "value">) {
  return bet.value == null ? bet.type : `${bet.type}:${bet.value}`;
}

export function betLabel(bet: Pick<RouletteBet, "type" | "value">) {
  switch (bet.type) {
    case "straight":
      return `Número ${labelOf(bet.value!)}`;
    case "red":
      return "Rojo";
    case "black":
      return "Negro";
    case "even":
      return "Par";
    case "odd":
      return "Impar";
    case "low":
      return "1 a 18";
    case "high":
      return "19 a 36";
    case "dozen":
      return `${bet.value}ª docena`;
    case "column":
      return `Columna ${bet.value}`;
  }
}

// Revisa que una apuesta tenga forma válida (se usa en el servidor)
export function isValidBet(b: unknown): b is RouletteBet {
  if (!b || typeof b !== "object") return false;
  const { type, value, amount } = b as Record<string, unknown>;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000) return false;
  switch (type) {
    case "straight":
      return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= DOUBLE_ZERO;
    case "dozen":
    case "column":
      return value === 1 || value === 2 || value === 3;
    case "red":
    case "black":
    case "even":
    case "odd":
    case "low":
    case "high":
      return value == null;
  }
  return false;
}
