"use client";
// Ranking de la carrera: filas con posición, nombre, puntos y barra horizontal
import { Crown } from "lucide-react";
import { ErrorBox, Spinner } from "@/components/ui";
import type { LeaderboardRow } from "@/lib/types";

export default function Ranking({ rows, userId, error }: { rows: LeaderboardRow[] | null; userId: string; error: string | null }) {
  if (error) return <ErrorBox message={`No se pudo cargar el ranking: ${error}`} />;
  if (!rows) return <Spinner label="Cargando ranking" />;

  const max = Math.max(1, ...rows.map((r) => r.total_points));
  const myIdx = rows.findIndex((r) => r.user_id === userId);
  const me = rows[myIdx];
  const ahead = myIdx > 0 ? rows[myIdx - 1] : null;
  const last = rows.length - 1;

  return (
    <div className="card p-2 sm:p-4">
      {me && (
        <p className="px-2 pb-4 pt-2 text-fg2">
          {myIdx === 0
            ? rows[1]
              ? `Vas en primer lugar, ${me.total_points - rows[1].total_points} pts arriba de ${rows[1].display_name}.`
              : "Vas en primer lugar."
            : `Te faltan ${ahead!.total_points - me.total_points + 1} pts para pasar a ${ahead!.display_name}.`}
        </p>
      )}
      <ol className="flex flex-col">
        {rows.map((r, i) => {
          const mine = r.user_id === userId;
          const isLast = i === last && rows.length > 1;
          return (
            <li
              key={r.user_id}
              className={`grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-4 rounded-lg px-2 py-2 sm:grid-cols-[minmax(0,14rem)_1fr] ${
                mine ? "bg-white/[0.06]" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${
                    i === 0 ? "border-accent/40 text-accent" : "border-line text-fg2"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`truncate ${mine ? "font-semibold text-fg" : "text-fg"}`}>{r.display_name}</span>
                {i === 0 && <Crown size={16} className="shrink-0 text-accent" aria-label="Líder" />}
                {isLast && <span className="shrink-0 rounded-full border border-line px-2 text-[10px] uppercase tracking-[0.05em] text-fg3">Último</span>}
                <span className="ml-auto shrink-0 pl-2 font-medium tabular-nums text-fg">{r.total_points}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ease-out ${mine ? "bg-accent" : "bg-accent/60"}`}
                  style={{ width: `${(r.total_points / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
