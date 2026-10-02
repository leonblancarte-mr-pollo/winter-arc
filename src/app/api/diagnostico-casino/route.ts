// TEMPORAL: diagnóstico de la llave del casino, SIN revelarla completa.
// Muestra el tipo de llave, sus primeros 14 y últimos 4 caracteres, su largo, si trae
// espacios/saltos de línea alrededor, y prueba de verdad si Supabase la acepta como secreta.
// BORRAR cuando el casino funcione.
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Nombre legible de un carácter "invisible" (para saber qué se coló al pegar)
function describe(ch: string) {
  if (ch === "\n") return "salto de línea";
  if (ch === "\r") return "retorno de carro";
  if (ch === "\t") return "tabulador";
  if (ch === " ") return "espacio";
  if (ch === '"' || ch === "'") return "comilla";
  return `carácter U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

export async function GET() {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const key = raw.trim();
  const tipo = !key
    ? "NO HAY LLAVE"
    : key.startsWith("sb_secret_")
      ? "Secret key (correcta)"
      : key.startsWith("sb_publishable_")
        ? "Publishable key (INCORRECTA: es la pública)"
        : key.startsWith("eyJ")
          ? "Llave JWT antigua"
          : "Formato desconocido";

  // Lo que sobra ALREDEDOR de la llave (la app lo quita sola con trim, no causa errores)
  const before = raw.slice(0, raw.length - raw.trimStart().length);
  const after = raw.slice(raw.trimEnd().length);
  // Caracteres raros DENTRO de la llave (esto sí sería un problema)
  const inside = [...key].filter((c) => !/[A-Za-z0-9_.-]/.test(c));

  // Prueba real: listar 1 usuario solo funciona con la llave secreta (no regresa datos aquí)
  let prueba = "no se probó (no hay llave)";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (key && url) {
    try {
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      prueba = error ? `FALLA: Supabase rechazó la llave (${error.message})` : "OK: Supabase acepta la llave como secreta";
    } catch (e) {
      prueba = `FALLA: ${(e as Error).message}`;
    }
  }

  return Response.json(
    {
      llave_tipo: tipo,
      llave_inicio: key ? key.slice(0, 14) + "…" : null,
      llave_final: key.length > 18 ? "…" + key.slice(-4) : null,
      llave_largo_sin_espacios: key.length,
      llave_largo_como_quedo_guardada: raw.length,
      sobra_al_inicio: before ? [...before].map(describe) : "nada",
      sobra_al_final: after ? [...after].map(describe) : "nada",
      caracteres_raros_dentro: inside.length ? inside.map(describe) : "ninguno",
      prueba_con_supabase: prueba,
      vercel_ambiente: process.env.VERCEL_ENV ?? "local",
      vercel_deploy: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      vercel_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      hora_servidor: new Date().toISOString(),
    },
    // Nunca guardar esta respuesta en caché (ni el navegador ni Vercel)
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } },
  );
}
