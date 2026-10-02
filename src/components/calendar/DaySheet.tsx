"use client";
// Panel de un día: los hábitos para tachar, progreso semanal y accesos a los bonus
import { BookOpen, Check, ChevronRight, Lock, Medal } from "lucide-react";
import HabitIcon from "@/components/HabitIcon";
import { Sheet } from "@/components/ui";
import { BOOK_BONUS, HABITS, HALF_MARATHON_BONUS, WEEKLY_BONUSES } from "@/lib/constants";
import { longLabel } from "@/lib/dates";
import { weekHabitCount, type ChecksByDate } from "@/lib/points";

export default function DaySheet({
  date,
  today,
  checks,
  onToggle,
  onClose,
  onOpenBonus,
  readOnly = false,
  extra,
  photos,
}: {
  date: string | null;
  today: string;
  checks: ChecksByDate;
  onToggle: (date: string, key: string, on: boolean) => void;
  onClose: () => void;
  onOpenBonus?: (type: "book" | "half") => void;
  // Perfil de otra persona: se ve qué marcó, pero no se puede tachar nada
  readOnly?: boolean;
  // Contenido extra debajo de los hábitos oficiales (hábitos personales)
  extra?: React.ReactNode;
  // Fotos de evidencia del día (hábito -> URL)
  photos?: Record<string, string>;
}) {
  if (!date) return null;
  const isFuture = date > today;
  const isPast = date < today;
  const done = checks[date] ?? new Set<string>();
  const total = HABITS.length;

  return (
    <Sheet
      open
      variant="drawer"
      onClose={onClose}
      title={
        <div>
          <div className="text-sm text-fg2 first-letter:uppercase">{date === today ? `Hoy, ${longLabel(date)}` : longLabel(date)}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`display text-5xl ${done.size === total ? "text-done" : "text-fg"}`}>
              {done.size}
              <span className="text-fg3">/{total}</span>
            </span>
            <span className="text-fg2">hábitos</span>
          </div>
        </div>
      }
    >
      {isFuture && !readOnly && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-raised px-3 py-2 text-fg2">
          <Lock size={16} /> Podrás tacharlo cuando llegue el día.
        </div>
      )}

      <ul className="-mx-2 flex flex-col">
        {HABITS.map((h) => {
          const on = done.has(h.key);
          const missed = isPast && !on;
          return (
            <li key={h.key}>
              <button
                disabled={isFuture || readOnly}
                onClick={() => onToggle(date, h.key, !on)}
                aria-pressed={on}
                className={`group flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-150 ease-out enabled:hover:bg-white/[0.04] ${readOnly ? "disabled:cursor-default" : "disabled:cursor-not-allowed"} ${
                  isFuture && !readOnly ? "opacity-40" : ""
                }`}
              >
                <HabitIcon
                  name={h.icon}
                  size={16}
                  className={`shrink-0 transition-colors duration-150 ${on ? "text-done" : missed ? "text-red-400/50" : "text-fg2"}`}
                />
                <span
                  className={`flex-1 transition-colors duration-150 ${
                    on ? "text-done line-through decoration-done/40" : missed ? "text-fg3" : "text-fg"
                  }`}
                >
                  {h.label}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
                    on ? "border-done bg-done text-black" : missed ? "border-red-400/30" : "border-zinc-600"
                  }`}
                >
                  {on && <Check key="on" size={12} strokeWidth={3} className="animate-check" />}
                </span>
              </button>
              {photos?.[h.key] && (
                <a href={photos[h.key]} target="_blank" rel="noreferrer" className="mb-2 ml-9 block w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos[h.key]} alt={`Evidencia: ${h.short}`} loading="lazy" className="h-24 w-auto max-w-full rounded-lg bg-zinc-900 object-cover" />
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {extra}

      {/* Progreso de los bonus semanales */}
      <div className="mt-6 border-t border-line pt-6">
        <div className="label mb-3">Bonus de la semana</div>
        <div className="flex flex-col gap-3">
          {WEEKLY_BONUSES.map((b) => {
            const n = Math.min(weekHabitCount(checks, date, b.habit), b.times);
            const ok = n >= b.times;
            return (
              <div key={b.habit} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-fg2">{b.habit === "gym" ? "Gym" : "Cardio"}</span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: b.times }).map((_, i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full ${i < n ? (ok ? "bg-done" : "bg-accent") : "bg-white/[0.08]"}`} />
                  ))}
                </div>
                <span className={`w-12 text-right text-xs tabular-nums ${ok ? "text-done" : "text-fg3"}`}>
                  {ok ? `+${b.points}` : `${n}/${b.times}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bonus especiales */}
      {!isFuture && !readOnly && onOpenBonus && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <BonusCard icon={<BookOpen size={16} />} label="Terminé un libro" points={BOOK_BONUS} onClick={() => onOpenBonus("book")} />
          <BonusCard icon={<Medal size={16} />} label="Corrí 21 km" points={HALF_MARATHON_BONUS} onClick={() => onOpenBonus("half")} />
        </div>
      )}
    </Sheet>
  );
}

function BonusCard({ icon, label, points, onClick }: { icon: React.ReactNode; label: string; points: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-left transition-colors duration-150 ease-out hover:bg-raised"
    >
      <span className="flex items-center justify-between text-fg2">
        {icon}
        <ChevronRight size={16} className="text-fg3" />
      </span>
      <span className="font-medium">{label}</span>
      <span className="text-xs text-fg3">+{points} puntos</span>
    </button>
  );
}
