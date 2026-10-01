// =====================================================================
// Configuración de la carrera. Cambia aquí los hábitos, fechas y puntos.
// OJO: si cambias las fechas, cámbialas también en supabase/migracion.sql
// =====================================================================

export const TIMEZONE = "America/Mexico_City";

// Fechas de la carrera (formato YYYY-MM-DD)
export const COMPETITION_START = "2026-10-01";
export const COMPETITION_END = "2026-12-31";

// Meses que se pueden ver en el calendario (año, mes 1-12)
export const COMPETITION_MONTHS = [
  { year: 2026, month: 10 },
  { year: 2026, month: 11 },
  { year: 2026, month: 12 },
];

// Los 8 hábitos (el máximo diario es HABITS.length). "key" es lo que se guarda en la base de datos: no lo cambies
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
] as const;

export type HabitKey = (typeof HABITS)[number]["key"];

// Puntos
export const POINTS_PER_HABIT = 1;
export const BOOK_BONUS = 5;
export const HALF_MARATHON_BONUS = 50;
export const HALF_MARATHON_MIN_KM = 21;
export const BOOK_REVIEW_MIN_CHARS = 20;

// Bonus semanales (semana de lunes a domingo)
export const WEEKLY_BONUSES = [
  { habit: "cardio" as HabitKey, times: 3, points: 5, label: "3 cardios en la semana" },
  { habit: "gym" as HabitKey, times: 5, points: 5, label: "5 días de gym en la semana" },
];

// Mínimo de hábitos al día para que cuente en la racha (6 de 8)
export const STREAK_MIN_HABITS = 6;

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
