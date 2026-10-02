// Aceptar o rechazar una invitación de ajedrez. Al aceptar se crea la partida en el SERVIDOR,
// con los colores sorteados con crypto (nadie los elige).
import { newGame } from "@/lib/chess/engine";
import { handleError, HttpError, requireUser } from "@/lib/server/casino";

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const body = (await req.json().catch(() => null)) as { invitationId?: unknown; accept?: unknown } | null;
    const id = body?.invitationId;
    if (typeof id !== "number" || typeof body?.accept !== "boolean") throw new HttpError(400, "Solicitud inválida.");

    const { data: inv, error } = await db.from("chess_invitations").select("*").eq("id", id).maybeSingle();
    if (error) throw new HttpError(500, error.message.includes("does not exist") ? "Falta correr supabase/ajedrez_y_tragamonedas.sql en Supabase." : error.message);
    if (!inv || inv.to_user_id !== userId) throw new HttpError(404, "Esa invitación no existe.");
    if (inv.status !== "pending") throw new HttpError(409, "Esa invitación ya fue respondida.");

    if (!body.accept) {
      await db.from("chess_invitations").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
      return Response.json({ ok: true });
    }

    // Marca la invitación primero (si dos toques llegan juntos, solo uno crea la partida)
    const { data: claimed } = await db
      .from("chess_invitations")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) throw new HttpError(409, "Esa invitación ya fue respondida.");

    const { data: people } = await db.from("profiles").select("id,display_name").in("id", [inv.from_user_id, inv.to_user_id]);
    const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.display_name]));
    const { data: game, error: gameErr } = await db.from("chess_games").insert(newGame(inv.from_user_id, inv.to_user_id, names)).select("id").single();
    if (gameErr || !game) {
      await db.from("chess_invitations").update({ status: "pending", responded_at: null }).eq("id", id); // deshace
      throw new HttpError(500, `No se pudo crear la partida: ${gameErr?.message ?? "error desconocido"}`);
    }
    await db.from("chess_invitations").update({ game_id: game.id }).eq("id", id);
    return Response.json({ ok: true, gameId: game.id });
  } catch (e) {
    return handleError(e);
  }
}
