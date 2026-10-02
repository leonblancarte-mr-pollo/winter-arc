// Utilidades de ajedrez que usan tanto el servidor como la pantalla
import type { ChessEndReason, ChessGame } from "@/lib/types";

export const TURN_HOURS = 24;
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// A quién le toca: la segunda parte del FEN es "w" (blancas) o "b" (negras)
export function turnOf(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export function colorOf(game: Pick<ChessGame, "white_user_id" | "black_user_id">, userId: string): "w" | "b" | null {
  if (game.white_user_id === userId) return "w";
  if (game.black_user_id === userId) return "b";
  return null;
}

export function isMyTurn(game: ChessGame, userId: string) {
  return game.status === "active" && colorOf(game, userId) === turnOf(game.fen);
}

export function opponentOf(game: Pick<ChessGame, "white_user_id" | "black_user_id">, userId: string) {
  return game.white_user_id === userId ? game.black_user_id : game.white_user_id;
}

// "18h 32m", "45m", "menos de 1 minuto"
export function formatTimeLeft(deadline: string | null, now = Date.now()) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "menos de 1 minuto";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export const END_REASON_TEXT: Record<ChessEndReason, string> = {
  checkmate: "jaque mate",
  stalemate: "ahogado",
  insufficient_material: "material insuficiente",
  threefold_repetition: "triple repetición",
  fifty_moves: "regla de las 50 jugadas",
  timeout: "se acabó el tiempo",
};

// Texto del resultado desde mi punto de vista
export function resultText(game: ChessGame, userId: string) {
  const me = colorOf(game, userId);
  const reason = game.end_reason ? END_REASON_TEXT[game.end_reason] : "";
  if (game.status === "draw") return `Tablas por ${reason}`;
  if (game.status === "abandoned") return "Partida abandonada";
  if (game.status === "active") return "";
  const winner = game.status === "white_won" ? "w" : "b";
  return `${winner === me ? "Ganaste" : "Perdiste"} por ${reason}`;
}
