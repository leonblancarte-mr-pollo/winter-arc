// Cálculo de puntos, rachas y bonus semanales en el navegador.
// La misma lógica vive en la vista SQL "leaderboard" (para el ranking).
import {
  COMPETITION_END,
  COMPETITION_START,
  HABITS,
  POINTS_PER_HABIT,
  STREAK_MIN_HABITS,
  WEEKLY_BONUSES,
} from "./constants";
import { addDays, dateRange, todayMX, weekStart } from "./dates";
import type { BonusEvent } from "./types";

// Mapa: fecha -> conjunto de hábitos cumplidos
export type ChecksByDate = Record<string, Set<string>>;

export function groupChecks(rows: { date: string; habit_key: string }[]): ChecksByDate {
  const out: ChecksByDate = {};
  for (const r of rows) (out[r.date] ??= new Set()).add(r.habit_key);
  return out;
}

export function countOn(checks: ChecksByDate, date: string) {
  return checks[date]?.size ?? 0;
}

// Cuántas veces se cumplió un hábito en la semana (lunes-domingo) de "date"
export function weekHabitCount(checks: ChecksByDate, date: string, habit: string) {
  const start = weekStart(date);
  let n = 0;
  for (let i = 0; i < 7; i++) if (checks[addDays(start, i)]?.has(habit)) n++;
  return n;
}

// Bonus semanales ganados en una semana (por su lunes)
export function weeklyBonusFor(checks: ChecksByDate, monday: string) {
  let pts = 0;
  for (const b of WEEKLY_BONUSES) if (weekHabitCount(checks, monday, b.habit) >= b.times) pts += b.points;
  return pts;
}

// Lunes de todas las semanas de la carrera
export function competitionWeeks() {
  const weeks: string[] = [];
  for (let m = weekStart(COMPETITION_START); m <= COMPETITION_END; m = addDays(m, 7)) weeks.push(m);
  return weeks;
}

export function totalPoints(checks: ChecksByDate, bonuses: BonusEvent[]) {
  let habits = 0;
  for (const d in checks) habits += checks[d].size * POINTS_PER_HABIT;
  const bonus = bonuses.reduce((s, b) => s + b.points, 0);
  const weekly = competitionWeeks().reduce((s, w) => s + weeklyBonusFor(checks, w), 0);
  return { habits, bonus, weekly, total: habits + bonus + weekly };
}

// Puntos de hoy: hábitos de hoy + bonus con fecha de hoy
export function pointsOn(checks: ChecksByDate, bonuses: BonusEvent[], date: string) {
  return countOn(checks, date) * POINTS_PER_HABIT + bonuses.filter((b) => b.date === date).reduce((s, b) => s + b.points, 0);
}

// Racha actual: días seguidos con 5+/7 hasta ayer; hoy se suma si ya llegó a 5.
export function currentStreak(checks: ChecksByDate, today = todayMX()) {
  const ok = (d: string) => countOn(checks, d) >= STREAK_MIN_HABITS;
  let streak = ok(today) ? 1 : 0;
  for (let d = addDays(today, -1); d >= COMPETITION_START; d = addDays(d, -1)) {
    if (!ok(d)) break;
    streak++;
  }
  return streak;
}

export function bestStreak(checks: ChecksByDate, today = todayMX()) {
  const end = today < COMPETITION_END ? today : COMPETITION_END;
  if (end < COMPETITION_START) return 0;
  let best = 0;
  let run = 0;
  for (const d of dateRange(COMPETITION_START, end)) {
    run = countOn(checks, d) >= STREAK_MIN_HABITS ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// Puntos por semana (hábitos + bonus + bonus semanales)
export function pointsByWeek(checks: ChecksByDate, bonuses: BonusEvent[]) {
  return competitionWeeks().map((monday) => {
    let habits = 0;
    for (let i = 0; i < 7; i++) habits += countOn(checks, addDays(monday, i)) * POINTS_PER_HABIT;
    const bonus = bonuses.filter((b) => weekStart(b.date) === monday).reduce((s, b) => s + b.points, 0);
    const weekly = weeklyBonusFor(checks, monday);
    return { monday, habits, bonus: bonus + weekly, total: habits + bonus + weekly };
  });
}

export const HABIT_KEYS = HABITS.map((h) => h.key);
