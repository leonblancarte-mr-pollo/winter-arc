"use client";
// Tablero de ajedrez con piezas Unicode. Toca una pieza tuya para ver a dónde puede ir
// (lo calcula chess.js) y toca la casilla para mover. El servidor vuelve a validar todo.
import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PROMOTIONS = [
  { p: "q", name: "Dama" },
  { p: "r", name: "Torre" },
  { p: "b", name: "Alfil" },
  { p: "n", name: "Caballo" },
];

export type BoardMove = { from: string; to: string; promotion?: string };

// Piezas dibujadas como SVG: se ven igual en todos los celulares (los símbolos Unicode
// cambian de color o se vuelven emoji según el sistema). Un mismo dibujo para los dos colores.
const PIECE_PATHS: Record<string, string[]> = {
  p: ["M50 18a11 11 0 0 1 6 20.3C64 43 66 52 64 60h8v10H28V60h8c-2-8 0-17 8-21.7A11 11 0 0 1 50 18Z", "M24 70h52v12H24z"],
  r: ["M28 82V72h6l2-28h-6V22h10v6h6v-6h8v6h6v-6h10v22h-6l2 28h6v10Z"],
  n: ["M28 82V72c0-14 8-18 13-27-6 0-10 2-14 6l-6-3c2-8 8-16 16-22l2-8 7 5c13-1 27 9 27 31v24Z"],
  b: ["M50 12a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z", "M50 26c10 8 14 18 8 28l4 6-6 2 4 8h6v12H34V70h6l4-8-6-2 4-6c-6-10-2-20 8-28Z"],
  q: ["M24 82V72l6-2-8-38 16 20 4-26 8 24 8-24 4 26 16-20-8 38 6 2v10Z", "M22 28a5 5 0 1 0 0 .1ZM42 20a5 5 0 1 0 0 .1ZM58 20a5 5 0 1 0 0 .1ZM78 28a5 5 0 1 0 0 .1ZM50 14a5 5 0 1 0 0 .1Z"],
  k: ["M46 8h8v8h8v8h-8v8h-8v-8h-8v-8h8Z", "M50 34c16 0 22 12 16 24l4 12 4 2v10H26V72l4-2 4-12c-6-12 0-24 16-24Z"],
};

function Piece({ type, color, size = "h-full w-full" }: { type: string; color: "w" | "b"; size?: string }) {
  const white = color === "w";
  return (
    <svg viewBox="12 6 76 76" className={`select-none ${size}`} aria-hidden>
      <g
        fill={white ? "#ffffff" : "#111827"}
        stroke={white ? "#0f172a" : "#e2e8f0"}
        strokeWidth={white ? 3.5 : 2.5}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 1.5px 1px rgba(0,0,0,0.35))" }}
      >
        {PIECE_PATHS[type].map((d, i) => (
          <path key={i} d={d} />
        ))}
        {type === "n" && <circle cx="50" cy="32" r="2.5" fill={white ? "#0f172a" : "#e2e8f0"} stroke="none" />}
      </g>
    </svg>
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
      <div className="mx-auto grid aspect-square w-full max-w-[480px] grid-cols-8 grid-rows-8 overflow-hidden rounded-lg border border-line" role="grid" aria-label="Tablero de ajedrez">
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
                className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden ${interactive ? "cursor-pointer" : "cursor-default"}`}
                style={{ background: dark ? "#64748b" : "#cbd5e1" }}
              >
                {isLast && <span className="absolute inset-0 bg-sky-300/35" />}
                {square === checkSquare && <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(248,113,113,0.95)_0%,rgba(248,113,113,0.35)_60%,transparent_75%)]" />}
                {square === selected && <span className="absolute inset-0 ring-4 ring-inset ring-accent" />}
                {piece && (
                  <span className="relative h-[86%] w-[86%]">
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
              <Piece type={o.p} color={turn} size="h-14 w-14" />
              <span className="text-xs font-medium text-zinc-900">{o.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
