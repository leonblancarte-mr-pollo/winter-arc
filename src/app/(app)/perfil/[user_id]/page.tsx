"use client";
// Perfil público de otra persona (solo lectura): su calendario, sus bonus y su posición.
// Todo viene de tablas que cualquier usuario con sesión puede leer (ver migracion.sql, sección 7).
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Footprints, Medal } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DaySheet from "@/components/calendar/DaySheet";
import UserAvatar from "@/components/UserAvatar";
import { ErrorBox, Ring, SectionTitle, Spinner } from "@/components/ui";
import { ACTIVITY_TYPES, COMPETITION_END, COMPETITION_MONTHS, COMPETITION_START, HABITS } from "@/lib/constants";
import { daysInMonth, MONTH_NAMES, shortLabel, todayMX, WEEKDAY_SHORT, weekdayMon0, ymd } from "@/lib/dates";
import { loadPeople, type Person } from "@/lib/people";
import { countOn, currentStreak, groupChecks, type ChecksByDate } from "@/lib/points";
import { errorES, fetchAll, supabase } from "@/lib/supabase";
import type { Activity, BonusEvent, HabitCheck, LeaderboardRow } from "@/lib/types";

const DONE = "#10b981";
const ACCENT = "#38bdf8";

type Profile = {
  person: Person;
  checks: ChecksByDate;
  bonuses: BonusEvent[];
  activities: Activity[];
  points: number;
  position: number;
  participants: number;
  photos: Record<string, string>; // photo_path -> URL firmada
};

