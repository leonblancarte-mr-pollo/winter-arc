"use client";
// Ranking actual (vista SQL "leaderboard") + mi posición de hace 7 días para la flecha de tendencia
import { useEffect, useState } from "react";
import { COMPETITION_START } from "./constants";
import { addDays } from "./dates";
import { groupChecks, totalPoints } from "./points";
import { errorES, fetchAll, supabase } from "./supabase";
import type { BonusEvent, HabitCheck, LeaderboardRow } from "./types";

export function useRanking(userId: string, today: string, refreshKey: number) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [prevPosition, setPrevPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("total_points", { ascending: false })
        .order("display_name");
      if (!alive) return;
      if (error) return setError(errorES(error.message));
      const current = (data ?? []) as LeaderboardRow[];
      setRows(current);

      // Posición de hace 7 días (solo si ya pasó la primera semana)
      const cutoff = addDays(today, -7);
      if (cutoff < COMPETITION_START) return setPrevPosition(null);
      try {
        const [checks, bonus] = await Promise.all([
          fetchAll<HabitCheck>((f, t) =>
            supabase.from("habit_checks").select("user_id,date,habit_key").lte("date", cutoff).order("id").range(f, t),
          ),
          fetchAll<BonusEvent>((f, t) => supabase.from("bonus_events").select("*").lte("date", cutoff).order("id").range(f, t)),
        ]);
        if (!alive) return;
        const prev = current
          .map((r) => ({
            user_id: r.user_id,
            name: r.display_name,
            total: totalPoints(
              groupChecks(checks.filter((c) => c.user_id === r.user_id)),
              bonus.filter((b) => b.user_id === r.user_id),
            ).total,
          }))
          .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
        const idx = prev.findIndex((r) => r.user_id === userId);
        setPrevPosition(idx >= 0 ? idx + 1 : null);
      } catch {
        // La tendencia es opcional: si falla, solo no se muestra
        setPrevPosition(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, today, refreshKey]);

  return { rows, prevPosition, error };
}
