// Tragamonedas: los 3 carretes y el pago se calculan AQUÍ en el servidor, nunca en el navegador.
import { evaluate, payoutFor, spinReel } from "@/lib/casino/slots";
import { applyBalance, handleError, HttpError, requireUser } from "@/lib/server/casino";

const MAX_BET = 1_000_000_000;

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const body = (await req.json().catch(() => null)) as { bet?: unknown } | null;
    const bet = body?.bet;
    if (typeof bet !== "number" || !Number.isInteger(bet) || bet < 1 || bet > MAX_BET) {
      throw new HttpError(400, "Arma tu apuesta con las fichas antes de jalar la palanca.");
    }

    // 1) Cobra la apuesta (falla si no alcanza el saldo)
    let balance = await applyBalance(db, userId, -bet, "bet", "tragamonedas");

    // 2) Gira los 3 carretes con un generador aleatorio seguro
    const reels = [spinReel(), spinReel(), spinReel()];
    const outcome = evaluate(reels);
    const payout = payoutFor(bet, outcome);

    // 3) Paga si ganó (incluye lo apostado)
    if (payout > 0) balance = await applyBalance(db, userId, payout, "bet_win", "tragamonedas", { reels, kind: outcome.kind });

    return Response.json({ reels, kind: outcome.kind, multiplier: outcome.multiplier, bet, payout, net: payout - bet, balance });
  } catch (e) {
    return handleError(e);
  }
}
