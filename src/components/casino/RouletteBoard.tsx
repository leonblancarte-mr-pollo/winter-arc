"use client";
// Tablero de la ruleta (vertical, para celular). Toca una casilla para poner tu ficha ahí.
import { betKey, colorOf, DOUBLE_ZERO, labelOf, type BetType, type RouletteBet } from "@/lib/casino/roulette";
import { formatPeseis } from "@/lib/casino/client";

type Props = {
  bets: Record<string, RouletteBet>;
  onPlace: (bet: { type: BetType; value?: number }) => void;
  disabled?: boolean;
  winner?: number | null; // número ganador para resaltarlo
};

const CELL_BG = { red: "bg-red-600", black: "bg-zinc-900", green: "bg-emerald-600" };
const SOFT = "bg-raised text-xs";

// Una casilla del tablero, con la ficha encima si ya apostaste ahí
function Cell({
  type,
  value,
  bets,
  onPlace,
  disabled,
  winner,
  children,
  className = "",
  style,
}: Omit<Props, "winner"> & {
  type: BetType;
  value?: number;
  winner?: number | null;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const amount = bets[betKey({ type, value })]?.amount;
  const isWinner = type === "straight" && winner != null && winner === value;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPlace({ type, value })}
      style={style}
      className={`relative flex min-h-10 items-center justify-center rounded-md border text-sm font-semibold text-white transition-[filter] duration-150 ease-out enabled:hover:brightness-125 disabled:cursor-not-allowed ${
        isWinner ? "border-white ring-2 ring-white" : "border-white/10"
      } ${className}`}
    >
      {children}
      {amount != null && (
        <span className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 text-[10px] font-semibold leading-4 text-black tabular-nums shadow">
          {formatPeseis(amount)}
        </span>
      )}
    </button>
  );
}

export default function RouletteBoard(props: Props) {
  const rows = Array.from({ length: 12 }, (_, r) => [r * 3 + 1, r * 3 + 2, r * 3 + 3]);

  return (
    <div className="card p-3">
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr] gap-1">
        {/* 0 y 00 */}
        <div />
        <div className="col-span-3 grid grid-cols-2 gap-1">
          <Cell {...props} type="straight" value={0} className={CELL_BG.green}>
            0
          </Cell>
          <Cell {...props} type="straight" value={DOUBLE_ZERO} className={CELL_BG.green}>
            00
          </Cell>
        </div>

        {/* Números 1-36 con las docenas a la izquierda */}
        {rows.map((row, r) => (
          <div key={r} className="contents">
            {r % 4 === 0 && (
              <Cell {...props} type="dozen" value={r / 4 + 1} className={SOFT} style={{ gridRow: "span 4" }}>
                <span className="-rotate-90 whitespace-nowrap">{["1ª 12", "2ª 12", "3ª 12"][r / 4]}</span>
              </Cell>
            )}
            {row.map((n) => (
              <Cell {...props} key={n} type="straight" value={n} className={CELL_BG[colorOf(n)]}>
                {labelOf(n)}
              </Cell>
            ))}
          </div>
        ))}

        {/* Columnas */}
        <div />
        {[1, 2, 3].map((c) => (
          <Cell {...props} key={c} type="column" value={c} className={SOFT}>
            2 a 1
          </Cell>
        ))}
      </div>

      {/* Apuestas de afuera */}
      <div className="mt-1 grid grid-cols-3 gap-1">
        <Cell {...props} type="low" className={SOFT}>
          1 a 18
        </Cell>
        <Cell {...props} type="even" className={SOFT}>
          Par
        </Cell>
        <Cell {...props} type="red" className={`${CELL_BG.red} text-xs`}>
          Rojo
        </Cell>
        <Cell {...props} type="black" className={`${CELL_BG.black} text-xs`}>
          Negro
        </Cell>
        <Cell {...props} type="odd" className={SOFT}>
          Impar
        </Cell>
        <Cell {...props} type="high" className={SOFT}>
          19 a 36
        </Cell>
      </div>
    </div>
  );
}
