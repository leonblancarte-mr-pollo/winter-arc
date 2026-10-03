// EASTER EGG intencional (secreto, solo diversión entre amigos con moneda ficticia).
// El navegador detecta la secuencia 6-7-6-7 en la ruleta, pero el bono lo decide AQUÍ:
// la función SQL casino_easter_egg solo paga si el saldo del usuario es exactamente 0.
// Para quitarlo: borra esta carpeta, supabase/easter_egg.sql y los bloques "EASTER EGG" de la ruleta.
import { handleError, HttpError, requireUser } from "@/lib/server/casino";

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const { data, error } = await db.rpc("casino_easter_egg", { p_user: userId });
    if (error) {
      // Mensaje neutro a propósito: no revela qué condición falló
      if (error.message.includes("no aplica")) throw new HttpError(400, "No disponible.");
      if (error.code === "PGRST202" || error.message.includes("does not exist")) throw new HttpError(404, "No disponible.");
      if (error.message.includes("check constraint")) throw new HttpError(500, "Falta correr supabase/easter_egg.sql en Supabase.");
      throw new HttpError(500, `Error del casino: ${error.message}`);
    }
    return Response.json({ balance: Number(data) });
  } catch (e) {
    return handleError(e);
  }
}
