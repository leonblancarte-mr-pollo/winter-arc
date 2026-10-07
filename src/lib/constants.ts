// =====================================================================
// Configuración de la carrera. Cambia aquí los hábitos, fechas y puntos.
// OJO: si cambias las fechas, cámbialas también en supabase/migracion.sql
// =====================================================================

export const TIMEZONE = "America/Mexico_City";

// Fechas de la carrera (formato YYYY-MM-DD)
export const COMPETITION_START = "2026-10-01";
export const COMPETITION_END = "2026-12-31";

// Días en que el admin de la app puede tachar/destachar SUS hábitos de cualquier
// día anterior (no solo hoy/ayer). Misma lista que is_admin_override_day() en
// supabase/admin_override_backfill.sql: cámbiala en los dos lugares si se repite.
export const ADMIN_OVERRIDE_DAYS: readonly string[] = ["2026-10-05", "2026-10-06"];

// Meses que se pueden ver en el calendario (año, mes 1-12)
export const COMPETITION_MONTHS = [
  { year: 2026, month: 10 },
  { year: 2026, month: 11 },
  { year: 2026, month: 12 },
];

// Los 10 hábitos (el máximo diario es HABITS.length). "key" es lo que se guarda en la base de datos: no lo cambies
// una vez que la carrera empezó (perderías los hábitos ya marcados).
export const HABITS = [
  { key: "gym", label: "Ir al gym", short: "Gym", icon: "Dumbbell" },
  { key: "cardio", label: "Cardio (running / bici / natación)", short: "Cardio", icon: "HeartPulse" },
  { key: "leer", label: "Leer 5 páginas mínimo", short: "Leer", icon: "BookOpen" },
  { key: "dormir", label: "Dormir 7 horas mínimo", short: "Dormir", icon: "Moon" },
  { key: "pasos", label: "10,000 pasos", short: "Pasos", icon: "Footprints" },
  { key: "pantalla", label: "Menos de 5 hrs de tiempo en pantalla", short: "Pantalla", icon: "Smartphone" },
  { key: "proyecto", label: "1 hr de trabajo en proyecto personal", short: "Proyecto", icon: "Hammer" },
  { key: "no_pajiza", label: "No chaketa", short: "No chaketa", icon: "ShieldCheck" },
  { key: "agua_3litros", label: "Tomar 3 litros de agua", short: "Agua", icon: "Droplet" },
  // Agregado el 2026-10-03: va al final para no mover el orden de los demás
  { key: "dieta", label: "Dieta", short: "Dieta", icon: "Salad" },
] as const;

export type HabitKey = (typeof HABITS)[number]["key"];

// Hábitos que se agregaron con la carrera ya empezada: antes de esa fecha no existían,
// así que no cuentan para el máximo del día, el % de cumplimiento ni la racha.
export const HABIT_SINCE: Partial<Record<HabitKey, string>> = { dieta: "2026-10-03" };

// Puntos
export const POINTS_PER_HABIT = 1;
export const BOOK_BONUS = 5;
export const HALF_MARATHON_BONUS = 50;
export const HALF_MARATHON_MIN_KM = 21;
export const BOOK_REVIEW_MIN_CHARS = 20;

// Bonus de cardio por distancia: +5 al tachar Cardio con una actividad que llegue al umbral
// (km mínimos, inclusive). La misma regla vive en supabase/cardio_distancia.sql (cardio_bonus_min_km)
export const CARDIO_DISTANCE_BONUS = 5;
export const CARDIO_DISTANCE_MIN_KM = { running: 5, bici: 20, natacion: 2 } as const;
export type CardioType = keyof typeof CARDIO_DISTANCE_MIN_KM;

// Bonus semanales (semana de lunes a domingo)
export const WEEKLY_BONUSES = [
  { habit: "cardio" as HabitKey, times: 3, points: 5, label: "3 cardios en la semana" },
  { habit: "gym" as HabitKey, times: 5, points: 5, label: "5 días de gym en la semana" },
];

// Mínimo de hábitos al día para que cuente en la racha: 8 de 10 (misma proporción que el 7 de 9
// original, ~78%, redondeado hacia arriba). Los días antes de Dieta siguen pidiendo 7 de 9.
export const STREAK_MIN_HABITS = 8;
export const STREAK_MIN_HABITS_BEFORE_DIETA = 7;

// Tipos de actividad manual
export const ACTIVITY_TYPES = [
  { key: "running", label: "Running" },
  { key: "bici", label: "Bici" },
  { key: "natacion", label: "Natación" },
  { key: "caminata", label: "Caminata" },
  { key: "otro", label: "Otro" },
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number]["key"];

// Colores de las gráficas del dashboard. Cada métrica tiene SIEMPRE el mismo color:
// cian = hábitos/puntos, rosa = bonus, naranja = racha, violeta = posición/fuerza, verde = actividad/gym
export const CHART_COLORS = {
  cyan: "#38bdf8",
  violet: "#a78bfa",
  pink: "#f472b6",
  orange: "#fb923c",
  green: "#4ade80",
};

// Hábitos que piden una foto como evidencia al tacharlos hoy o ayer (ver supabase/evidencia_habitos.sql y dieta.sql)
export const PHOTO_HABITS: readonly string[] = ["gym", "cardio", "leer", "pasos", "pantalla", "dieta"];
