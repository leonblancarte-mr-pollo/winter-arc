"use client";
// PANTALLA 2: Stats (dashboard)
import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Activities from "@/components/stats/Activities";
import Gym from "@/components/stats/Gym";
import { HabitCompliance, Heatmap, SecondaryStats, SummaryCards, WeeklyPoints } from "@/components/stats/MyProgress";
import Ranking from "@/components/stats/Ranking";
import { ErrorBox, SectionTitle, Spinner } from "@/components/ui";
import { todayMX } from "@/lib/dates";
import { useMyData } from "@/lib/useMyData";
import { useRanking } from "@/lib/useRanking";

export default function StatsPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const today = todayMX();
  const { checks, bonuses, loading, error, reload, markLocal } = useMyData(userId);
  const [rankKey, setRankKey] = useState(0);
  const ranking = useRanking(userId, today, rankKey);

  const myIdx = ranking.rows?.findIndex((r) => r.user_id === userId) ?? -1;
  const position = myIdx >= 0 ? myIdx + 1 : null;

  // Cuando Hevy marca días de gym, actualiza mis números y el ranking
  const onGymDaysMarked = useCallback(
    (dates: string[]) => {
      dates.forEach((d) => markLocal(d, "gym"));
      setRankKey((k) => k + 1);
    },
    [markLocal],
  );

  return (
    <main>
      <h1 className="display mb-8 text-5xl">Stats</h1>

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={reload} />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <SummaryCards
            checks={checks}
            bonuses={bonuses}
            today={today}
            position={position}
            prevPosition={ranking.prevPosition}
            participants={ranking.rows?.length ?? 0}
          />
          <SecondaryStats checks={checks} bonuses={bonuses} today={today} />
        </>
      )}

      <SectionTitle>Ranking de la carrera</SectionTitle>
      <Ranking rows={ranking.rows} userId={userId} error={ranking.error} />

      {!loading && (
        <>
          <div className="grid grid-cols-1 items-start gap-x-4 md:grid-cols-2">
            <section className="min-w-0">
              <SectionTitle>Cumplimiento por hábito</SectionTitle>
              <HabitCompliance checks={checks} today={today} />
            </section>
            <section className="min-w-0">
              <SectionTitle>Puntos por semana</SectionTitle>
              <WeeklyPoints checks={checks} bonuses={bonuses} />
            </section>
          </div>

          <SectionTitle>Mapa de calor</SectionTitle>
          <Heatmap checks={checks} today={today} />
        </>
      )}

      <h2 className="display mb-2 mt-16 text-4xl">Mi actividad</h2>
      <p className="text-fg2">Kilómetros que registras a mano y entrenamientos importados de Hevy.</p>
      <Activities userId={userId} today={today} />
      <Gym userId={userId} today={today} onGymDaysMarked={onGymDaysMarked} />
    </main>
  );
}
