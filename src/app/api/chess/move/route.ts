// Hacer una jugada. El SERVIDOR la valida con chess.js antes de guardarla; si el navegador
// manda algo ilegal, fuera de turno o fuera de tiempo, se rechaza.
import { applyMove, ChessRuleError, timeoutResult } from "@/lib/chess/engine";
import { handleError, HttpError, requireUser } from "@/lib/server/casino";
import type { ChessGame } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { userId, db } = await requireUser(req);
    const body = (await req.json().catch(() => null)) as { gameId?: unknown; from?: unknown; to?: unknown; promotion?: unknown } | null;
    if (typeof body?.gameId !== "string" || typeof body.from !== "string" || typeof body.to !== "string") throw new HttpError(400, "Jugada inválida.");
    const promotion = typeof body.promotion === "string" ? body.promotion : undefined;

    const { data, error } = await db.from("chess_games").select("*").eq("id", body.gameId).maybeSingle();
    if (error) throw new HttpError(500, error.message);
    const game = data as ChessGame | null;
    if (!game || (game.white_user_id !== userId && game.black_user_id !== userId)) throw new HttpError(404, "Esa partida no existe.");

    // Si ya se le acabó el tiempo a quien tenía el turno, se cierra la partida
    const expired = timeoutResult(game);
    if (expired) {
      const { data: closed } = await db.from("chess_games").update({ ...expired, updated_at: new Date().toISOString() }).eq("id", game.id).eq("status", "active").select("*").single();
      return Response.json({ game: closed ?? { ...game, ...expired }, error: "Se acabó el tiempo para mover: la partida terminó." }, { status: 409 });
    }

    let next;
    try {
      next = applyMove(game, userId, { from: body.from, to: body.to, promotion });
    } catch (e) {
      if (e instanceof ChessRuleError) throw new HttpError(e.status, e.message);
      throw e;
    }
    const { in_check, ...fields } = next;

    // Solo guarda si nadie movió mientras tanto (misma posición de antes)
    const { data: saved, error: saveErr } = await db
      .from("chess_games")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", game.id)
      .eq("fen", game.fen)
      .eq("status", "active")
      .select("*");
    if (saveErr) throw new HttpError(500, saveErr.message);
    if (!saved?.length) throw new HttpError(409, "La partida cambió mientras movías. Recarga e intenta de nuevo.");
    return Response.json({ game: saved[0], inCheck: in_check });
  } catch (e) {
    return handleError(e);
  }
}
