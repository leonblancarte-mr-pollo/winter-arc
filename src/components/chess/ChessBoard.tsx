"use client";
// Tablero de ajedrez con piezas Unicode. Toca una pieza tuya para ver a dónde puede ir
// (lo calcula chess.js) y toca la casilla para mover. El servidor vuelve a validar todo.
import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui";

// Mismo dibujo para los dos colores; el color se pone con CSS.
// "︎" fuerza a que se vea como texto y no como emoji (sobre todo en iPhone).
const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PROMOTIONS = [
  { p: "q", name: "Dama" },
  { p: "r", name: "Torre" },
  { p: "b", name: "Alfil" },
  { p: "n", name: "Caballo" },
];

export type BoardMove = { from: string; to: string; promotion?: string };

function Piece({ type, color, size = "text-[min(9vw,42px)]" }: { type: string; color: "w" | "b"; size?: string }) {
  return (
    <span
      className={`select-none leading-none ${size}`}
      style={
        color === "w"
          ? { color: "#fafafa", WebkitTextStroke: "1px #18181b", textShadow: "0 1px 1px rgba(0,0,0,0.5)" }
          : { color: "#0a0a0a", WebkitTextStroke: "0.6px #a1a1aa" }
      }
      aria-hidden
    >
      {GLYPH[type]}
      {"︎"}
    </span>
  );
}

export default function ChessBoard({
  fen,
  orientation,
  interactive,
  lastMove,
  onMove,
}: {
  fen: string;
  orientation: "w" | "b";
  interactive: boolean; // ¿puedo mover ahora? (es mi turno y la partida sigue)
  lastMove?: string | null;
  onMove: (m: BoardMove) => void;
}) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const turn = chess.turn();

  const targets = useMemo(() => {
    if (!selected) return new Map<string, { capture: boolean; promotion: boolean }>();
    return new Map(
      chess.moves({ square: selected, verbose: true }).map((m) => [m.to, { capture: !!m.captured, promotion: !!m.promotion }]),
    );
  }, [chess, selected]);

  // Casilla del rey en jaque (para pintarla de rojo)
  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (const row of chess.board()) for (const sq of row) if (sq && sq.type === "k" && sq.color === turn) return sq.square;
    return null;
  }, [chess, turn]);

  const from = lastMove?.slice(0, 2);
  const to = lastMove?.slice(2, 4);

  function tap(square: Square) {
    if (!interactive) return;
    const piece = chess.get(square);
    // Tocar una pieza propia la selecciona (o cambia la selección)
    if (piece && piece.color === turn) {
      setSelected(selected === square ? null : square);
      return;
    }
    const t = selected ? targets.get(square) : undefined;
    if (selected && t) {
      if (t.promotion) setPromo({ from: selected, to: square });
      else onMove({ from: selected, to: square });
      setSelected(null);
      return;
    }
    setSelected(null);
  }

  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? FILES : [...FILES].reverse();

  return (
    <>
      <div className="mx-auto grid aspect-square w-full max-w-[480px] grid-cols-8 overflow-hidden rounded-lg border border-line" role="grid" aria-label="Tablero de ajedrez">
        {ranks.map((rank, ri) =>
          files.map((file, fi) => {
            const square = `${file}${rank}` as Square;
            const piece = chess.get(square);
            const dark = (FILES.indexOf(file) + rank) % 2 === 1;
            const t = targets.get(square);
            const isLast = square === from || square === to;
            return (
              <button
                key={square}
                type="button"
                onClick={() => tap(square)}
                aria-label={`${square}${piece ? `, ${piece.color === "w" ? "blanca" : "negra"}` : ""}`}
                className={`relative flex items-center justify-center ${interactive ? "cursor-pointer" : "cursor-default"}`}
                style={{ background: dark ? "#64748b" : "#cbd5e1" }}
              >
                {isLast && <span className="absolute inset-0 bg-sky-300/35" />}
                {square === checkSquare && <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(248,113,113,0.95)_0%,rgba(248,113,113,0.35)_60%,transparent_75%)]" />}
                {square === selected && <span className="absolute inset-0 ring-4 ring-inset ring-accent" />}
                {piece && (
                  <span className="relative">
                    <Piece type={piece.type} color={piece.color} />
                  </span>
                )}
                {/* Casillas a donde puede moverse la pieza elegida */}
                {t && !t.capture && <span className="absolute h-[28%] w-[28%] rounded-full bg-zinc-900/45" />}
                {t && t.capture && <span className="absolute inset-[6%] rounded-full border-[5px] border-zinc-900/45" />}
                {/* Coordenadas en el borde */}
                {fi === 0 && <span className={`absolute left-0.5 top-0 text-[9px] font-semibold ${dark ? "text-slate-200" : "text-slate-600"}`}>{rank}</span>}
                {ri === 7 && <span className={`absolute bottom-0 right-1 text-[9px] font-semibold ${dark ? "text-slate-200" : "text-slate-600"}`}>{file}</span>}
              </button>
            );
          }),
        )}
      </div>

      {/* Coronación: el peón llegó a la última fila */}
      <Sheet open={promo != null} onClose={() => setPromo(null)} title={<div className="text-xl font-semibold">Corona tu peón</div>}>
        <div className="grid grid-cols-4 gap-2">
          {PROMOTIONS.map((o) => (
            <button
              key={o.p}
              type="button"
              className="flex flex-col items-center gap-2 rounded-xl border border-line bg-slate-300 py-3 transition-colors duration-150 hover:bg-slate-200"
              onClick={() => {
                if (promo) onMove({ ...promo, promotion: o.p });
                setPromo(null);
              }}
            >
              <Piece type={o.p} color={turn} size="text-5xl" />
              <span className="text-xs font-medium text-zinc-900">{o.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
