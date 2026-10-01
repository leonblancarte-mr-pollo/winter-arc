// Lector del CSV exportado de Hevy.
// Cada fila es UN set. Un entrenamiento = todas las filas con el mismo start_time.
import Papa from "papaparse";
import { zonedTimeToUtc, ymd } from "./dates";
import type { WorkoutSet } from "./types";

export const HEVY_COLUMNS = [
  "title", "start_time", "end_time", "description", "exercise_title", "superset_id",
  "exercise_notes", "set_index", "set_type", "weight_kg", "reps", "distance_km",
  "duration_seconds", "rpe",
] as const;

// Meses en español (y en inglés por si acaso)
const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

// "30 sep 2026, 18:57" -> { iso (UTC), date: "2026-09-30" } interpretando la hora en CDMX
export function parseHevyDate(raw: string): { iso: string; date: string } | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3)];
    if (!month) return null;
    const [day, year, h, mi] = [Number(m[1]), Number(m[3]), Number(m[4]), Number(m[5])];
    if (day < 1 || day > 31 || h > 23 || mi > 59) return null;
    return { iso: zonedTimeToUtc(year, month, day, h, mi).toISOString(), date: ymd(year, month, day) };
  }
  // Respaldo: formato "2026-09-30 18:57"
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[ t](\d{1,2}):(\d{2})/);
  if (iso) {
    const [y, mo, d, h, mi] = iso.slice(1).map(Number);
    return { iso: zonedTimeToUtc(y, mo, d, h, mi).toISOString(), date: ymd(y, mo, d) };
  }
  return null;
}

// Número o null si viene vacío
function num(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export type HevyParseResult =
  | { ok: true; sets: WorkoutSet[]; workoutDates: string[]; workoutCount: number }
  | { ok: false; error: string };

export async function parseHevyFile(file: File): Promise<HevyParseResult> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, error: "El archivo debe ser .csv (el que exporta Hevy desde Ajustes > Exportar datos)." };
  }
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/^"|"$/g, ""),
  });

  const headers = parsed.meta.fields ?? [];
  const missing = HEVY_COLUMNS.filter((c) => !headers.includes(c));
  if (missing.length) {
    return {
      ok: false,
      error: `Este no parece un CSV de Hevy. Faltan las columnas: ${missing.join(", ")}.`,
    };
  }
  if (parsed.data.length === 0) return { ok: false, error: "El archivo no tiene filas." };

  const errors: string[] = [];
  const sets: WorkoutSet[] = [];
  const seen = new Set<string>();
  const dates = new Set<string>();
  const workouts = new Set<string>();

  parsed.data.forEach((r, i) => {
    const row = i + 2; // +2: encabezado y conteo desde 1
    if (errors.length >= 5) return;
    const start = parseHevyDate(r.start_time ?? "");
    if (!start) return void errors.push(`Fila ${row}: no entendí la fecha de inicio "${r.start_time}".`);
    const end = r.end_time?.trim() ? parseHevyDate(r.end_time) : null;
    if (r.end_time?.trim() && !end) return void errors.push(`Fila ${row}: no entendí la fecha de fin "${r.end_time}".`);
    const exercise = r.exercise_title?.trim();
    if (!exercise) return void errors.push(`Fila ${row}: falta el nombre del ejercicio.`);
    const setIndex = num(r.set_index);
    if (setIndex == null || Number.isNaN(setIndex)) return void errors.push(`Fila ${row}: set_index no es un número.`);

    const values = {
      weight_kg: num(r.weight_kg),
      reps: num(r.reps),
      distance_km: num(r.distance_km),
      duration_seconds: num(r.duration_seconds),
      rpe: num(r.rpe),
    };
    const bad = Object.entries(values).find(([, v]) => Number.isNaN(v));
    if (bad) return void errors.push(`Fila ${row}: el valor de ${bad[0]} no es un número.`);

    const key = `${start.iso}|${exercise}|${setIndex}`;
    if (seen.has(key)) return; // set repetido dentro del mismo archivo
    seen.add(key);
    dates.add(start.date);
    workouts.add(start.iso);

    sets.push({
      workout_title: r.title?.trim() || null,
      workout_start: start.iso,
      workout_end: end?.iso ?? null,
      exercise_title: exercise,
      set_index: setIndex,
      set_type: r.set_type?.trim() || null,
      weight_kg: values.weight_kg,
      reps: values.reps == null ? null : Math.round(values.reps),
      distance_km: values.distance_km,
      duration_seconds: values.duration_seconds == null ? null : Math.round(values.duration_seconds),
      rpe: values.rpe,
    });
  });

  if (errors.length) return { ok: false, error: "El archivo tiene errores de formato:\n" + errors.join("\n") };
  return { ok: true, sets, workoutDates: [...dates].sort(), workoutCount: workouts.size };
}
