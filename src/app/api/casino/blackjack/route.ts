// Blackjack: el mazo, la carta oculta del dealer y los pagos viven en el SERVIDOR.
// Acciones: "state" (ver mano en curso), "deal" (repartir), "hit", "stand", "double".
import type { SupabaseClient } from "@supabase/supabase-js";
import { handValue, isBlackjack, newDeck } from "@/lib/casino/blackjack";
import { dealHand, draw, settle, toPublic, type Hand, type Row } from "@/lib/casino/blackjackEngine";
import { shuffle } from "@/lib/casino/rng";
import { applyBalance, handleError, HttpError, requireUser } from "@/lib/server/casino";

const MAX_BET = 1_000_000_000;

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

    switch (body.action) {
      case "state":
        break;

      case "deal": {
        if (row.hand?.status === "player") throw new HttpError(409, "Termina la mano que tienes en curso.");
        const bet = body.bet;
        if (typeof bet !== "number" || !Number.isInteger(bet) || bet < 1 || bet > MAX_BET) {
          throw new HttpError(400, "Arma tu apuesta con las fichas antes de repartir.");
        }
        if ((await currentBalance(db, userId)) < bet) throw new HttpError(400, "No tienes peseis suficientes para esa apuesta.");
        const before: Row = { shoe: [...row.shoe], hand: row.hand, version: v };

        dealHand(row, bet);
        await save(db, userId, row, v);

        try {
          balance = await applyBalance(db, userId, -bet, "bet", "blackjack");
        } catch (e) {
          await save(db, userId, before, row.version).catch(() => {}); // deshace la mano si no alcanzó el saldo
          throw e;
        }

        // Blackjack natural de cualquiera: la mano termina de inmediato
        const dealt = row.hand!;
        if (isBlackjack(dealt.player) || isBlackjack(dealt.dealer)) {
          settle(row);
          await save(db, userId, row, row.version);
          if (dealt.payout) balance = await applyBalance(db, userId, dealt.payout, "bet_win", "blackjack", { result: dealt.result });
        }
        break;
      }

      case "hit": {
        if (row.hand?.status !== "player") throw new HttpError(409, "No hay una mano en curso.");
        row.hand.player.push(draw(row));
        // Si se pasa de 21 pierde; si llega a 21 se planta solo
        if (handValue(row.hand.player).total >= 21) settle(row);
        await save(db, userId, row, v);
        // settle() puede haber terminado la mano (TypeScript no lo detecta solo)
        const finished = (row.hand.status as Hand["status"]) === "done";
        if (finished && row.hand.payout) {
          balance = await applyBalance(db, userId, row.hand.payout, "bet_win", "blackjack", { result: row.hand.result });
        }
        break;
      }

      case "stand": {
        if (row.hand?.status !== "player") throw new HttpError(409, "No hay una mano en curso.");
        settle(row);
        await save(db, userId, row, v);
        if (row.hand.payout) balance = await applyBalance(db, userId, row.hand.payout, "bet_win", "blackjack", { result: row.hand.result });
        break;
      }

      case "double": {
        const hand = row.hand;
        if (hand?.status !== "player") throw new HttpError(409, "No hay una mano en curso.");
        if (hand.player.length !== 2 || hand.doubled) throw new HttpError(400, "Solo puedes doblar con tus primeras 2 cartas.");
        // Cobra la segunda apuesta primero (falla si no alcanza)
        balance = await applyBalance(db, userId, -hand.bet, "bet", "blackjack", { double: true });
        hand.bet *= 2;
        hand.doubled = true;
        hand.player.push(draw(row)); // al doblar recibe exactamente una carta más
        settle(row);
        try {
          await save(db, userId, row, v);
        } catch (e) {
          await applyBalance(db, userId, hand.bet / 2, "bet_win", "blackjack", { refund: true }).catch(() => {});
          throw e;
        }
        if (hand.payout) balance = await applyBalance(db, userId, hand.payout, "bet_win", "blackjack", { result: hand.result });
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
