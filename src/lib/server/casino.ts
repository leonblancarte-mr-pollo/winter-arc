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

// Suma o resta peseis de forma atómica y registra el movimiento. Regresa el saldo nuevo.
export async function applyBalance(
  db: SupabaseClient,
  userId: string,
  delta: number,
  type: "bet" | "bet_win",
  game: "ruleta" | "blackjack",
  meta?: Record<string, unknown>,
): Promise<number> {
  const { data, error } = await db.rpc("casino_apply", {
    p_user: userId,
    p_delta: delta,
    p_type: type,
    p_game: game,
    p_meta: meta ?? null,
  });
  if (error) {
    if (error.message.includes("saldo insuficiente")) throw new HttpError(400, "No tienes peseis suficientes para esa apuesta.");
    if (error.message.includes("does not exist") || error.code === "PGRST202") {
      throw new HttpError(500, "Falta crear las tablas del casino: corre supabase/casino.sql en Supabase.");
    }
    throw new HttpError(500, `Error del casino: ${error.message}`);
  }
  return Number(data);
}

// Respuesta JSON estándar para las rutas del casino
export function handleError(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Ocurrió un error inesperado en el casino." }, { status: 500 });
}
