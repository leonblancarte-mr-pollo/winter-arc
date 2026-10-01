"use client";
// Piezas de interfaz reutilizables
import { Loader2, Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect } from "react";

// Logo: wordmark "WINTER ARC" en la fuente editorial
export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={`display uppercase tracking-[0.1em] text-fg ${size === "lg" ? "text-5xl" : "text-xl"}`}
      aria-label="Winter Arc"
    >
      Winter Arc
    </span>
  );
}

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-fg3">
      <Loader2 className="animate-spin" size={16} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="whitespace-pre-line rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-sm text-red-300">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 font-medium text-red-200 underline underline-offset-2">
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2 text-sm text-sky-200">{children}</div>;
}

// Panel que sube desde abajo en celular.
// En computadora: "drawer" entra por la derecha, "modal" aparece centrado.
export function Sheet({
  open,
  onClose,
  title,
  variant = "modal",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  variant?: "drawer" | "modal";
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const drawer = variant === "drawer";
  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center ${drawer ? "sm:items-stretch sm:justify-end" : "sm:items-center"}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-fade absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`animate-sheet ${drawer ? "is-drawer" : "is-modal"} relative max-h-[90dvh] w-full overflow-y-auto rounded-t-xl border border-line bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${
          drawer ? "sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0" : "sm:max-w-md sm:rounded-xl"
        }`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">{title}</div>
          <button onClick={onClose} aria-label="Cerrar" className="icon-btn -mr-2 -mt-1">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Anillo de progreso delgado (0 a 1)
export function Ring({
  value,
  size = 36,
  stroke = 2,
  color = "#38bdf8",
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
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
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
            style={{ transition: "stroke-dashoffset 150ms ease-out, stroke 150ms ease-out" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// Aviso de "+N puntos" al registrar un bonus
export function PointsBurst({ points, onDone }: { points: number | null; onDone: () => void }) {
  useEffect(() => {
    if (points == null) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [points, onDone]);
  if (points == null) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-1/3 z-[60] animate-points" role="status">
      <div className="rounded-xl border border-done/30 bg-surface px-8 py-6 text-center">
        <div className="display text-6xl text-done">+{points}</div>
        <div className="label mt-2">puntos sumados</div>
      </div>
    </div>
  );
}

// Flecha de tendencia contra hace 7 días (delta positivo = mejoró)
export function Trend({ delta, suffix = "" }: { delta: number | null; suffix?: string }) {
  if (delta == null) return <span className="text-xs text-fg3">Primera semana</span>;
  const Icon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const color = delta === 0 ? "text-fg3" : delta > 0 ? "text-done" : "text-danger";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {delta === 0 ? "Sin cambio" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}${suffix}`}
      <span className="font-normal text-fg3">vs hace 7 días</span>
    </span>
  );
}

export function SectionTitle({ children, right, id }: { children: React.ReactNode; right?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-4 mt-12 flex items-center justify-between gap-4">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {children}
      </h2>
      {right}
    </div>
  );
}

// Leyenda de gráficas en HTML (evita que Recharts mida y re-mida su leyenda)
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-fg2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
