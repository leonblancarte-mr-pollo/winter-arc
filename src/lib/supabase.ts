// Cliente de Supabase para el navegador.
// Solo usa la llave pública (anon). La llave "service_role" NUNCA va aquí.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured =
  !!url && !!anonKey && url.startsWith("https://") && !url.includes("TU-PROYECTO");

export const supabase = createClient(
  supabaseConfigured ? url! : "https://placeholder.supabase.co",
  supabaseConfigured ? anonKey! : "placeholder",
);

// Supabase regresa máximo 1000 filas por consulta; esto trae todas por páginas.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

// Traduce errores comunes de Supabase al español
export function errorES(msg: string | undefined | null): string {
  if (!msg) return "Ocurrió un error inesperado.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("user already registered")) return "Ya existe una cuenta con ese correo.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.";
  if (m.includes("password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "El correo no es válido.";
  if (m.includes("rate limit")) return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sin conexión. Revisa tu internet.";
  if (m.includes("row-level security")) return "No tienes permiso para hacer eso (¿día futuro o fuera de la carrera?).";
  if (m.includes("check constraint")) return "Los datos no cumplen las reglas (revisa fechas y campos).";
  if (m.includes("jwt") || m.includes("not authenticated")) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  return msg;
}
