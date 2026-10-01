"use client";
// Piezas de interfaz reutilizables
import { Loader2, X } from "lucide-react";
import { useEffect } from "react";

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-neutral-400">
      <Loader2 className="animate-spin" size={20} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="whitespace-pre-line rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 font-semibold text-red-200 underline">
          Reintentar
        </button>
      )}
    </div>
  );
}

// Panel que sube desde abajo (en computadora se ve centrado)
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="animate-fade absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="animate-sheet relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="text-lg font-bold">{title}</div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-neutral-400 hover:bg-card2">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Anillo de progreso (0 a 1)
export function Ring({
  value,
  size = 36,
  stroke = 4,
  color = "#22d3ee",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#262626" strokeWidth={stroke} fill="none" />
        {value > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(1, value))}
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// Animación de "+N puntos"
export function PointsBurst({ points, onDone }: { points: number | null; onDone: () => void }) {
  useEffect(() => {
    if (points == null) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [points, onDone]);
  if (points == null) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-1/3 z-[60] animate-points">
      <div className="rounded-3xl border border-done/40 bg-black/90 px-8 py-5 text-center shadow-[0_0_60px_rgba(57,255,136,0.35)]">
        <div className="text-5xl font-black text-done">+{points}</div>
        <div className="mt-1 text-sm font-semibold uppercase tracking-widest text-neutral-300">puntos</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between">
      <h2 className="text-lg font-bold">{children}</h2>
      {right}
    </div>
  );
}
