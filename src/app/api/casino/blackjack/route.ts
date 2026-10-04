// Blackjack: el mazo, la carta oculta del dealer y los pagos viven en el SERVIDOR.
// Acciones: "state" (ver mano en curso), "deal" (repartir), "hit", "stand", "double".
import type { SupabaseClient } from "@supabase/supabase-js";
import { handValue, isBlackjack, newDeck } from "@/lib/casino/blackjack";
import { dealHand, draw, settle, toPublic, type Hand, type Row } from "@/lib/casino/blackjackEngine";
import { shuffle } from "@/lib/casino/rng";
import { handleError, HttpError, placeBet, raiseBet, refundRound, requireUser, settleRound } from "@/lib/server/casino";

const MAX_BET = 1_000_000_000;
const SOURCE = "api/casino/blackjack";

// Lee (o crea) el mazo y la mano del usuario
async function load(db: SupabaseClient, userId: string): Promise<Row> {
  const { data, error } = await db.from("casino_blackjack").select("shoe,hand,version").eq("user_id", userId).maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      throw new HttpError(500, "Falta crear las tablas del casino: corre supabase/casino.sql en Supabase.");
    }
    throw new HttpError(500, `Error del casino: ${error.message}`);
  }
  if (data) return data as Row;
  const fresh: Row = { shoe: shuffle(newDeck()), hand: null, version: 0 };
  const { error: insErr } = await db.from("casino_blackjack").insert({ user_id: userId, shoe: fresh.shoe, hand: null, version: 0 });
  if (insErr && insErr.code !== "23505") throw new HttpError(500, `Error del casino: ${insErr.message}`);
  if (insErr) return load(db, userId); // otra petición lo creó al mismo tiempo
  return fresh;
}

// Guarda solo si nadie más cambió la mano mientras tanto (evita jugadas duplicadas)
async function save(db: SupabaseClient, userId: string, row: Row, expectedVersion: number) {
  const { data, error } = await db
    .from("casino_blackjack")
    .update({ shoe: row.shoe, hand: row.hand, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("version", expectedVersion)
    .select("version");
  if (error) throw new HttpError(500, `Error del casino: ${error.message}`);
  if (!data || data.length === 0) throw new HttpError(409, "Otra jugada se estaba procesando. Intenta de nuevo.");
  row.version = expectedVersion + 1;
}


async function currentBalance(db: SupabaseClient, userId: string) {
  const { data } = await db.from("casino_balance").select("balance").eq("user_id", userId).maybeSingle();
  return Number(data?.balance ?? 10000);
}

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { action?: string; bet?: unknown };
    const row = await load(db, userId);
    const v = row.version;
    let balance: number | null = null;

    // Ronda (apuesta ya cobrada) de la mano en curso. Sin ronda no hay pago posible.
    async function openRound(): Promise<number> {
      const roundId = row.hand?.roundId;
      if (roundId) return roundId;
      row.hand = null;
      await save(db, userId, row, v);
      throw new HttpError(409, "Esa mano era de una versión anterior del casino. Reparte una nueva.");
    }

    switch (body.action) {
      case "state":
        break;

      case "deal": {
        if (row.hand?.status === "player") throw new HttpError(409, "Termina la mano que tienes en curso.");
        const bet = body.bet;
        if (typeof bet !== "number" || !Number.isInteger(bet) || bet < 1 || bet > MAX_BET) {
          throw new HttpError(400, "Arma tu apuesta con las fichas antes de repartir.");
        }
        // 1) Cobra PRIMERO (falla si no alcanza). Así ninguna otra petición puede cobrar
        //    una mano cuya apuesta todavía no se pagó.
        const bet0 = await placeBet(db, userId, "blackjack", bet, SOURCE);
        balance = bet0.balance;

        // 2) Reparte y guarda; si otra petición ganó la carrera, regresa la apuesta
        dealHand(row, bet, bet0.roundId);
        try {
          await save(db, userId, row, v);
        } catch (e) {
          await refundRound(db, userId, bet0.roundId, SOURCE).catch(() => {});
          throw e;
        }

        // Blackjack natural de cualquiera: la mano termina de inmediato
        const dealt = row.hand!;
        if (isBlackjack(dealt.player) || isBlackjack(dealt.dealer)) {
          settle(row);
          await save(db, userId, row, row.version);
          balance = await settleRound(db, userId, bet0.roundId, dealt.payout ?? 0, SOURCE, { result: dealt.result });
        }
        break;
      }

      case "hit": {
        if (row.hand?.status !== "player") throw new HttpError(409, "No hay una mano en curso.");
        const roundId = await openRound();
        const hand = row.hand!;
        hand.player.push(draw(row));
        // Si se pasa de 21 pierde; si llega a 21 se planta solo
        if (handValue(hand.player).total >= 21) settle(row);
        await save(db, userId, row, v);
        // settle() puede haber terminado la mano (TypeScript no lo detecta solo)
        if ((hand.status as Hand["status"]) === "done") {
          balance = await settleRound(db, userId, roundId, hand.payout ?? 0, SOURCE, { result: hand.result });
        }
        break;
      }

      case "stand": {
        if (row.hand?.status !== "player") throw new HttpError(409, "No hay una mano en curso.");
        const roundId = await openRound();
        const hand = row.hand!;
        settle(row);
        await save(db, userId, row, v);
        balance = await settleRound(db, userId, roundId, hand.payout ?? 0, SOURCE, { result: hand.result });
        break;
      }

      case "double": {
        if (row.hand?.status !== "player") throw new HttpError(409, "No hay una mano en curso.");
        if (row.hand.player.length !== 2 || row.hand.doubled) throw new HttpError(400, "Solo puedes doblar con tus primeras 2 cartas.");
        const roundId = await openRound();
        const before: Row = structuredClone({ shoe: row.shoe, hand: row.hand, version: v });
        const hand = row.hand!;
        hand.bet *= 2;
        hand.doubled = true;
        hand.player.push(draw(row)); // al doblar recibe exactamente una carta más
        settle(row);
        // 1) Guarda la jugada (si llega otra petición igual, recibe 409 y no cobra nada)
        await save(db, userId, row, v);
        // 2) Cobra la segunda apuesta; si no alcanza, deshace la jugada
        try {
          await raiseBet(db, userId, roundId, before.hand!.bet, SOURCE);
        } catch (e) {
          await save(db, userId, before, row.version).catch(() => {});
          throw e;
        }
        // 3) Paga y cierra la ronda
        balance = await settleRound(db, userId, roundId, hand.payout ?? 0, SOURCE, { result: hand.result, double: true });
        break;
      }

      default:
        throw new HttpError(400, "Acción desconocida.");
    }

    return Response.json({
      hand: toPublic(row.hand),
      shoeLeft: row.shoe.length,
      balance: balance ?? (await currentBalance(db, userId)),
    });
  } catch (e) {
    return handleError(e);
  }
}
