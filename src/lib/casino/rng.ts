// Números aleatorios justos con crypto.getRandomValues (nunca Math.random).
// Funciona igual en el servidor (Node) y en el navegador.

// Entero aleatorio uniforme entre 0 y max-1, sin sesgo (descarta valores que lo causarían)
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new Error("rango inválido");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

// Revuelve un arreglo (Fisher-Yates) con el generador de arriba
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
