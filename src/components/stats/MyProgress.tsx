"use client";
// 2) Mis números, 3) Cumplimiento por hábito, 4) Puntos por semana, 5) Mapa de calor
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import HabitIcon from "@/components/HabitIcon";
import { SectionTitle, Stat } from "@/components/ui";
import { CHART_COLORS, COMPETITION_END, COMPETITION_START, HABITS } from "@/lib/constants";
import { addDays, elapsedCompetitionDays, longLabel, shortLabel, weekStart } from "@/lib/dates";
import {
  bestStreak,
  countOn,
  currentStreak,
  pointsByWeek,
  pointsOn,
  totalPoints,
  type ChecksByDate,
} from "@/lib/points";
import type { BonusEvent } from "@/lib/types";
import { axisProps, tooltipStyle } from "./chartTheme";

const HABIT_COLORS = [CHART_COLORS.cyan, CHART_COLORS.green, CHART_COLORS.violet, CHART_COLORS.orange, CHART_COLORS.magenta, "#60a5fa", CHART_COLORS.gold];

export default function MyProgress({ checks, bonuses, today }: { checks: ChecksByDate; bonuses: BonusEvent[]; today: string }) {
  const pts = totalPoints(checks, bonuses);
  const elapsed = elapsedCompetitionDays(today);
  const totalChecks = elapsed.reduce((s, d) => s + countOn(checks, d), 0);
  const pct = elapsed.length ? Math.round((totalChecks / (elapsed.length * HABITS.length)) * 100) : 0;

  const perHabit = HABITS.map((h, i) => {
    const n = elapsed.filter((d) => checks[d]?.has(h.key)).length;
    return { ...h, n, pct: elapsed.length ? Math.round((n / elapsed.length) * 100) : 0, color: HABIT_COLORS[i % HABIT_COLORS.length] };
  });

  const weekly = pointsByWeek(checks, bonuses).map((w) => ({
    semana: shortLabel(w.monday < COMPETITION_START ? COMPETITION_START : w.monday),
    Hábitos: w.habits,
    Bonus: w.bonus,
    future: w.monday > today,
  }));

  return (
    <>
      <SectionTitle>Mis números</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Puntos totales" value={pts.total} color={CHART_COLORS.cyan} sub={`${pts.habits} hábitos · ${pts.bonus + pts.weekly} bonus`} />
        <Stat label="Puntos de hoy" value={pointsOn(checks, bonuses, today)} color={CHART_COLORS.green} />
        <Stat label="Racha actual" value={currentStreak(checks, today)} color={CHART_COLORS.orange} sub="días con 5+ hábitos" />
        <Stat label="Mejor racha" value={bestStreak(checks, today)} color={CHART_COLORS.magenta} sub="días" />
        <Stat label="Cumplimiento" value={`${pct}%`} color={CHART_COLORS.violet} sub={`${totalChecks} de ${elapsed.length * HABITS.length} hábitos`} />
      </div>

      <SectionTitle>Cumplimiento por hábito</SectionTitle>
      <div className="card flex flex-col gap-3">
        {perHabit.map((h) => (
          <div key={h.key}>
            <div className="mb-1 flex items-center gap-2 text-sm">
              <HabitIcon name={h.icon} size={16} style={{ color: h.color }} />
              <span className="flex-1">{h.short}</span>
              <span className="font-bold tabular-nums" style={{ color: h.color }}>
                {h.pct}%
              </span>
              <span className="w-14 text-right text-xs text-neutral-500 tabular-nums">
                {h.n}/{elapsed.length} días
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-card2">
              <div className="h-full rounded-full transition-all" style={{ width: `${h.pct}%`, background: h.color, boxShadow: `0 0 10px ${h.color}88` }} />
            </div>
          </div>
        ))}
      </div>

      <SectionTitle>Puntos por semana</SectionTitle>
      <div className="card">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekly} margin={{ left: -20, right: 4, top: 8 }}>
            <CartesianGrid stroke="#1f1f1f" vertical={false} />
            <XAxis dataKey="semana" {...axisProps} interval={1} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => `Semana del ${l}`} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#aaa" }} />
            <Bar dataKey="Hábitos" stackId="a" fill={CHART_COLORS.cyan} />
            <Bar dataKey="Bonus" stackId="a" fill={CHART_COLORS.magenta} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>Mapa de calor</SectionTitle>
      <Heatmap checks={checks} today={today} />
    </>
  );
}

// Mapa tipo "contribuciones de GitHub": columnas = semanas, filas = lunes a domingo
function Heatmap({ checks, today }: { checks: ChecksByDate; today: string }) {
  const weeks: string[][] = [];
  for (let m = weekStart(COMPETITION_START); m <= COMPETITION_END; m = addDays(m, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(m, i)));
  }
  const color = (n: number) => {
    if (n === 0) return "#1a1a1a";
    if (n === 7) return "#39ff88";
    const alpha = 0.2 + (n / 7) * 0.7;
    return `rgba(34, 211, 238, ${alpha})`;
  };
  const monthLabel = (w: string[]) => {
    const first = w.find((d) => d.endsWith("-01") || d === COMPETITION_START);
    if (!first || first < COMPETITION_START) return "";
    return ["Oct", "Nov", "Dic"][Number(first.slice(5, 7)) - 10] ?? "";
  };

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <div className="flex min-w-fit gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-4 text-[10px] text-neutral-500">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} className="flex h-[18px] items-center">{i % 2 === 0 ? d : ""}</div>
            ))}
          </div>
          {weeks.map((w) => (
            <div key={w[0]} className="flex flex-col gap-[3px]">
              <div className="h-4 text-[10px] text-neutral-500">{monthLabel(w)}</div>
              {w.map((d) => {
                const inside = d >= COMPETITION_START && d <= COMPETITION_END;
                const n = countOn(checks, d);
                return (
                  <div
                    key={d}
                    title={inside ? `${longLabel(d)}: ${n}/7` : ""}
                    className={`h-[18px] w-[18px] rounded-[4px] ${d === today ? "ring-1 ring-white" : ""}`}
                    style={{ background: inside ? (d > today ? "#0d0d0d" : color(n)) : "transparent" }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-neutral-500">
        Menos
        {[0, 2, 4, 6, 7].map((n) => (
          <span key={n} className="h-3 w-3 rounded-[3px]" style={{ background: color(n) }} />
        ))}
        Más
      </div>
    </div>
  );
}
