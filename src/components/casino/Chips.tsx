"use client";
// Fichas del casino: el usuario arma su apuesta tocando fichas (ej. 100 + 100 + 5 = 205)
import { Undo2, X } from "lucide-react";
import { CHIP_VALUES, formatPeseis } from "@/lib/casino/client";

// Un color fijo por valor de ficha
export const CHIP_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#fafafa", fg: "#000" },
  2: { bg: "#a1a1aa", fg: "#000" },
  5: { bg: "#f87171", fg: "#000" },
  10: { bg: "#38bdf8", fg: "#000" },
  20: { bg: "#4ade80", fg: "#000" },
  50: { bg: "#fb923c", fg: "#000" },
  100: { bg: "#a78bfa", fg: "#000" },
};

export function Chip({ value, size = 44, onClick, disabled }: { value: number; size?: number; onClick?: () => void; disabled?: boolean }) {
  const c = CHIP_COLORS[value] ?? { bg: "#fafafa", fg: "#000" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Ficha de ${value}`}
      className="relative flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums transition-transform duration-150 ease-out active:scale-90 disabled:opacity-30"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: size * 0.32,
        boxShadow: `inset 0 0 0 ${size * 0.08}px rgba(0,0,0,0.25), inset 0 0 0 ${size * 0.14}px ${c.bg}, inset 0 0 0 ${size * 0.16}px rgba(255,255,255,0.6)`,
      }}
    >
      {value}
    </button>
  );
}

// Resumen de la pila: "2 × 100 + 1 × 5"
export function stackBreakdown(stack: number[]) {
  const counts = new Map<number, number>();
  for (const v of stack) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([v, n]) => `${n} × ${v}`)
    .join(" + ");
}

export function ChipPicker({
  stack,
  onChange,
  max,
  disabled,
}: {
  stack: number[];
  onChange: (s: number[]) => void;
  max: number; // no deja armar más de lo que tienes
  disabled?: boolean;
}) {
  const total = stack.reduce((s, v) => s + v, 0);
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label">Tu ficha</div>
          <div className="display mt-1 text-4xl">{formatPeseis(total)}</div>
          <div className="mt-1 truncate text-xs text-fg3">{stack.length ? stackBreakdown(stack) : "Toca las fichas para armar tu apuesta"}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="btn-secondary px-2"
            onClick={() => onChange([...stack, ...stack])}
            disabled={disabled || !stack.length || total * 2 > max}
            title="Duplicar"
          >
            ×2
          </button>
          <button type="button" className="icon-btn" onClick={() => onChange(stack.slice(0, -1))} disabled={disabled || !stack.length} aria-label="Quitar la última ficha">
            <Undo2 size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={() => onChange([])} disabled={disabled || !stack.length} aria-label="Quitar todas las fichas">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {CHIP_VALUES.map((v) => (
          <Chip key={v} value={v} disabled={disabled || total + v > max} onClick={() => onChange([...stack, v])} />
        ))}
      </div>
    </div>
  );
}
