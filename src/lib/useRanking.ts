"use client";
// Ranking actual (vista SQL "leaderboard"), progresión de puntos acumulados día a día
// de cada usuario, y mi posición de hace 7 días para la flecha de tendencia.
// Solo cuenta a los miembros del grupo activo (memberIds); null = todos (sin grupos.sql).
import { useEffect, useState } from "react";
import { COMPETITION_END, COMPETITION_START } from "./constants";
import { addDays, dateRange } from "./dates";
import { dailyPoints, groupChecks } from "./points";
import { fetchSpentPoints } from "./spentPoints";
import { errorES, fetchAll, supabase } from "./supabase";
import type { BonusEvent, HabitCheck, LeaderboardRow } from "./types";

// Una fila por día: { date, [user_id]: acumulado, [`${user_id}__d`]: puntos de ese día }
export type ProgressRow = { date: string } & Record<string, number | string | undefined>;

export function useRanking(userId: string, today: string, refreshKey: number, memberIds: string[] | null, ready: boolean) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clave estable de los miembros (el arreglo cambia de identidad en cada carga)
  const membersKey = memberIds ? [...memberIds].sort().join(",") : null;

  useEffect(() => {
    if (!ready) return;
    const members = membersKey == null ? null : membersKey.split(",").filter(Boolean);
    let alive = true;
    // Al cambiar de grupo, se muestra el spinner en lugar del ranking anterior
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null);
    setProgress(null);
    setError(null);
    (async () => {
      let query = supabase.from("leaderboard").select("*");
      if (members) query = query.in("user_id", members);
      const { data, error } = await query.order("total_points", { ascending: false }).order("display_name");
      if (!alive) return;
      if (error) return setError(errorES(error.message));
      const current = (data ?? []) as LeaderboardRow[];
      setRows(current);
      if (members && current.length === 0) {
        setProgress([]);
        setPrevPosition(null);
        return;
      }
      const ids = current.map((r) => r.user_id);

      // Historial de todos (hábitos y bonus de la carrera) para la gráfica
      try {
        const [checks, bonus, spent] = await Promise.all([
          fetchAll<HabitCheck>((f, t) =>
            supabase
              .from("habit_checks")
              .select("user_id,date,habit_key")
              .in("user_id", ids)
              .gte("date", COMPETITION_START)
              .lte("date", COMPETITION_END)
              .order("id")
              .range(f, t),
          ),
          fetchAll<BonusEvent>((f, t) =>
            supabase.from("bonus_events").select("*").in("user_id", ids).gte("date", COMPETITION_START).lte("date", COMPETITION_END).order("id").range(f, t),
          ),
          fetchSpentPoints(),
        ]);
        if (!alive) return;

        // Puntos por día de cada usuario
        const perUser = new Map(
          current.map((r) => [
            r.user_id,
            dailyPoints(
              groupChecks(checks.filter((c) => c.user_id === r.user_id)),
              [...bonus, ...spent].filter((b) => b.user_id === r.user_id),
            ),
          ]),
        );

        // Acumulado día a día. El eje termina en hoy (o el último día de la carrera):
        // la gráfica se alarga sola conforme pasan los días.
        const lastDay = today > COMPETITION_END ? COMPETITION_END : today < COMPETITION_START ? COMPETITION_START : today;
        const running = new Map(current.map((r) => [r.user_id, 0]));
        const series: ProgressRow[] = dateRange(COMPETITION_START, lastDay).map((date) => {
          const row: ProgressRow = { date };
          for (const r of current) {
            const day = perUser.get(r.user_id)?.[date] ?? 0;
            const total = running.get(r.user_id)! + day;
            running.set(r.user_id, total);
            row[r.user_id] = total;
            row[`${r.user_id}__d`] = day;
          }
          return row;
        });
        setProgress(series);

        // Posición de hace 7 días (solo si ya pasó la primera semana)
        const cutoff = addDays(today, -7);
        const past = series.find((s) => s.date === cutoff);
        if (cutoff < COMPETITION_START || !past) {
          setPrevPosition(null);
        } else {
          const prev = current
            .map((r) => ({ user_id: r.user_id, name: r.display_name, total: Number(past[r.user_id] ?? 0) }))
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
          const idx = prev.findIndex((r) => r.user_id === userId);
          setPrevPosition(idx >= 0 ? idx + 1 : null);
        }
      } catch {
        // La gráfica y la tendencia son opcionales: si fallan, el ranking sigue visible
        if (!alive) return;
        setProgress([]);
        setPrevPosition(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, today, refreshKey, membersKey, ready]);

  return { rows, progress, prevPosition, error };
}
