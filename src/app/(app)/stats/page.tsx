"use client";
// PANTALLA 2: Stats (dashboard)
import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Activities from "@/components/stats/Activities";
import Gym from "@/components/stats/Gym";
import MyProgress from "@/components/stats/MyProgress";
import Ranking from "@/components/stats/Ranking";
import { ErrorBox, Spinner } from "@/components/ui";
import { todayMX } from "@/lib/dates";
import { useMyData } from "@/lib/useMyData";

export default function StatsPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const today = todayMX();
  const { checks, bonuses, loading, error, reload, markLocal } = useMyData(userId);
  const [rankKey, setRankKey] = useState(0);

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
      <header className="mb-2">
        <p className="text-xs uppercase tracking-[0.2em] text-ice">Winter Arc</p>
        <h1 className="text-2xl font-black">Stats</h1>
      </header>

      <Ranking userId={userId} refreshKey={rankKey} />

      {error && (
        <div className="mt-4">
          <ErrorBox message={error} onRetry={reload} />
        </div>
      )}
      {loading ? <Spinner /> : <MyProgress checks={checks} bonuses={bonuses} today={today} />}

      <Activities userId={userId} today={today} />
      <Gym userId={userId} today={today} onGymDaysMarked={onGymDaysMarked} />
    </main>
  );
}
