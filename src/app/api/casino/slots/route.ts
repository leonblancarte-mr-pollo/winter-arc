// Tragamonedas: los 3 carretes y el pago se calculan AQUÍ en el servidor, nunca en el navegador.
import { evaluate, payoutFor, spinReel } from "@/lib/casino/slots";
import { handleError, HttpError, placeBet, requireUser, settleRound } from "@/lib/server/casino";

const MAX_BET = 1_000_000_000;
const SOURCE = "api/casino/slots";

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const body = (await req.json().catch(() => null)) as { bet?: unknown } | null;
    const bet = body?.bet;
    if (typeof bet !== "number" || !Number.isInteger(bet) || bet < 1 || bet > MAX_BET) {
      throw new HttpError(400, "Arma tu apuesta con las fichas antes de jalar la palanca.");
    }

    // 1) Cobra la apuesta y abre la ronda (falla si no alcanza el saldo)
    const { roundId } = await placeBet(db, userId, "tragamonedas", bet, SOURCE);

    // 2) Gira los 3 carretes con un generador aleatorio seguro
    const reels = [spinReel(), spinReel(), spinReel()];
    const outcome = evaluate(reels);
    const payout = payoutFor(bet, outcome);

    // 3) Paga si ganó (incluye lo apostado) y cierra la ronda
    const balance = await settleRound(db, userId, roundId, payout, SOURCE, { reels, kind: outcome.kind });

    return Response.json({ reels, kind: outcome.kind, multiplier: outcome.multiplier, bet, payout, net: payout - bet, balance });
  } catch (e) {
    return handleError(e);
  }
}
