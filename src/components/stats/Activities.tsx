"use client";
// 6) Registro manual de actividades (km) y sus gráficas
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend, ErrorBox, SectionTitle, Spinner } from "@/components/ui";
import { ACTIVITY_TYPES, CHART_COLORS, COMPETITION_START, type ActivityType } from "@/lib/constants";
import { shortLabel, weekStart } from "@/lib/dates";
import { competitionWeeks } from "@/lib/points";
import { errorES, fetchAll, supabase } from "@/lib/supabase";
import type { Activity } from "@/lib/types";
import { axisProps, gridStroke, tooltipStyle } from "./chartTheme";

const TYPE_COLORS: Record<ActivityType, string> = {
  running: CHART_COLORS.cyan,
  bici: CHART_COLORS.green,
  natacion: CHART_COLORS.violet,
  caminata: CHART_COLORS.orange,
  otro: CHART_COLORS.pink,
};
const typeLabel = (t: string) => ACTIVITY_TYPES.find((a) => a.key === t)?.label ?? t;
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function Activities({ userId, today }: { userId: string; today: string }) {
  const [list, setList] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<ActivityType>("running");
  const [km, setKm] = useState("");
  const [min, setMin] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAll<Activity>((f, t) =>
        supabase.from("activities").select("*").eq("user_id", userId).order("date", { ascending: false }).range(f, t),
      );
      setList(rows.map((r) => ({ ...r, distance_km: Number(r.distance_km) })));
    } catch (e) {
      setError(errorES((e as Error).message));
    }
  }, [userId]);

  useEffect(() => {
    // Carga datos de Supabase al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const kmNum = Number(km.replace(",", "."));
    const minNum = min.trim() ? Number(min) : null;
    if (!date || date > today) return setError("La fecha no puede ser futura.");
    if (!Number.isFinite(kmNum) || kmNum <= 0) return setError("Escribe los km (un número mayor a 0).");
    if (minNum != null && (!Number.isInteger(minNum) || minNum <= 0)) return setError("Los minutos deben ser un número entero.");
    setBusy(true);
    const { data, error } = await supabase
      .from("activities")
      .insert({ user_id: userId, date, type, distance_km: kmNum, duration_min: minNum })
      .select()
      .single();
    setBusy(false);
    if (error) return setError(errorES(error.message));
    setList((prev) => [{ ...(data as Activity), distance_km: Number(data.distance_km) }, ...(prev ?? [])].sort((a, b) => b.date.localeCompare(a.date)));
    setKm("");
    setMin("");
  }

  async function remove(id: number) {
    const before = list;
    setList((prev) => prev?.filter((a) => a.id !== id) ?? null);
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      setList(before);
      setError(errorES(error.message));
    }
  }

  // Km totales por tipo
  const byType = ACTIVITY_TYPES.map((t) => ({
    name: t.label,
    key: t.key,
    km: round1((list ?? []).filter((a) => a.type === t.key).reduce((s, a) => s + a.distance_km, 0)),
  }));

  // Km por semana (semanas de la carrera), apilado por tipo
  const byWeek = competitionWeeks().map((monday) => {
    const row: Record<string, number | string> = { semana: shortLabel(monday < COMPETITION_START ? COMPETITION_START : monday) };
    for (const t of ACTIVITY_TYPES) {
      row[t.label] = round1((list ?? []).filter((a) => a.type === t.key && weekStart(a.date) === monday).reduce((s, a) => s + a.distance_km, 0));
    }
    return row;
  });

  return (
    <section>
      <SectionTitle>Kilómetros</SectionTitle>

      <form onSubmit={add} className="card flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Fecha">
            <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Km">
            <input className="input" inputMode="decimal" placeholder="5.2" value={km} onChange={(e) => setKm(e.target.value)} />
          </Field>
          <Field label="Minutos">
            <input className="input" inputMode="numeric" placeholder="Opcional" value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary sm:self-end" disabled={busy}>
          <Plus size={16} /> {busy ? "Guardando" : "Agregar actividad"}
        </button>
      </form>

      {!list ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="mt-4 text-center text-fg3">Registra tu primera actividad para ver tus kilómetros aquí.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card">
              <h3 className="label mb-4">Km totales por tipo</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byType} margin={{ left: -24, right: 0, top: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval={0} />
                  <YAxis {...axisProps} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v} km`, "Distancia"]} />
                  <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                    {byType.map((t) => (
                      <Cell key={t.key} fill={TYPE_COLORS[t.key]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card flex flex-col justify-center divide-y divide-white/[0.06] py-2">
              {byType
                .filter((t) => t.km > 0)
                .map((t) => (
                  <div key={t.key} className="flex items-center gap-3 py-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t.key] }} />
                    <span className="flex-1 text-fg2">{t.name}</span>
                    <span className="display text-3xl">{t.km}</span>
                    <span className="w-6 text-xs text-fg3">km</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="card mt-3">
            <h3 className="label mb-4">Km por semana</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byWeek} margin={{ left: -20, right: 4, top: 8 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="semana" {...axisProps} interval={2} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} labelFormatter={(l) => `Semana del ${l}`} />
                {ACTIVITY_TYPES.map((t, i) => (
                  <Bar key={t.key} dataKey={t.label} stackId="km" fill={TYPE_COLORS[t.key]} radius={i === ACTIVITY_TYPES.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <ChartLegend items={ACTIVITY_TYPES.map((t) => ({ label: t.label, color: TYPE_COLORS[t.key] }))} />
          </div>

          <ul className="card mt-3 divide-y divide-white/[0.06] p-0">
            {list.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLORS[a.type] }} />
                <span className="w-12 shrink-0 text-fg3">{shortLabel(a.date)}</span>
                <span className="flex-1">{typeLabel(a.type)}</span>
                <span className="font-medium tabular-nums">{a.distance_km} km</span>
                {a.duration_min && <span className="tabular-nums text-fg3">{a.duration_min} min</span>}
                <button onClick={() => remove(a.id)} className="icon-btn hover:text-danger" aria-label="Borrar actividad">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
