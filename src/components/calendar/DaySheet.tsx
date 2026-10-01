"use client";
// Panel de un día: lista de los 7 hábitos para tachar
import { Check, Lock } from "lucide-react";
import HabitIcon from "@/components/HabitIcon";
import { Sheet } from "@/components/ui";
import { HABITS, WEEKLY_BONUSES } from "@/lib/constants";
import { longLabel } from "@/lib/dates";
import { weekHabitCount, type ChecksByDate } from "@/lib/points";

export default function DaySheet({
  date,
  today,
  checks,
  onToggle,
  onClose,
}: {
  date: string | null;
  today: string;
  checks: ChecksByDate;
  onToggle: (date: string, key: string, on: boolean) => void;
  onClose: () => void;
}) {
  if (!date) return null;
  const isFuture = date > today;
  const isPast = date < today;
  const done = checks[date] ?? new Set<string>();

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div>
          <div className="capitalize">{date === today ? "Hoy" : longLabel(date)}</div>
          <div className="text-sm font-normal text-neutral-400">
            {date === today && <span className="capitalize">{longLabel(date)} · </span>}
            <span className="font-bold text-white tabular-nums">{done.size}/7</span> hábitos
          </div>
        </div>
      }
    >
      {isFuture && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-card2 p-3 text-sm text-neutral-400">
          <Lock size={16} /> Este día todavía no llega. Podrás tacharlo cuando sea el día.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {HABITS.map((h) => {
          const on = done.has(h.key);
          const missed = isPast && !on;
          return (
            <li key={h.key}>
              <button
                disabled={isFuture}
                onClick={() => onToggle(date, h.key, !on)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed ${
                  on
                    ? "border-done/50 bg-done/10"
                    : missed
                      ? "border-miss/40 bg-miss/10 opacity-70"
                      : "border-line bg-card2"
                } ${isFuture ? "opacity-40" : ""}`}
              >
                <HabitIcon
                  name={h.icon}
                  size={20}
                  className={on ? "text-done" : missed ? "text-red-300/60" : "text-neutral-400"}
                />
                <span className={`flex-1 font-medium ${on ? "text-done" : missed ? "text-neutral-400" : ""}`}>{h.label}</span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
                    on ? "border-done bg-done text-black" : "border-neutral-600"
                  }`}
                >
                  {on && <Check size={16} strokeWidth={3.5} />}
                  {isFuture && !on && <Lock size={12} className="text-neutral-600" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Progreso de bonus semanales */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {WEEKLY_BONUSES.map((b) => {
          const n = weekHabitCount(checks, date, b.habit);
          const ok = n >= b.times;
          return (
            <div key={b.habit} className={`rounded-xl border p-3 text-xs ${ok ? "border-done/50 text-done" : "border-line text-neutral-400"}`}>
              <div className="font-semibold">Bonus semanal +{b.points}</div>
              <div className="mt-0.5">
                {b.habit === "gym" ? "Gym" : "Cardio"}: <b className="tabular-nums">{Math.min(n, b.times)}/{b.times}</b>
                {ok && " ✓"}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
