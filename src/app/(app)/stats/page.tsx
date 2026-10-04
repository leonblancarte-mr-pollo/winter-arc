"use client";
// PANTALLA 2: Stats (dashboard)
import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useGroups } from "@/components/GroupProvider";
import GroupSwitcher from "@/components/GroupSwitcher";
import Activities from "@/components/stats/Activities";
import Gym from "@/components/stats/Gym";
import { CustomCompliance, HabitCompliance, Heatmap, SecondaryStats, SummaryCards, WeeklyPoints } from "@/components/stats/MyProgress";
import Ranking from "@/components/stats/Ranking";
import { ErrorBox, Notice, SectionTitle, Spinner } from "@/components/ui";
import { todayMX } from "@/lib/dates";
import { useCustomHabits } from "@/lib/useCustomHabits";
import { useMyData } from "@/lib/useMyData";
import { useRanking } from "@/lib/useRanking";

export default function StatsPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const today = todayMX();
  const { checks, pointEvents: bonuses, loading, error, reload, markLocal } = useMyData(userId);
  const custom = useCustomHabits(userId);
  const [rankKey, setRankKey] = useState(0);
  // El ranking solo cuenta a los miembros del grupo activo (sin grupos.sql: a todos)
  const group = useGroups();
  const rankingReady = !group.loading && (!group.enabled || group.memberIds != null);
  const ranking = useRanking(userId, today, rankKey, group.enabled ? group.memberIds : null, rankingReady);
  const noGroup = group.enabled && !group.loading && !group.active;

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
      <GroupSwitcher />
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
      {noGroup ? (
        <Notice>Únete a un grupo con el botón de arriba para ver el ranking de tu grupo.</Notice>
      ) : (
        <Ranking rows={ranking.rows} progress={ranking.progress} userId={userId} error={ranking.error} />
      )}

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

          {custom.habits.length > 0 && (
            <>
              <SectionTitle>Mis hábitos personales</SectionTitle>
              <p className="-mt-2 mb-4 text-xs text-fg3">Solo tú los ves. No suman puntos ni cuentan para el ranking.</p>
              <CustomCompliance habits={custom.habits} checks={custom.checks} today={today} />
            </>
          )}
        </>
      )}

      <h2 className="display mb-2 mt-16 text-4xl">Mi actividad</h2>
      <p className="text-fg2">Kilómetros que registras al tachar Cardio en el calendario y entrenamientos importados de Hevy.</p>
      <Activities userId={userId} />
      <Gym userId={userId} today={today} onGymDaysMarked={onGymDaysMarked} />
    </main>
  );
}
