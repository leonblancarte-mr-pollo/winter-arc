// Árbitro de ajedrez del SERVIDOR (sin base de datos, para poder probarlo solo).
// Usa chess.js para validar cada jugada: nunca se confía en lo que manda el navegador.
import { Chess } from "chess.js";
import { randomInt } from "@/lib/casino/rng";
import type { ChessEndReason, ChessGame, ChessStatus } from "@/lib/types";
import { colorOf, START_FEN, TURN_HOURS, turnOf } from "./shared";

export class ChessRuleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const deadlineFrom = (now: number) => new Date(now + TURN_HOURS * 3600_000).toISOString();

// Crea los datos de una partida nueva. El color se sortea con crypto (no lo eligen).
export function newGame(userA: string, userB: string, names: Record<string, string>, now = Date.now()) {
  const aIsWhite = randomInt(2) === 0;
  const white = aIsWhite ? userA : userB;
  const black = aIsWhite ? userB : userA;
  const chess = new Chess();
  chess.header("Event", "Winter Arc", "White", names[white] ?? "Blancas", "Black", names[black] ?? "Negras", "Date", new Date(now).toISOString().slice(0, 10).replace(/-/g, "."));
  return {
    white_user_id: white,
    black_user_id: black,
    fen: START_FEN,
    pgn: chess.pgn(),
    status: "active" as ChessStatus,
    turn_deadline: deadlineFrom(now),
  };
}

// Si ya pasó el plazo, pierde quien tenía el turno
export function timeoutResult(game: Pick<ChessGame, "status" | "fen" | "turn_deadline">, now = Date.now()) {
  if (game.status !== "active" || !game.turn_deadline || new Date(game.turn_deadline).getTime() > now) return null;
  return {
    status: (turnOf(game.fen) === "w" ? "black_won" : "white_won") as ChessStatus,
    end_reason: "timeout" as ChessEndReason,
    turn_deadline: null,
  };
}

export type MoveInput = { from: string; to: string; promotion?: string };

// Valida y aplica una jugada. Regresa los campos nuevos de la partida.
export function applyMove(game: ChessGame, userId: string, input: MoveInput, now = Date.now()) {
  if (game.status !== "active") throw new ChessRuleError(409, "Esta partida ya terminó.");
  const me = colorOf(game, userId);
  if (!me) throw new ChessRuleError(403, "No juegas en esta partida.");
  if (timeoutResult(game, now)) throw new ChessRuleError(409, "Se acabó el tiempo para mover: la partida terminó.");
  if (turnOf(game.fen) !== me) throw new ChessRuleError(409, "No es tu turno.");

  const square = /^[a-h][1-8]$/;
  if (!square.test(input.from) || !square.test(input.to)) throw new ChessRuleError(400, "Jugada inválida.");
  if (input.promotion != null && !["q", "r", "b", "n"].includes(input.promotion)) throw new ChessRuleError(400, "Promoción inválida.");

  // Reconstruye la partida desde el historial (para detectar repeticiones) y revisa que coincida
  const chess = new Chess();
  if (game.pgn.trim()) chess.loadPgn(game.pgn);
  if (chess.fen() !== game.fen) {
    chess.load(game.fen);
  }

  try {
    chess.move({ from: input.from, to: input.to, promotion: input.promotion });
  } catch {
    throw new ChessRuleError(400, "Esa jugada no es legal.");
  }

  let status: ChessStatus = "active";
  let end_reason: ChessEndReason | null = null;
  if (chess.isCheckmate()) {
    status = me === "w" ? "white_won" : "black_won";
    end_reason = "checkmate";
  } else if (chess.isStalemate()) {
    status = "draw";
    end_reason = "stalemate";
  } else if (chess.isInsufficientMaterial()) {
    status = "draw";
    end_reason = "insufficient_material";
  } else if (chess.isThreefoldRepetition()) {
    status = "draw";
    end_reason = "threefold_repetition";
  } else if (chess.isDrawByFiftyMoves()) {
    status = "draw";
    end_reason = "fifty_moves";
  }

  if (status !== "active") {
    const result = status === "white_won" ? "1-0" : status === "black_won" ? "0-1" : "1/2-1/2";
    chess.header("Result", result);
  }

  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    last_move: input.from + input.to,
    status,
    end_reason,
    turn_deadline: status === "active" ? deadlineFrom(now) : null,
    in_check: chess.inCheck(),
  };
}
