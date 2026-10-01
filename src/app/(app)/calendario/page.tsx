"use client";
// PANTALLA 1: Calendario de hábitos
import { BookOpen, ChevronLeft, ChevronRight, Flame, Image as ImageIcon, LogOut, Medal, Trophy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BookForm, HalfMarathonForm } from "@/components/calendar/BonusForms";
import DaySheet from "@/components/calendar/DaySheet";
import { ErrorBox, PointsBurst, Ring, Spinner } from "@/components/ui";
import { CHART_COLORS, COMPETITION_MONTHS, HABITS } from "@/lib/constants";
import { daysInMonth, MONTH_NAMES, shortLabel, todayMX, WEEKDAY_SHORT, weekdayMon0, ymd } from "@/lib/dates";
import { countOn, currentStreak, totalPoints } from "@/lib/points";
import { supabase } from "@/lib/supabase";
import type { BonusEvent } from "@/lib/types";
import { useMyData } from "@/lib/useMyData";

export default function CalendarioPage() {
  const { user, profile, signOut } = useAuth();
  const userId = user!.id;
  const today = todayMX();
  const { checks, bonuses, loading, error, setError, reload, toggle, addBonusLocal } = useMyData(userId);

  // Mes inicial: el mes actual si está dentro de la carrera
  const initialIdx = Math.max(
    0,
    COMPETITION_MONTHS.findIndex((m) => ymd(m.year, m.month, 1).slice(0, 7) === today.slice(0, 7)),
  );
  const [monthIdx, setMonthIdx] = useState(today > "2026-12-31" ? COMPETITION_MONTHS.length - 1 : initialIdx);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [form, setForm] = useState<"book" | "half" | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const clearBurst = useCallback(() => setBurst(null), []);

  const pts = useMemo(() => totalPoints(checks, bonuses), [checks, bonuses]);
  const streak = useMemo(() => currentStreak(checks, today), [checks, today]);

  const { year, month } = COMPETITION_MONTHS[monthIdx];
  const nDays = daysInMonth(year, month);
  const offset = weekdayMon0(ymd(year, month, 1));

  function onBonusSaved(b: BonusEvent) {
    addBonusLocal(b);
    setBurst(b.points);
  }

  async function viewPhoto(path: string) {
    const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 10);
    if (error || !data) return setError("No se pudo abrir la foto.");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <main>
      {/* Encabezado */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ice">Winter Arc</p>
          <h1 className="text-2xl font-black">Hola, {profile?.display_name ?? "…"}</h1>
        </div>
        <button onClick={signOut} className="rounded-full p-2 text-neutral-500 hover:bg-card2 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={20} />
        </button>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Trophy size={14} className="text-ice" /> Puntos
          </div>
          <div className="mt-1 text-4xl font-black tabular-nums text-ice">{loading ? "–" : pts.total}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Flame size={14} className="text-orange-400" /> Racha
          </div>
          <div className="mt-1 text-4xl font-black tabular-nums text-orange-400">
            {loading ? "–" : streak}
            <span className="ml-1 text-base font-semibold text-neutral-500">{streak === 1 ? "día" : "días"}</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={reload} />
        </div>
      )}

      {/* Calendario */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setMonthIdx((i) => i - 1)}
            disabled={monthIdx === 0}
            className="rounded-full p-2 hover:bg-card2 disabled:opacity-20"
            aria-label="Mes anterior"
          >
            <ChevronLeft />
          </button>
          <h2 className="text-lg font-bold">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            onClick={() => setMonthIdx((i) => i + 1)}
            disabled={monthIdx === COMPETITION_MONTHS.length - 1}
            className="rounded-full p-2 hover:bg-card2 disabled:opacity-20"
            aria-label="Mes siguiente"
          >
            <ChevronRight />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-500">
          {WEEKDAY_SHORT.map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: nDays }).map((_, i) => {
              const date = ymd(year, month, i + 1);
              const n = countOn(checks, date);
              const isToday = date === today;
              const isFuture = date > today;
              const full = n === HABITS.length;
              return (
                <button
                  key={date}
                  onClick={() => setOpenDay(date)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border transition active:scale-95 ${
                    isToday ? "border-ice shadow-[0_0_12px_rgba(34,211,238,0.35)]" : "border-transparent"
                  } ${full ? "bg-done/15" : "bg-card2"} ${isFuture ? "opacity-40" : ""}`}
                >
                  <Ring value={n / HABITS.length} size={34} stroke={3.5} color={full ? CHART_COLORS.green : CHART_COLORS.cyan}>
                    <span className={`text-xs font-bold tabular-nums ${full ? "text-done" : isToday ? "text-ice" : ""}`}>{i + 1}</span>
                  </Ring>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-center text-xs text-neutral-500">Toca un día para tachar tus hábitos</p>
      </section>

      {/* Botones de bonus */}
      <section className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={() => setForm("book")} className="card flex flex-col items-start gap-2 text-left transition hover:border-violet-400/60 active:scale-[0.98]">
          <BookOpen className="text-violet-400" />
          <div className="font-bold">Terminé un libro</div>
          <div className="text-sm font-black text-violet-400">+5 pts</div>
        </button>
        <button onClick={() => setForm("half")} className="card flex flex-col items-start gap-2 text-left transition hover:border-orange-400/60 active:scale-[0.98]">
          <Medal className="text-orange-400" />
          <div className="font-bold">Corrí 21 km</div>
          <div className="text-sm font-black text-orange-400">+50 pts</div>
        </button>
      </section>

      {/* Mis bonus */}
      {bonuses.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">Mis bonus</h2>
          <ul className="flex flex-col gap-2">
            {bonuses.map((b) => (
              <li key={b.id} className="card flex items-center gap-3 py-3">
                {b.type === "book" ? <BookOpen size={18} className="text-violet-400" /> : <Medal size={18} className="text-orange-400" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{b.type === "book" ? b.book_title : `Medio maratón · ${b.distance_km} km`}</div>
                  <div className="text-xs text-neutral-500">{shortLabel(b.date)}</div>
                </div>
                {b.photo_path && (
                  <button onClick={() => viewPhoto(b.photo_path!)} className="rounded-full p-2 text-neutral-400 hover:bg-card2" aria-label="Ver foto">
                    <ImageIcon size={18} />
                  </button>
                )}
                <span className="font-black text-done">+{b.points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DaySheet date={openDay} today={today} checks={checks} onToggle={toggle} onClose={() => setOpenDay(null)} />
      <BookForm open={form === "book"} onClose={() => setForm(null)} userId={userId} today={today} onSaved={onBonusSaved} />
      <HalfMarathonForm open={form === "half"} onClose={() => setForm(null)} userId={userId} today={today} onSaved={onBonusSaved} />
      <PointsBurst points={burst} onDone={clearBurst} />
    </main>
  );
}
