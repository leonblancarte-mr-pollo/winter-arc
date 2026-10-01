// Utilidades de fechas. Todas las fechas de días son texto "YYYY-MM-DD"
// para evitar errores de zona horaria.
import { COMPETITION_END, COMPETITION_START, TIMEZONE } from "./constants";

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const WEEKDAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Fecha de hoy en Ciudad de México
export function todayMX(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Convierte "YYYY-MM-DD" a un Date en UTC (solo para hacer cuentas de días)
function toUTC(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function fromUTC(d: Date) {
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(d: string, n: number) {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Día de la semana con lunes = 0 ... domingo = 6
export function weekdayMon0(d: string) {
  return (toUTC(d).getUTCDay() + 6) % 7;
}

// Lunes de la semana de esa fecha
export function weekStart(d: string) {
  return addDays(d, -weekdayMon0(d));
}

// Lista de días entre dos fechas (incluidas)
export function dateRange(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Días de la carrera que ya pasaron o son hoy
export function elapsedCompetitionDays(today = todayMX()) {
  if (today < COMPETITION_START) return [];
  const end = today < COMPETITION_END ? today : COMPETITION_END;
  return dateRange(COMPETITION_START, end);
}

// "2026-10-05" -> "5 oct"
export function shortLabel(d: string) {
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MONTH_NAMES[m - 1].slice(0, 3).toLowerCase()}`;
}

// "2026-10-05" -> "lunes 5 de octubre"
export function longLabel(d: string) {
  const dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const [, m, day] = d.split("-").map(Number);
  return `${dias[weekdayMon0(d)]} ${day} de ${MONTH_NAMES[m - 1].toLowerCase()}`;
}

// Fecha (YYYY-MM-DD) en Ciudad de México de un timestamp
export function dateInMX(ts: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

// Hora "18:57" en Ciudad de México
export function timeInMX(ts: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

// Convierte una fecha/hora "de reloj" en Ciudad de México a un Date real (UTC)
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, tz = TIMEZONE) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMs(new Date(guess), tz);
  let result = guess - offset;
  // Segundo ajuste por si hubo cambio de horario (años con horario de verano)
  const offset2 = tzOffsetMs(new Date(result), tz);
  if (offset2 !== offset) result = guess - offset2;
  return new Date(result);
}

function tzOffsetMs(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - date.getTime();
}
