"use client";
// "Mis hábitos personales" dentro del panel del día: privados, no suman puntos
import { Archive, Check, Plus, Star } from "lucide-react";
import { useState } from "react";
import { ErrorBox, Sheet } from "@/components/ui";
import { isEditableDay } from "@/lib/dates";
import type { CustomChecks } from "@/lib/useCustomHabits";
import type { CustomHabit } from "@/lib/types";

const MAX_NAME = 30;

export default function CustomHabitsSection({
  date,
  today,
  habits,
  checks,
  error,
  onToggle,
  onAdd,
  onArchive,
}: {
  date: string;
  today: string;
  habits: CustomHabit[];
  checks: CustomChecks;
  error: string | null;
  onToggle: (date: string, id: number, on: boolean) => void;
  onAdd: (name: string) => Promise<boolean>;
  onArchive: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Hábito que espera confirmación para archivarse (un segundo toque lo archiva)
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const isFuture = date > today;
  // Antes de ayer queda de solo lectura (igual que los hábitos oficiales)
  const locked = date < today && !isEditableDay(date, today);
  const done = checks[date] ?? new Set<number>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd(name);
    setBusy(false);
    if (ok) {
      setName("");
      setAdding(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-dashed border-line p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="label">Mis hábitos personales</span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-fg3">No suman puntos</span>
      </div>

      {error && (
        <div className="mb-2">
          <ErrorBox message={error} />
        </div>
      )}

      {habits.length === 0 && <p className="px-1 py-2 text-sm text-fg3">Crea hábitos solo para ti, sin puntos ni ranking.</p>}

      <ul className="flex flex-col">
        {habits.map((h) => {
          const on = done.has(h.id);
          return (
            <li key={h.id} className="flex items-center gap-1">
              <button
                disabled={isFuture || locked}
                onClick={() => onToggle(date, h.id, !on)}
                aria-pressed={on}
                className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-150 ease-out enabled:hover:bg-white/[0.04] ${locked ? "disabled:cursor-default" : "disabled:cursor-not-allowed"} ${
                  isFuture ? "opacity-40" : ""
                }`}
              >
                <Star size={16} className={`shrink-0 transition-colors duration-150 ${on ? "text-violet-300" : "text-fg2"}`} />
                <span className={`flex-1 truncate ${on ? "text-violet-300 line-through decoration-violet-300/40" : "text-fg"}`}>{h.name}</span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-dashed transition-colors duration-150 ${
                    on ? "border-violet-300 bg-violet-300 text-black" : "border-zinc-600"
                  }`}
                >
                  {on && <Check size={12} strokeWidth={3} className="animate-check" />}
                </span>
              </button>
              {confirmId === h.id ? (
                <button
                  onClick={() => {
                    setConfirmId(null);
                    onArchive(h.id);
                  }}
                  onBlur={() => setConfirmId(null)}
                  autoFocus
                  className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-danger hover:bg-white/[0.04]"
                >
                  ¿Archivar?
                </button>
              ) : (
                <button onClick={() => setConfirmId(h.id)} className="icon-btn shrink-0" aria-label={`Archivar ${h.name}`} title="Archivar (conserva su historial)">
                  <Archive size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button onClick={() => setAdding(true)} className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-fg2 transition-colors duration-150 hover:bg-white/[0.04] hover:text-fg">
        <Plus size={14} /> Agregar hábito personal
      </button>

      <Sheet open={adding} onClose={() => setAdding(false)} title={<h2 className="text-xl font-semibold tracking-tight">Nuevo hábito personal</h2>}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="label">Nombre</span>
            <input
              className="input"
              autoFocus
              maxLength={MAX_NAME}
              placeholder="Ej. Estirar 10 minutos"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="text-right text-xs tabular-nums text-fg3">
              {name.length}/{MAX_NAME}
            </span>
          </label>
          <p className="text-xs text-fg3">Solo tú lo ves. No suma puntos ni afecta tu racha o el ranking.</p>
          <button className="btn-primary" disabled={!name.trim() || busy}>
            {busy ? "Guardando" : "Crear hábito"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
