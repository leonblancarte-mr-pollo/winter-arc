"use client";
// Hábitos personales del usuario (privados, sin puntos). Necesitan internet: no usan la cola offline.
// Si la tabla aún no existe (no se corrió habitos_personales.sql), la lista queda vacía sin romper nada.
import { useCallback, useEffect, useState } from "react";
import { COMPETITION_END, COMPETITION_START } from "./constants";
import { errorES, fetchAll, supabase } from "./supabase";
import type { CustomHabit } from "./types";

// Fecha -> ids de hábitos personales cumplidos ese día
export type CustomChecks = Record<string, Set<number>>;

export function useCustomHabits(userId: string) {
  const [habits, setHabits] = useState<CustomHabit[]>([]);
  const [checks, setChecks] = useState<CustomChecks>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, rows] = await Promise.all([
        supabase.from("custom_habits").select("*").eq("user_id", userId).eq("archived", false).order("id"),
        fetchAll<{ date: string; custom_habit_id: number }>((f, t) =>
          supabase
            .from("custom_habit_checks")
            .select("date,custom_habit_id")
            .eq("user_id", userId)
            .gte("date", COMPETITION_START)
            .lte("date", COMPETITION_END)
            .order("id")
            .range(f, t),
        ),
      ]);
      if (h.error) throw new Error(h.error.message);
      const grouped: CustomChecks = {};
      for (const r of rows) (grouped[r.date] ??= new Set()).add(r.custom_habit_id);
      setHabits((h.data ?? []) as CustomHabit[]);
      setChecks(grouped);
    } catch {
      // Tabla inexistente o sin conexión: simplemente no hay hábitos personales que mostrar
    } finally {
      setReady(true);
    }
  }, [userId]);

  useEffect(() => {
    // Carga al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const applyLocal = useCallback((date: string, id: number, on: boolean) => {
    setChecks((prev) => {
      const s = new Set(prev[date] ?? []);
      if (on) s.add(id);
      else s.delete(id);
      return { ...prev, [date]: s };
    });
  }, []);

  const toggle = useCallback(
    async (date: string, id: number, on: boolean) => {
      setError(null);
      applyLocal(date, id, on);
      const { error } = on
        ? await supabase
            .from("custom_habit_checks")
            .upsert({ user_id: userId, custom_habit_id: id, date }, { onConflict: "user_id,custom_habit_id,date", ignoreDuplicates: true })
        : await supabase.from("custom_habit_checks").delete().match({ user_id: userId, custom_habit_id: id, date });
      if (error) {
        applyLocal(date, id, !on);
        setError(`No se pudo guardar: ${errorES(error.message)}`);
      }
    },
    [userId, applyLocal],
  );

  // Regresa true si se creó
  const add = useCallback(
    async (name: string) => {
      setError(null);
      const { data, error } = await supabase.from("custom_habits").insert({ user_id: userId, name: name.trim() }).select().single();
      if (error) {
        setError(`No se pudo crear: ${errorES(error.message)}`);
        return false;
      }
      setHabits((prev) => [...prev, data as CustomHabit]);
      return true;
    },
    [userId],
  );

  // Archivar: se oculta pero conserva su historial
  const archive = useCallback(async (id: number) => {
    setError(null);
    const { error } = await supabase.from("custom_habits").update({ archived: true }).eq("id", id);
    if (error) return setError(`No se pudo archivar: ${errorES(error.message)}`);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { habits, checks, ready, error, toggle, add, archive };
}
