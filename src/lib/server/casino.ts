// Utilidades del SERVIDOR para el casino. Nunca se importa desde el navegador:
// "server-only" hace que la compilación falle si alguien lo intenta.
// Usa la llave secreta service_role (variable SUPABASE_SERVICE_ROLE_KEY, sin NEXT_PUBLIC).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Revisa que la llave sea la SECRETA (service_role) y no la pública (anon / publishable).
// Con la pública, Supabase aplica RLS y responde "permission denied" o "violates row-level security".
function keyProblem(key: string): string | null {
  if (key.startsWith("sb_secret_")) return null;
  if (key.startsWith("sb_publishable_")) return "es la Publishable key (pública)";
  try {
    const role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role;
    if (role === "service_role") return null;
    return role ? `es la llave "${role}" (pública)` : "no parece una llave de Supabase";
  } catch {
    return "no parece una llave de Supabase";
  }
}

function getAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new HttpError(500, "El casino no está configurado: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  const problem = keyProblem(key);
  if (problem) {
    throw new HttpError(
      500,
      `La llave SUPABASE_SERVICE_ROLE_KEY ${problem}. Pon la service_role / Secret key de Supabase en Vercel y vuelve a desplegar.`,
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

// Revisa quién hace la petición (token de sesión en el encabezado Authorization)
export async function requireUser(req: Request): Promise<{ userId: string; db: SupabaseClient }> {
  const db = getAdmin();
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
  return { userId: data.user.id, db };
}

export type Game = "ruleta" | "blackjack" | "tragamonedas";

// Llama una función SQL del casino y traduce sus errores a mensajes claros.
// El saldo SOLO se mueve con estas funciones: cada apuesta abre una ronda y el premio
// solo se paga contra esa ronda, una vez, y con un tope de apuesta × multiplicador del juego.
async function casinoRpc(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    const m = error.message;
    if (m.includes("saldo insuficiente")) throw new HttpError(400, "No tienes peseis suficientes para esa apuesta.");
    if (m.includes("demasiado rápido")) throw new HttpError(429, "Vas muy rápido. Espera unos segundos.");
    if (m.includes("apuesta fuera de rango")) throw new HttpError(400, "Esa apuesta no es válida.");
    if (m.includes("ronda inválida") || m.includes("no se puede doblar")) throw new HttpError(409, "Esa jugada ya se procesó.");
    if (m.includes("premio fuera de rango")) {
      console.error("[casino] premio fuera de rango", args);
      throw new HttpError(500, "Ocurrió un error inesperado en el casino.");
    }
    if (m.includes("does not exist") || error.code === "PGRST202" || m.includes("check constraint")) {
      throw new HttpError(500, "Falta actualizar el casino: corre supabase/casino_blindaje.sql en Supabase.");
    }
    throw new HttpError(500, `Error del casino: ${m}`);
  }
  return data;
}

// Cobra la apuesta y abre una ronda. Falla si no alcanza el saldo.
export async function placeBet(
  db: SupabaseClient,
  userId: string,
  game: Game,
  stake: number,
  source: string,
  meta?: Record<string, unknown>,
): Promise<{ roundId: number; balance: number }> {
  const data = (await casinoRpc(db, "casino_place_bet", {
    p_user: userId,
    p_game: game,
    p_stake: stake,
    p_source: source,
    p_meta: meta ?? null,
  })) as { round_id: number; balance: number };
  return { roundId: Number(data.round_id), balance: Number(data.balance) };
}

// Cierra la ronda pagando el premio calculado por el servidor (0 si perdió). Regresa el saldo nuevo.
export async function settleRound(
  db: SupabaseClient,
  userId: string,
  roundId: number,
  payout: number,
  source: string,
  meta?: Record<string, unknown>,
): Promise<number> {
  return Number(
    await casinoRpc(db, "casino_settle", { p_user: userId, p_round: roundId, p_payout: payout, p_source: source, p_meta: meta ?? null }),
  );
}

// Blackjack: cobra la segunda apuesta al doblar (una vez por mano)
export async function raiseBet(db: SupabaseClient, userId: string, roundId: number, extra: number, source: string): Promise<number> {
  return Number(await casinoRpc(db, "casino_raise_bet", { p_user: userId, p_round: roundId, p_extra: extra, p_source: source, p_meta: null }));
}

// Regresa lo apostado si la jugada no se pudo guardar
export async function refundRound(db: SupabaseClient, userId: string, roundId: number, source: string): Promise<number> {
  return Number(await casinoRpc(db, "casino_refund", { p_user: userId, p_round: roundId, p_source: source }));
}

// Respuesta JSON estándar para las rutas del casino
export function handleError(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Ocurrió un error inesperado en el casino." }, { status: 500 });
}
