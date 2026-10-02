"use client";
// PANTALLA 1: Calendario de hábitos
import { BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, LogOut, Medal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BookForm, HalfMarathonForm } from "@/components/calendar/BonusForms";
import DaySheet from "@/components/calendar/DaySheet";
import { ErrorBox, PointsBurst, Ring, Spinner, SyncBadge, Wordmark } from "@/components/ui";
import { COMPETITION_END, COMPETITION_MONTHS, HABITS } from "@/lib/constants";
import { daysInMonth, MONTH_NAMES, shortLabel, todayMX, WEEKDAY_SHORT, weekdayMon0, ymd } from "@/lib/dates";
import { countOn, currentStreak, totalPoints } from "@/lib/points";
import { supabase } from "@/lib/supabase";
import type { BonusEvent } from "@/lib/types";
import { useMyData } from "@/lib/useMyData";

const DONE = "#10b981";
const ACCENT = "#38bdf8";

export default function CalendarioPage() {
  const { user, profile, signOut } = useAuth();
  const userId = user!.id;
  const today = todayMX();
  const { checks, bonuses, pointEvents, loading, error, setError, reload, toggle, addBonusLocal, pendingCount } = useMyData(userId);

  // Mes inicial: el mes actual si está dentro de la carrera
  const initialIdx = Math.max(
    0,
    COMPETITION_MONTHS.findIndex((m) => ymd(m.year, m.month, 1).slice(0, 7) === today.slice(0, 7)),
  );
  const [monthIdx, setMonthIdx] = useState(today > COMPETITION_END ? COMPETITION_MONTHS.length - 1 : initialIdx);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [form, setForm] = useState<{ type: "book" | "half"; day: string } | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const clearBurst = useCallback(() => setBurst(null), []);

  const pts = useMemo(() => totalPoints(checks, pointEvents), [checks, pointEvents]);
  const streak = useMemo(() => currentStreak(checks, today), [checks, today]);

  const { year, month } = COMPETITION_MONTHS[monthIdx];
  const nDays = daysInMonth(year, month);
  const offset = weekdayMon0(ymd(year, month, 1));
  const total = HABITS.length;

  function onBonusSaved(b: BonusEvent) {
    addBonusLocal(b);
    setBurst(b.points);
  }

  // Desde el panel del día: cierra el panel y abre el formulario del bonus
  function openBonus(type: "book" | "half") {
    setForm({ type, day: openDay ?? today });
    setOpenDay(null);
  }

  async function viewPhoto(path: string) {
    const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 10);
    if (error || !data) return setError("No se pudo abrir la foto.");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <main className="mx-auto max-w-xl">
      <header className="flex items-center justify-between gap-3">
        <Wordmark />
        <div className="flex items-center gap-2">
          <SyncBadge count={pendingCount} />
          <button onClick={signOut} className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Resumen */}
      <section className="mt-8">
        <p className="text-fg2">{profile?.display_name ?? ""}</p>
        <div className="mt-2 flex items-end gap-8">
          <div>
            <div className="display text-6xl text-fg">{loading ? "0" : pts.total}</div>
            <div className="label mt-1">Puntos</div>
          </div>
          <div>
            <div className="display text-6xl text-fg">{loading ? "0" : streak}</div>
            <div className="label mt-1">{streak === 1 ? "Día de racha" : "Días de racha"}</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-6">
          <ErrorBox message={error} onRetry={reload} />
        </div>
      )}

      {/* Calendario */}
      <section className="card mt-8 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="display text-3xl">
            {MONTH_NAMES[month - 1]} <span className="text-fg3">{year}</span>
          </h1>
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
        )}
      </section>
      <p className="mt-3 text-center text-xs text-fg3">Toca un día para tachar hábitos o registrar un bonus</p>

      {/* Mis bonus */}
      {bonuses.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Mis bonus</h2>
          <ul className="card divide-y divide-white/[0.06] p-0">
            {bonuses.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                {b.type === "book" ? <BookOpen size={16} className="shrink-0 text-fg2" /> : <Medal size={16} className="shrink-0 text-fg2" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.type === "book" ? b.book_title : `Medio maratón, ${b.distance_km} km`}</div>
                  <div className="text-xs text-fg3">{shortLabel(b.date)}</div>
                </div>
                {b.photo_path && (
                  <button onClick={() => viewPhoto(b.photo_path!)} className="icon-btn" aria-label="Ver foto">
                    <ImageIcon size={16} />
                  </button>
                )}
                <span className="font-medium tabular-nums text-done">+{b.points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DaySheet date={openDay} today={today} checks={checks} onToggle={toggle} onClose={() => setOpenDay(null)} onOpenBonus={openBonus} />
      <BookForm open={form?.type === "book"} onClose={() => setForm(null)} userId={userId} today={today} onSaved={onBonusSaved} />
      {form?.type === "half" && (
        <HalfMarathonForm key={form.day} open onClose={() => setForm(null)} userId={userId} today={today} onSaved={onBonusSaved} defaultDate={form.day} />
      )}
      <PointsBurst points={burst} onDone={clearBurst} />
    </main>
  );
}
