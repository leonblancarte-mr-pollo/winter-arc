"use client";
// Carga mis hábitos y bonus, y permite marcar/desmarcar al instante
// (la pantalla se actualiza primero y luego se confirma con la base de datos).
import { useCallback, useEffect, useRef, useState } from "react";
import { COMPETITION_END, COMPETITION_START } from "./constants";
import { groupChecks, type ChecksByDate } from "./points";
import { errorES, fetchAll, supabase } from "./supabase";
import type { BonusEvent, HabitCheck } from "./types";

export function useMyData(userId: string) {
  const [checks, setChecks] = useState<ChecksByDate>({});
  const [bonuses, setBonuses] = useState<BonusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cola por hábito/día para que los toques rápidos se guarden en orden
  const queues = useRef<Record<string, Promise<void>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, b] = await Promise.all([
        fetchAll<HabitCheck>((from, to) =>
          supabase
            .from("habit_checks")
            .select("user_id,date,habit_key")
            .eq("user_id", userId)
            .gte("date", COMPETITION_START)
            .lte("date", COMPETITION_END)
            .range(from, to),
        ),
        supabase.from("bonus_events").select("*").eq("user_id", userId).order("date", { ascending: false }),
      ]);
      if (b.error) throw new Error(b.error.message);
      setChecks(groupChecks(rows));
      setBonuses((b.data ?? []) as BonusEvent[]);
    } catch (e) {
      setError(errorES((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Carga datos de Supabase al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Cambia el estado local de un hábito
  const setLocal = (date: string, key: string, on: boolean) =>
    setChecks((prev) => {
      const next = { ...prev };
      const s = new Set(prev[date] ?? []);
      if (on) s.add(key);
      else s.delete(key);
      next[date] = s;
      return next;
    });

  const toggle = useCallback(
    (date: string, key: string, on: boolean) => {
      setLocal(date, key, on); // 1) actualiza la pantalla al instante
      const id = `${date}|${key}`;
      const prev = queues.current[id] ?? Promise.resolve();
      queues.current[id] = prev.then(async () => {
        // 2) confirma con la base de datos
        const { error } = on
          ? await supabase
              .from("habit_checks")
              .upsert({ user_id: userId, date, habit_key: key }, { onConflict: "user_id,date,habit_key", ignoreDuplicates: true })
          : await supabase.from("habit_checks").delete().match({ user_id: userId, date, habit_key: key });
        if (error) {
          setLocal(date, key, !on); // 3) si falló, regresa como estaba
          setError(`No se pudo guardar: ${errorES(error.message)}`);
        }
      });
    },
    [userId],
  );

  const addBonusLocal = useCallback((b: BonusEvent) => setBonuses((prev) => [b, ...prev]), []);

  const markLocal = useCallback((date: string, key: string) => setLocal(date, key, true), []);

  return { checks, bonuses, loading, error, setError, reload: load, toggle, addBonusLocal, markLocal };
}
