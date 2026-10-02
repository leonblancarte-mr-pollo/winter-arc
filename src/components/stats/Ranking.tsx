"use client";
// Ranking de la carrera: puntos acumulados día a día, una línea por usuario
import { Crown } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorBox, Spinner } from "@/components/ui";
import { CHART_COLORS } from "@/lib/constants";
import { longLabel, shortLabel } from "@/lib/dates";
import type { LeaderboardRow } from "@/lib/types";
import type { ProgressRow } from "@/lib/useRanking";
import { axisProps, gridStroke } from "./chartTheme";

const ME_COLOR = CHART_COLORS.cyan;
const OTHER_COLORS = [CHART_COLORS.green, CHART_COLORS.violet, CHART_COLORS.pink, CHART_COLORS.orange];
const X_TICKS = ["2026-10-01", "2026-10-15", "2026-11-01", "2026-11-15", "2026-12-01", "2026-12-15", "2026-12-31"];

// Colores: yo siempre cian. Hasta 5 personas se usan los del dashboard;
// con más, se generan tonos repartidos que no se parezcan al cian.
function assignColors(rows: LeaderboardRow[], userId: string) {
  const others = rows.filter((r) => r.user_id !== userId);
  const colors: Record<string, string> = { [userId]: ME_COLOR };
  others.forEach((r, i) => {
    if (rows.length <= 5) {
      colors[r.user_id] = OTHER_COLORS[i];
    } else {
      let hue = (20 + i * 137.508) % 360; // ángulo dorado: tonos bien separados
      if (Math.abs(hue - 199) < 30) hue = (hue + 60) % 360; // lejos del cian (199°)
      colors[r.user_id] = `hsl(${Math.round(hue)} 75% 62%)`;
    }
  });
  return colors;
}

export default function Ranking({
  rows,
  progress,
  userId,
  error,
}: {
  rows: LeaderboardRow[] | null;
  progress: ProgressRow[] | null;
  userId: string;
  error: string | null;
}) {
  const [focus, setFocus] = useState<string | null>(null);

  if (error) return <ErrorBox message={`No se pudo cargar el ranking: ${error}`} />;
  if (!rows) return <Spinner label="Cargando ranking" />;

  const myIdx = rows.findIndex((r) => r.user_id === userId);
  const me = rows[myIdx];
  const ahead = myIdx > 0 ? rows[myIdx - 1] : null;
  const last = rows.length - 1;
  const colors = assignColors(rows, userId);
  const names = Object.fromEntries(rows.map((r) => [r.user_id, r.display_name]));
  // Mi línea se dibuja al final para quedar encima
  const drawOrder = [...rows.filter((r) => r.user_id !== userId), ...rows.filter((r) => r.user_id === userId)];

  return (
    <div className="card">
      {me && (
        <p className="mb-4 text-fg2">
          {myIdx === 0
            ? rows[1]
              ? `Vas en primer lugar, ${me.total_points - rows[1].total_points} pts arriba de ${rows[1].display_name}.`
              : "Vas en primer lugar."
            : `Te faltan ${ahead!.total_points - me.total_points + 1} pts para pasar a ${ahead!.display_name}.`}
        </p>
      )}

      {!progress ? (
        <Spinner label="Cargando progresión" />
      ) : progress.length === 0 ? (
        <p className="py-8 text-center text-fg3">No se pudo cargar la progresión de puntos.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={progress} margin={{ left: -16, right: 24, top: 8 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis dataKey="date" {...axisProps} ticks={X_TICKS} tickFormatter={shortLabel} interval={0} minTickGap={8} />
            <YAxis {...axisProps} allowDecimals={false} width={48} />
            <Tooltip
              content={(p) => <ProgressTooltip active={p.active} payload={p.payload} names={names} colors={colors} userId={userId} />}
              cursor={{ stroke: "rgba(255,255,255,0.15)" }}
            />
            {drawOrder.map((r) => {
              const mine = r.user_id === userId;
              const dimmed = focus != null && focus !== r.user_id;
              return (
                <Line
                  key={r.user_id}
                  type="monotone"
                  dataKey={r.user_id}
                  name={r.display_name}
                  stroke={colors[r.user_id]}
                  strokeWidth={mine ? 3 : 1.5}
                  strokeOpacity={dimmed ? 0.15 : mine ? 1 : 0.8}
                  dot={false}
                  activeDot={{ r: mine ? 4 : 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Posiciones (también sirve de leyenda: toca un nombre para resaltar su línea) */}
      <ol className="mt-4 flex flex-wrap gap-2">
        {rows.map((r, i) => {
          const mine = r.user_id === userId;
          const active = focus === r.user_id;
          return (
            <li key={r.user_id}>
              <button
                type="button"
                onClick={() => setFocus(active ? null : r.user_id)}
                onMouseEnter={() => setFocus(r.user_id)}
                onMouseLeave={() => setFocus(null)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors duration-150 ease-out hover:bg-white/[0.04] ${
                  mine ? "border-accent/30 bg-white/[0.06]" : "border-line"
                }`}
              >
                <span className="tabular-nums text-fg3">{i + 1}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: colors[r.user_id] }} />
                <span className={mine ? "font-semibold text-fg" : "text-fg"}>{r.display_name}</span>
                {i === 0 && <Crown size={12} className="text-accent" aria-label="Líder" />}
                <span className="tabular-nums text-fg2">{r.total_points}</span>
                {i === last && rows.length > 1 && <span className="text-[10px] uppercase tracking-[0.05em] text-fg3">Último</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Tooltip: fecha y, por usuario, puntos acumulados y puntos ganados ese día
function ProgressTooltip({
  active,
  payload,
  names,
  colors,
  userId,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; payload?: unknown }[];
  names: Record<string, string>;
  colors: Record<string, string>;
  userId: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ProgressRow;
  const entries = payload
    .map((p) => String(p.dataKey))
    .filter((id) => row[id] != null)
    .sort((a, b) => Number(row[b]) - Number(row[a]));
  if (!entries.length) return null;
  return (
    <div className="min-w-48 rounded-lg border border-line bg-surface p-3 text-xs shadow-none">
      <div className="mb-2 text-fg2 first-letter:uppercase">{longLabel(row.date)}</div>
      <ul className="flex flex-col gap-1">
        {entries.map((id) => {
          const day = Number(row[`${id}__d`] ?? 0);
          return (
            <li key={id} className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[id] }} />
              <span className={`flex-1 truncate ${id === userId ? "font-semibold text-fg" : "text-fg"}`}>{names[id]}</span>
              <span className="tabular-nums text-fg">{Number(row[id])} pts</span>
              <span className={`w-10 text-right tabular-nums ${day > 0 ? "text-done" : "text-fg3"}`}>+{day}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
