"use client";
// Tarjetas de números, cumplimiento por hábito, puntos por semana y mapa de calor
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import HabitIcon from "@/components/HabitIcon";
import { ChartLegend, Trend } from "@/components/ui";
import { CHART_COLORS, COMPETITION_END, COMPETITION_START, HABITS } from "@/lib/constants";
import { addDays, elapsedCompetitionDays, longLabel, shortLabel, weekStart } from "@/lib/dates";
import {
  bestStreak,
  bonusesUpTo,
  checksUpTo,
  countOn,
  currentStreak,
  pointsByWeek,
  pointsOn,
  totalPoints,
  type ChecksByDate,
  type PointEvent,
} from "@/lib/points";

import { axisProps, gridStroke, tooltipStyle } from "./chartTheme";

type Props = { checks: ChecksByDate; bonuses: PointEvent[]; today: string };

// ---------- Fila superior: puntos, racha y posición con tendencia ----------
export function SummaryCards({
  checks,
  bonuses,
  today,
  position,
  prevPosition,
  participants,
}: Props & { position: number | null; prevPosition: number | null; participants: number }) {
  const cutoff = addDays(today, -7);
  const hasPrev = cutoff >= COMPETITION_START;
  const pts = totalPoints(checks, bonuses).total;
  const streak = currentStreak(checks, today);
  const ptsDelta = hasPrev ? pts - totalPoints(checksUpTo(checks, cutoff), bonusesUpTo(bonuses, cutoff)).total : null;
  const streakDelta = hasPrev ? streak - currentStreak(checksUpTo(checks, cutoff), cutoff) : null;
  const posDelta = position != null && prevPosition != null ? prevPosition - position : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <BigStat label="Puntos totales" value={pts} trend={<Trend delta={ptsDelta} suffix=" pts" />} />
      <BigStat label="Racha actual" value={streak} unit={streak === 1 ? "día" : "días"} trend={<Trend delta={streakDelta} />} />
      <BigStat
        label="Posición"
        value={position != null ? `${position}°` : "–"}
        unit={participants ? `de ${participants}` : undefined}
        trend={<Trend delta={posDelta} suffix={Math.abs(posDelta ?? 0) === 1 ? " lugar" : " lugares"} />}
      />
    </div>
  );
}

function BigStat({ label, value, unit, trend }: { label: string; value: React.ReactNode; unit?: string; trend: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="label">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="display text-6xl">{value}</span>
        {unit && <span className="text-fg2">{unit}</span>}
      </div>
      {trend}
    </div>
  );
}