export default function PerfilPage() {
  const { user_id: profileId } = useParams<{ user_id: string }>();
  const today = todayMX();
  const [data, setData] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const initialIdx = Math.max(
    0,
    COMPETITION_MONTHS.findIndex((m) => ymd(m.year, m.month, 1).slice(0, 7) === today.slice(0, 7)),
  );
  const [monthIdx, setMonthIdx] = useState(today > COMPETITION_END ? COMPETITION_MONTHS.length - 1 : initialIdx);
  const [openDay, setOpenDay] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [people, board, checks, bonusRes, actRes] = await Promise.all([
          loadPeople([profileId]),
          supabase.from("leaderboard").select("*").order("total_points", { ascending: false }).order("display_name"),
          fetchAll<HabitCheck>((f, t) =>
            supabase
              .from("habit_checks")
              .select("user_id,date,habit_key")
              .eq("user_id", profileId)
              .gte("date", COMPETITION_START)
              .lte("date", COMPETITION_END)
              .order("id")
              .range(f, t),
          ),
          supabase.from("bonus_events").select("*").eq("user_id", profileId).order("date", { ascending: false }),
          supabase.from("activities").select("*").eq("user_id", profileId).order("date", { ascending: false }).order("id", { ascending: false }),
        ]);
        if (!alive) return;
        if (board.error) throw new Error(board.error.message);
        if (bonusRes.error) throw new Error(bonusRes.error.message);
        if (actRes.error) throw new Error(actRes.error.message);
        const person = people[profileId];
        const rows = (board.data ?? []) as LeaderboardRow[];
        const idx = rows.findIndex((r) => r.user_id === profileId);
        if (!person || idx < 0) return setNotFound(true);

        const bonuses = (bonusRes.data ?? []) as BonusEvent[];
        // Fotos del medio maratón (el bucket es privado: se piden URLs firmadas)
        const photos: Record<string, string> = {};
        await Promise.all(
          bonuses
            .filter((b) => b.photo_path)
            .map(async (b) => {
              const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(b.photo_path!, 60 * 60);
              if (signed) photos[b.photo_path!] = signed.signedUrl;
            }),
        );
        if (!alive) return;
        setData({
          person,
          checks: groupChecks(checks),
          bonuses,
          activities: ((actRes.data ?? []) as Activity[]).map((a) => ({ ...a, distance_km: Number(a.distance_km) })),
          points: rows[idx].total_points,
          position: idx + 1,
          participants: rows.length,
          photos,
        });
      } catch (e) {
        if (alive) setError(errorES(e instanceof Error ? e.message : String(e)));
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileId, attempt]);

  const streak = useMemo(() => (data ? currentStreak(data.checks, today) : 0), [data, today]);

  const back = (
    <Link href="/stats" className="mb-6 inline-flex items-center gap-2 text-fg2 transition-colors duration-150 hover:text-fg">
      <ArrowLeft size={16} /> Ranking
    </Link>
  );

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl">
        {back}
        <p className="py-12 text-center text-fg3">No encontramos a esa persona.</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-xl">
        {back}
        <ErrorBox
          message={`No se pudo cargar el perfil: ${error}`}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-xl">
        {back}
        <Spinner label="Cargando perfil" />
      </main>
    );
  }

  const { year, month } = COMPETITION_MONTHS[monthIdx];
  const nDays = daysInMonth(year, month);
  const offset = weekdayMon0(ymd(year, month, 1));
  const total = HABITS.length;
  const { person, checks, bonuses, activities } = data;
  const books = bonuses.filter((b) => b.type === "book");
  const halves = bonuses.filter((b) => b.type === "half_marathon");

  return (
    <main className="mx-auto max-w-xl">
      {back}

      <header className="flex items-center gap-3">
        <UserAvatar name={person.name} override={person.avatar} size={44} />
        <h1 className="display text-4xl">
          {person.avatar === "burro" ? "🫏 " : ""}
          {person.name}
        </h1>
      </header>

      <section className="mt-8 flex items-end gap-8">
        <div>
          <div className="display text-6xl text-fg">{data.points}</div>
          <div className="label mt-1">Puntos</div>
        </div>
        <div>
          <div className="display text-6xl text-fg">
            {data.position}
            <span className="text-3xl text-fg3">/{data.participants}</span>
          </div>
          <div className="label mt-1">Posición</div>
        </div>
        <div>
          <div className="display text-6xl text-fg">{streak}</div>
          <div className="label mt-1">{streak === 1 ? "Día de racha" : "Días de racha"}</div>
        </div>
      </section>

      {/* Calendario (solo lectura) */}
      <section className="card mt-8 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-3xl">
            {MONTH_NAMES[month - 1]} <span className="text-fg3">{year}</span>
          </h2>
          <div className="flex gap-1">
            <button onClick={() => setMonthIdx((i) => i - 1)} disabled={monthIdx === 0} className="icon-btn disabled:pointer-events-none disabled:opacity-20" aria-label="Mes anterior">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setMonthIdx((i) => i + 1)}
              disabled={monthIdx === COMPETITION_MONTHS.length - 1}
              className="icon-btn disabled:pointer-events-none disabled:opacity-20"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-medium text-fg3">
          {WEEKDAY_SHORT.map((d, i) => (
            <div key={i} className="pb-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: nDays }).map((_, i) => {
            const date = ymd(year, month, i + 1);
            const n = countOn(checks, date);
            const isToday = date === today;
            const isFuture = date > today;
            const full = n === total;
            return (
              <button
                key={date}
                onClick={() => setOpenDay(date)}
                aria-label={`${i + 1} de ${MONTH_NAMES[month - 1]}: ${n} de ${total} hábitos`}
                className={`relative flex aspect-square items-center justify-center rounded-lg transition-colors duration-150 ease-out hover:bg-white/[0.04] ${
                  isFuture ? "opacity-40" : ""
                }`}
              >
                <Ring value={n / total} size={36} stroke={2} color={full ? DONE : ACCENT}>
                  <span className={`text-sm tabular-nums ${full ? "font-semibold text-done" : n > 0 ? "text-fg" : "text-fg2"}`}>{i + 1}</span>
                </Ring>
                {isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />}
              </button>
            );
          })}
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-fg3">Toca un día para ver qué hábitos marcó. Solo lectura.</p>

      {/* Bonus */}
      <SectionTitle>Libros terminados</SectionTitle>
      {books.length === 0 ? (
        <p className="text-fg3">Todavía no ha terminado ningún libro.</p>
      ) : (
        <ul className="card divide-y divide-white/[0.06] p-0">
          {books.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <BookOpen size={16} className="shrink-0 text-fg2" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.book_title}</div>
                  <div className="text-xs text-fg3">{shortLabel(b.date)}</div>
                </div>
                <span className="font-medium tabular-nums text-done">+{b.points}</span>
              </div>
              {b.review_text && <p className="mt-2 whitespace-pre-wrap break-words pl-7 text-fg2">{b.review_text}</p>}
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Medio maratón</SectionTitle>
      {halves.length === 0 ? (
        <p className="text-fg3">Todavía no ha corrido los 21 km.</p>
      ) : (
        <ul className="card divide-y divide-white/[0.06] p-0">
          {halves.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Medal size={16} className="shrink-0 text-fg2" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.distance_km} km</div>
                  <div className="text-xs text-fg3">{shortLabel(b.date)}</div>
                </div>
                <span className="font-medium tabular-nums text-done">+{b.points}</span>
              </div>
              {b.photo_path && data.photos[b.photo_path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.photos[b.photo_path]} alt={`Evidencia del medio maratón de ${person.name}`} loading="lazy" className="mt-3 max-h-80 w-full rounded-lg bg-zinc-900 object-contain" />
              )}
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Cardio registrado</SectionTitle>
      {activities.length === 0 ? (
        <p className="text-fg3">Todavía no ha registrado actividades.</p>
      ) : (
        <ul className="card divide-y divide-white/[0.06] p-0">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <Footprints size={16} className="shrink-0 text-fg2" />
              <span className="w-12 shrink-0 text-fg3">{shortLabel(a.date)}</span>
              <span className="flex-1">{ACTIVITY_TYPES.find((t) => t.key === a.type)?.label ?? a.type}</span>
              <span className="font-medium tabular-nums">{a.distance_km} km</span>
              {a.duration_min && <span className="tabular-nums text-fg3">{a.duration_min} min</span>}
            </li>
          ))}
        </ul>
      )}

      <DaySheet date={openDay} today={today} checks={checks} onToggle={() => {}} onClose={() => setOpenDay(null)} readOnly />
    </main>
  );
}
