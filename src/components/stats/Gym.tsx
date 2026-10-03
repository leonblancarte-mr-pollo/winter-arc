"use client";
// 7) Sección Gym: importador del CSV de Hevy + gráficas de progreso
import { Dumbbell, Trophy, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend, ErrorBox, Notice, SectionTitle, Spinner } from "@/components/ui";
import { CHART_COLORS, COMPETITION_END, COMPETITION_START } from "@/lib/constants";
import { addDays, dateInMX, isEditableDay, shortLabel, weekStart } from "@/lib/dates";
import { parseHevyFile } from "@/lib/hevy";
import { errorES, fetchAll, supabase } from "@/lib/supabase";
import type { WorkoutSet } from "@/lib/types";
import { axisProps, gridStroke, tooltipStyle } from "./chartTheme";

const BATCH = 500;
const WEEKS_SHOWN = 16;
const epley = (w: number, r: number) => w * (1 + r / 30);
const round1 = (n: number) => Math.round(n * 10) / 10;
// Sets que cuentan (sin calentamiento)
const isWorking = (s: WorkoutSet) => (s.set_type ?? "normal").toLowerCase() !== "warmup";

export default function Gym({ userId, today, onGymDaysMarked }: { userId: string; today: string; onGymDaysMarked: (dates: string[]) => void }) {
  const [sets, setSets] = useState<WorkoutSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exercise, setExercise] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAll<WorkoutSet>((f, t) =>
        supabase
          .from("workout_sets")
          .select("workout_title,workout_start,workout_end,exercise_title,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe")
          .eq("user_id", userId)
          .order("workout_start")
          .order("id")
          .range(f, t),
      );
      setSets(rows.map((r) => ({ ...r, weight_kg: r.weight_kg == null ? null : Number(r.weight_kg) })));
    } catch (e) {
      setError(errorES((e as Error).message));
    }
  }, [userId]);

  useEffect(() => {
    // Carga datos de Supabase al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setStatus("Leyendo archivo…");
    setBusy(true);
    try {
      const parsed = await parseHevyFile(file);
      if (!parsed.ok) throw new Error(parsed.error);

      // 1) Sube los sets en lotes (si ya existían, no se duplican)
      const rows = parsed.sets.map((s) => ({ ...s, user_id: userId }));
      for (let i = 0; i < rows.length; i += BATCH) {
        setStatus(`Subiendo sets ${Math.min(i + BATCH, rows.length)} de ${rows.length}…`);
        const { error } = await supabase
          .from("workout_sets")
          .upsert(rows.slice(i, i + BATCH), { onConflict: "user_id,workout_start,exercise_title,set_index", ignoreDuplicates: true });
        if (error) throw new Error(`Error al guardar: ${errorES(error.message)}`);
      }

      // 2) Marca "Ir al gym" en los días de la carrera con entrenamiento.
      //    Solo hoy y ayer: los días anteriores ya no se pueden editar (los sets sí se guardan).
      const lastDay = today < COMPETITION_END ? today : COMPETITION_END;
      const gymDays = parsed.workoutDates.filter((d) => d >= COMPETITION_START && d <= lastDay && isEditableDay(d, today));
      if (gymDays.length) {
        setStatus("Marcando días de gym…");
        const { error } = await supabase
          .from("habit_checks")
          .upsert(
            gymDays.map((date) => ({ user_id: userId, date, habit_key: "gym" })),
            { onConflict: "user_id,date,habit_key", ignoreDuplicates: true },
          );
        if (error) throw new Error(`Los sets se guardaron, pero no se pudo marcar el gym: ${errorES(error.message)}`);
        onGymDaysMarked(gymDays);
      }

      await load();
      setStatus(
        `Listo: ${parsed.workoutCount} entrenamientos (${parsed.sets.length} sets) procesados.` +
          (gymDays.length ? ` Se marcó "Ir al gym" en ${gymDays.length} día(s) de la carrera.` : ""),
      );
    } catch (err) {
      setStatus(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- Cálculos ----------
  const stats = useMemo(() => {
    if (!sets || sets.length === 0) return null;

    // Entrenamientos agrupados por inicio
    const workouts = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      const arr = workouts.get(s.workout_start);
      if (arr) arr.push(s);
      else workouts.set(s.workout_start, [s]);
    }

    // Semanas a mostrar: las últimas N hasta hoy
    const lastMonday = weekStart(today);
    const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(lastMonday, -7 * (WEEKS_SHOWN - 1 - i)));
    const perWeek = weeks.map((monday) => ({ semana: shortLabel(monday), monday, Entrenamientos: 0, Volumen: 0 }));
    const idx = new Map(weeks.map((w, i) => [w, i]));

    for (const [start, list] of workouts) {
      const i = idx.get(weekStart(dateInMX(start)));
      if (i == null) continue;
      perWeek[i].Entrenamientos++;
      for (const s of list) {
        if (isWorking(s) && s.weight_kg != null && s.reps != null) perWeek[i].Volumen += s.weight_kg * s.reps;
      }
    }
    perWeek.forEach((w) => (w.Volumen = Math.round(w.Volumen)));

    // Ejercicios ordenados por cuántas sesiones tienen
    const exCount = new Map<string, Set<string>>();
    for (const s of sets) {
      if (!exCount.has(s.exercise_title)) exCount.set(s.exercise_title, new Set());
      exCount.get(s.exercise_title)!.add(s.workout_start);
    }
    const exercises = [...exCount.entries()].sort((a, b) => b[1].size - a[1].size).map(([name, ws]) => ({ name, sessions: ws.size }));

    return { perWeek, exercises, totalWorkouts: workouts.size };
  }, [sets, today]);

  // Ejercicio seleccionado: por defecto, el que tiene más sesiones con peso
  const exerciseList = stats?.exercises ?? [];
  const selected = exercise || exerciseList.find((e) => sets?.some((s) => s.exercise_title === e.name && s.weight_kg))?.name || exerciseList[0]?.name || "";

  const progress = useMemo(() => {
    if (!sets || !selected) return null;
    const bySession = new Map<string, { best: number; e1rm: number }>();
    const pr = { weight: 0, weightReps: 0, e1rm: 0, reps: 0, volume: 0, volumeDate: "", weightDate: "", e1rmDate: "" };
    const sessionVol = new Map<string, number>();
    for (const s of sets) {
      if (s.exercise_title !== selected || !isWorking(s)) continue;
      const day = dateInMX(s.workout_start);
      if (s.reps != null && s.reps > pr.reps) pr.reps = s.reps;
      if (s.weight_kg == null || s.reps == null || s.reps <= 0) continue;
      const e = epley(s.weight_kg, s.reps);
      const cur = bySession.get(s.workout_start) ?? { best: 0, e1rm: 0 };
      cur.best = Math.max(cur.best, s.weight_kg);
      cur.e1rm = Math.max(cur.e1rm, e);
      bySession.set(s.workout_start, cur);
      sessionVol.set(s.workout_start, (sessionVol.get(s.workout_start) ?? 0) + s.weight_kg * s.reps);
      if (s.weight_kg > pr.weight || (s.weight_kg === pr.weight && s.reps > pr.weightReps)) {
        pr.weight = s.weight_kg;
        pr.weightReps = s.reps;
        pr.weightDate = day;
      }
      if (e > pr.e1rm) {
        pr.e1rm = e;
        pr.e1rmDate = day;
      }
    }
    for (const [start, v] of sessionVol) if (v > pr.volume) {
      pr.volume = v;
      pr.volumeDate = dateInMX(start);
    }
    const chart = [...bySession.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([start, v]) => ({ fecha: shortLabel(dateInMX(start)), "Mejor peso": round1(v.best), "1RM estimado": round1(v.e1rm) }));
    return { chart, pr };
  }, [sets, selected]);

  return (
    <section>
      <SectionTitle
        right={
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary">
            <Upload size={16} /> Subir CSV de Hevy
          </button>
        }
      >
        Gym
      </SectionTitle>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />

      {status && (
        <div className="mb-3">
          <Notice>{status}</Notice>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <ErrorBox message={error} />
        </div>
      )}

      {!sets ? (
        <Spinner />
      ) : !stats ? (
        <div className="card flex items-start gap-3 text-fg2">
          <Dumbbell size={16} className="mt-1 shrink-0 text-fg3" />
          <p>
            En Hevy ve a <span className="text-fg">Perfil, Ajustes, Exportar e importar datos, Exportar entrenamientos</span>. Sube aquí el
            archivo .csv que te da. Puedes subirlo las veces que quieras: los sets repetidos no se duplican.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card">
              <h3 className="label mb-4">Entrenamientos por semana</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.perWeek} margin={{ left: -28, right: 0, top: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="semana" {...axisProps} interval={3} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} labelFormatter={(l) => `Semana del ${l}`} />
                  <Bar dataKey="Entrenamientos" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="label mb-4">Volumen semanal (kg)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.perWeek} margin={{ left: -12, right: 0, top: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="semana" {...axisProps} interval={3} />
                  <YAxis {...axisProps} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip {...tooltipStyle} labelFormatter={(l) => `Semana del ${l}`} formatter={(v) => [`${Number(v).toLocaleString("es-MX")} kg`, "Volumen"]} />
                  <Bar dataKey="Volumen" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="mt-2 text-xs text-fg3">
            {stats.totalWorkouts} entrenamientos importados. El volumen es peso por repeticiones, sin contar calentamientos.
          </p>

          <div className="card mt-3">
            <label className="mb-6 flex flex-col gap-2">
              <span className="label">Progreso por ejercicio</span>
              <select className="input" value={selected} onChange={(e) => setExercise(e.target.value)}>
                {exerciseList.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name} ({e.sessions} sesiones)
                  </option>
                ))}
              </select>
            </label>

            {progress && progress.chart.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={progress.chart} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="fecha" {...axisProps} minTickGap={24} />
                    <YAxis {...axisProps} domain={["auto", "auto"]} unit=" kg" width={64} />
                    <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} kg`, n]} />
                    <Line type="monotone" dataKey="Mejor peso" stroke={CHART_COLORS.green} strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="1RM estimado" stroke={CHART_COLORS.violet} strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
                <ChartLegend
                  items={[
                    { label: "Mejor peso", color: CHART_COLORS.green },
                    { label: "1RM estimado", color: CHART_COLORS.violet },
                  ]}
                />

                <h3 className="mb-3 mt-8 flex items-center gap-2 font-medium">
                  <Trophy size={16} className="text-fg2" /> Récords en este ejercicio
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <PR label="Peso máximo" value={`${progress.pr.weight} kg × ${progress.pr.weightReps}`} date={progress.pr.weightDate} />
                  <PR label="1RM estimado" value={`${round1(progress.pr.e1rm)} kg`} date={progress.pr.e1rmDate} />
                  <PR label="Más reps en un set" value={`${progress.pr.reps}`} />
                  <PR label="Mejor volumen en sesión" value={`${Math.round(progress.pr.volume).toLocaleString("es-MX")} kg`} date={progress.pr.volumeDate} />
                </div>
              </>
            ) : (
              <p className="text-fg3">Este ejercicio no tiene sets con peso y repeticiones, como el cardio o los estiramientos.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PR({ label, value, date }: { label: string; value: string; date?: string }) {
  return (
    <div className="rounded-lg bg-raised p-3">
      <div className="text-xs text-fg2">{label}</div>
      <div className="display mt-1 text-3xl">{value}</div>
      {date && (
        <div className="text-xs text-fg3">
          {shortLabel(date)} {date.slice(0, 4)}
        </div>
      )}
    </div>
  );
}
