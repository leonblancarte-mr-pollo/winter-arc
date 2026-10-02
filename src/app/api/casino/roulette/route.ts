// Ruleta: el giro y el pago se calculan AQUÍ en el servidor, nunca en el navegador.
import { randomInt } from "@/lib/casino/rng";
import { betWins, isValidBet, payoutMultiplier, WHEEL_ORDER, type RouletteBet } from "@/lib/casino/roulette";
import { applyBalance, handleError, HttpError, requireUser } from "@/lib/server/casino";

const MAX_BETS = 60;

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const body = (await req.json().catch(() => null)) as { bets?: unknown } | null;
    const bets = body?.bets;
    if (!Array.isArray(bets) || bets.length === 0) throw new HttpError(400, "Pon al menos una apuesta en el tablero.");
    if (bets.length > MAX_BETS) throw new HttpError(400, "Demasiadas apuestas en un solo giro.");
    if (!bets.every(isValidBet)) throw new HttpError(400, "Alguna apuesta no es válida.");
    const valid = bets as RouletteBet[];
    const stake = valid.reduce((s, b) => s + b.amount, 0);

    // 1) Cobra la apuesta (falla si no alcanza el saldo)
    await applyBalance(db, userId, -stake, "bet", "ruleta", { bets: valid });

    // 2) Gira: número aleatorio justo entre los 38 casilleros
    const result = WHEEL_ORDER[randomInt(WHEEL_ORDER.length)];

    // 3) Paga lo que haya ganado (incluye lo apostado en las apuestas ganadoras)
    const payout = valid.filter((b) => betWins(b, result)).reduce((s, b) => s + b.amount * payoutMultiplier(b.type), 0);
    let balance: number;
    if (payout > 0) {
      balance = await applyBalance(db, userId, payout, "bet_win", "ruleta", { result, stake });
    } else {
      const { data } = await db.from("casino_balance").select("balance").eq("user_id", userId).single();
      balance = Number(data?.balance ?? 0);
    }

    return Response.json({ result, stake, payout, net: payout - stake, balance });
  } catch (e) {
    return handleError(e);
  }
}
