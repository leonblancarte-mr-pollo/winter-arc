"use client";
// Ranking de la carrera: puntos acumulados día a día, una línea por usuario
import { Crown } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, usePlotArea, useXAxisScale, useYAxisScale, XAxis, YAxis } from "recharts";
import { ErrorBox, Spinner } from "@/components/ui";
import { CHART_COLORS } from "@/lib/constants";
import { longLabel, shortLabel } from "@/lib/dates";
import type { AvatarOverride, LeaderboardRow } from "@/lib/types";
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
  const avatars = Object.fromEntries(rows.map((r) => [r.user_id, r.avatar_override ?? null]));
  // Último día con datos (hoy, o el 31 de diciembre si ya terminó la carrera)
  const lastRow = progress ? [...progress].reverse().find((p) => rows.some((r) => p[r.user_id] != null)) : undefined;
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
          <LineChart data={progress} margin={{ left: -16, right: 24, top: 12 }}>
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
            {lastRow && <EndLabels row={lastRow} rows={drawOrder} colors={colors} names={names} avatars={avatars} userId={userId} focus={focus} />}
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
                <span className={mine ? "font-semibold text-fg" : "text-fg"}>
                  {r.avatar_override === "burro" ? "🫏 " : ""}
                  {r.display_name}
                </span>
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

// Etiquetas fijas al final de cada línea (nombre + puntos), sin necesidad de pasar el cursor.
// Si dos quedan muy cerca, se separan verticalmente y una línea guía las une a su punto.
const LABEL_GAP = 14; // px mínimos entre etiquetas
const LABEL_SPACE = 120; // px que necesita una etiqueta a la derecha del punto

function EndLabels({
  row,
  rows,
  colors,
  names,
  avatars,
  userId,
  focus,
}: {
  row: ProgressRow;
  rows: LeaderboardRow[];
  colors: Record<string, string>;
  names: Record<string, string>;
  avatars: Record<string, AvatarOverride>;
  userId: string;
  focus: string | null;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  if (!xScale || !yScale || !plot) return null;

  const x = xScale(row.date);
  if (x == null) return null;
  // Si el punto está cerca del borde derecho, la etiqueta va a su izquierda
  const toLeft = x + LABEL_SPACE > plot.x + plot.width + 24;

  // Posición real del último punto de cada línea, de arriba hacia abajo
  const items = rows
    .map((r) => {
      const value = Number(row[r.user_id] ?? 0);
      const y = yScale(value) ?? 0;
      return { id: r.user_id, value, pointY: y, labelY: y };
    })
    .sort((a, b) => a.pointY - b.pointY);

  // 1) De arriba hacia abajo: empuja hacia abajo las que se enciman
  for (let i = 1; i < items.length; i++) {
    items[i].labelY = Math.max(items[i].labelY, items[i - 1].labelY + LABEL_GAP);
  }
  // 2) De abajo hacia arriba: que ninguna se salga por abajo de la gráfica
  const bottom = plot.y + plot.height;
  for (let i = items.length - 1; i >= 0; i--) {
    const max = i === items.length - 1 ? bottom : items[i + 1].labelY - LABEL_GAP;
    items[i].labelY = Math.min(items[i].labelY, max);
  }

  const dx = toLeft ? -8 : 8;
  return (
    <g pointerEvents="none">
      {items.map((it) => {
        const color = colors[it.id];
        const dimmed = focus != null && focus !== it.id;
        const mine = it.id === userId;
        const raw = names[it.id] ?? "";
        const name = raw.length > 10 ? raw.slice(0, 9) + "…" : raw;
        const moved = Math.abs(it.labelY - it.pointY) > 1;
        return (
          <g key={it.id} opacity={dimmed ? 0.15 : 1}>
            <circle cx={x} cy={it.pointY} r={mine ? 4 : 3} fill={color} />
            {moved && <line x1={x} y1={it.pointY} x2={x + dx * 0.75} y2={it.labelY} stroke={color} strokeWidth={1} strokeOpacity={0.6} />}
            <text
              x={x + dx}
              y={it.labelY}
              dy="0.35em"
              textAnchor={toLeft ? "end" : "start"}
              fontSize={11}
              fontWeight={mine ? 600 : 500}
              fill={color}
              stroke="#0a0a0a"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {avatars[it.id] === "burro" ? "🫏 " : ""}
              {name} {it.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}