// ---------- Números secundarios ----------
export function SecondaryStats({ checks, bonuses, today }: Props) {
  const elapsed = elapsedCompetitionDays(today);
  const totalChecks = elapsed.reduce((s, d) => s + countOn(checks, d), 0);
  const possible = elapsed.length * HABITS.length;
  const pct = possible ? Math.round((totalChecks / possible) * 100) : 0;
  const items = [
    { label: "Puntos de hoy", value: pointsOn(checks, bonuses, today), sub: `${countOn(checks, today)} de ${HABITS.length} hábitos` },
    { label: "Mejor racha", value: bestStreak(checks, today), sub: "días seguidos" },
    { label: "Cumplimiento", value: `${pct}%`, sub: `${totalChecks} de ${possible} hábitos` },
  ];
  return (
    <div className="card mt-3 grid grid-cols-3 divide-x divide-white/[0.06] p-0">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-1 px-4 py-4">
          <span className="label">{it.label}</span>
          <span className="display text-3xl">{it.value}</span>
          <span className="text-xs text-fg3">{it.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Cumplimiento por hábito ----------
export function HabitCompliance({ checks, today }: Omit<Props, "bonuses">) {
  const elapsed = elapsedCompetitionDays(today);
  const perHabit = HABITS.map((h) => {
    const n = elapsed.filter((d) => checks[d]?.has(h.key)).length;
    return { ...h, n, pct: elapsed.length ? Math.round((n / elapsed.length) * 100) : 0 };
  });
  return (
    <div className="card flex flex-col gap-4">
      {perHabit.map((h) => (
        <div key={h.key}>
          <div className="mb-2 flex items-center gap-2">
            <HabitIcon name={h.icon} size={16} className="text-fg2" />
            <span className="flex-1 truncate">{h.short}</span>
            <span className="font-medium tabular-nums">{h.pct}%</span>
            <span className="w-16 text-right text-xs tabular-nums text-fg3">
              {h.n}/{elapsed.length} días
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${h.pct}%`, background: CHART_COLORS.cyan }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Puntos por semana ----------
export function WeeklyPoints({ checks, bonuses }: Omit<Props, "today">) {
  const weekly = pointsByWeek(checks, bonuses).map((w) => ({
    semana: shortLabel(w.monday < COMPETITION_START ? COMPETITION_START : w.monday),
    Hábitos: w.habits,
    Bonus: w.bonus,
  }));
  return (
    <div className="card min-w-0">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={weekly} margin={{ left: -20, right: 4, top: 8 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="semana" {...axisProps} interval={2} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => `Semana del ${l}`} />
          <Bar dataKey="Hábitos" stackId="a" fill={CHART_COLORS.cyan} />
          <Bar dataKey="Bonus" stackId="a" fill={CHART_COLORS.pink} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { label: "Hábitos", color: CHART_COLORS.cyan },
          { label: "Bonus", color: CHART_COLORS.pink },
        ]}
      />
    </div>
  );
}

// ---------- Mapa de calor (columnas = semanas, filas = lunes a domingo) ----------
// 5 tonos: de zinc-900 (nada) a emerald-500 (día completo)
const HEAT = ["#18181b", "#064e3b", "#047857", "#059669", "#10b981"];
function heatLevel(n: number) {
  if (n === 0) return 0;
  const max = HABITS.length;
  if (n >= max) return 4;
  return Math.min(3, Math.ceil((n / max) * 3)); // 1–3 para días parciales
}

export function Heatmap({ checks, today }: Omit<Props, "bonuses">) {
  const weeks: string[][] = [];
  for (let m = weekStart(COMPETITION_START); m <= COMPETITION_END; m = addDays(m, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(m, i)));
  }
  const monthLabel = (w: string[]) => {
    const first = w.find((d) => d.endsWith("-01") || d === COMPETITION_START);
    if (!first || first < COMPETITION_START) return "";
    return ["Oct", "Nov", "Dic"][Number(first.slice(5, 7)) - 10] ?? "";
  };

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <div className="mx-auto flex w-fit gap-1">
          <div className="mr-1 flex flex-col gap-1 pt-6 text-[10px] leading-3 text-fg3">
            {["L", "", "M", "", "V", "", "D"].map((d, i) => (
              <div key={i} className="h-3">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((w) => (
            <div key={w[0]} className="flex flex-col gap-1">
              <div className="h-5 text-[10px] text-fg3">{monthLabel(w)}</div>
              {w.map((d) => {
                const inside = d >= COMPETITION_START && d <= COMPETITION_END;
                const n = countOn(checks, d);
                const future = d > today;
                return (
                  <div
                    key={d}
                    title={inside ? `${longLabel(d)}: ${n} de ${HABITS.length}` : undefined}
                    className={`h-3 w-3 rounded-[3px] ${d === today ? "outline outline-1 outline-offset-1 outline-accent" : ""}`}
                    style={{ background: !inside ? "transparent" : future ? "#0f0f11" : HEAT[heatLevel(n)] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-1 text-[10px] text-fg3">
        <span className="mr-1">Menos</span>
        {HEAT.map((c) => (
          <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
        ))}
        <span className="ml-1">Más</span>
      </div>
    </div>
  );
}
