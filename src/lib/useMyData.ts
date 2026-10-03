"use client";
// Carga mis hábitos y bonus, y permite marcar/desmarcar al instante.
// Funciona sin internet: cada toque se guarda primero en una cola local (IndexedDB) y
// la pantalla se actualiza de inmediato; la subida a Supabase pasa en segundo plano y
// se reintenta sola hasta que haya conexión. Mientras no se suba, nadie más lo ve:
// los demás solo leen lo que de verdad ya está guardado en Supabase.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMPETITION_END, COMPETITION_START } from "./constants";
import { isEditableDay, todayMX } from "./dates";
import { addPendingAction, getPendingActions, markActionSynced, pruneSyncedActions, type HabitAction } from "./offlineDb";
import { groupChecks, type ChecksByDate, type PointEvent } from "./points";
import { fetchSpentPoints, type SpentPoint } from "./spentPoints";
import { errorES, fetchAll, supabase } from "./supabase";
import type { BonusEvent, HabitCheck } from "./types";

// Cada cuánto se revisa si hay cambios pendientes de subir
const SYNC_INTERVAL_MS = 5000;

export function useMyData(userId: string) {
  const [checks, setChecks] = useState<ChecksByDate>({});
  const [bonuses, setBonuses] = useState<BonusEvent[]>([]);
  // Puntos gastados en el casino (se restan del total)
  const [spent, setSpent] = useState<SpentPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Cuántos cambios todavía no se han subido a Supabase (para el badge "Sincronizando")
  const [pendingCount, setPendingCount] = useState(0);
  // Evita que dos sincronizaciones corran al mismo tiempo (intervalo + evento "online" + toque)
  const syncingRef = useRef(false);

  // Aplica un cambio de hábito sobre el estado local (sin tocar la red)
  const applyLocal = useCallback((date: string, key: string, on: boolean) => {
    setChecks((prev) => {
      const next = { ...prev };
      const s = new Set(prev[date] ?? []);
      if (on) s.add(key);
      else s.delete(key);
      next[date] = s;
      return next;
    });
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount((await getPendingActions(userId)).length);
    } catch {
      // Sin IndexedDB no hay cola que contar
    }
  }, [userId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, b, pending, sp] = await Promise.all([
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
        getPendingActions(userId).catch(() => [] as HabitAction[]),
        fetchSpentPoints(userId),
      ]);
      if (b.error) throw new Error(b.error.message);
      // Encima de lo que ya está en Supabase, aplica lo que todavía no se ha subido,
      // para no perderlo si la pantalla se recarga antes de que vuelva la conexión.
      const grouped = groupChecks(rows);
      for (const a of pending) {
        const s = new Set(grouped[a.date] ?? []);
        if (a.action === "add") s.add(a.habit_key);
        else s.delete(a.habit_key);
        grouped[a.date] = s;
      }
      setChecks(grouped);
      setBonuses((b.data ?? []) as BonusEvent[]);
      setSpent(sp);
      setPendingCount(pending.length);
    } catch (e) {
      setError(errorES((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Sube a Supabase las acciones que sigan pendientes, en el orden en que se crearon.
  // Se detiene en el primer error (normalmente significa que no hay internet) y lo
  // vuelve a intentar en el siguiente ciclo; si ya existe en Supabase, lo ignora.
  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const pending = await getPendingActions(userId);
      const today = todayMX();
      for (const a of pending) {
        // Quedó en cola hasta que el día ya no se puede editar: se descarta (la base lo rechazaría
        // y atoraría la cola). Al recargar, la pantalla muestra lo que de verdad quedó guardado.
        if (!isEditableDay(a.date, today)) {
          await markActionSynced(a.id);
          continue;
        }
        const { error } =
          a.action === "add"
            ? await supabase
                .from("habit_checks")
                .upsert({ user_id: a.user_id, date: a.date, habit_key: a.habit_key }, { onConflict: "user_id,date,habit_key", ignoreDuplicates: true })
            : await supabase.from("habit_checks").delete().match({ user_id: a.user_id, date: a.date, habit_key: a.habit_key });
        if (error) break; // probablemente sin internet: para aquí, se reintenta solo
        await markActionSynced(a.id);
      }
      await refreshPendingCount();
      await pruneSyncedActions();
    } catch {
      // Sin conexión o sin IndexedDB: se reintenta en el siguiente ciclo
    } finally {
      syncingRef.current = false;
    }
  }, [userId, refreshPendingCount]);

  useEffect(() => {
    // Carga datos de Supabase al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Reintenta subir lo pendiente cada 5 segundos y en cuanto vuelve la conexión a internet
  useEffect(() => {
    // Primer intento al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void sync();
    const interval = setInterval(sync, SYNC_INTERVAL_MS);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", sync);
    };
  }, [sync]);

  const toggle = useCallback(
    (date: string, key: string, on: boolean) => {
      applyLocal(date, key, on); // 1) actualiza la pantalla al instante
      (async () => {
        try {
          // 2) guarda en la cola local primero (funciona sin internet)
          await addPendingAction({ user_id: userId, date, habit_key: key, action: on ? "add" : "remove", created_at: Date.now() });
          setPendingCount((c) => c + 1);
          void sync(); // 3) intenta subirlo ya mismo, por si hay conexión
        } catch {
          // Sin IndexedDB (navegador muy viejo o modo privado estricto): guarda directo
          const { error } = on
            ? await supabase
                .from("habit_checks")
                .upsert({ user_id: userId, date, habit_key: key }, { onConflict: "user_id,date,habit_key", ignoreDuplicates: true })
            : await supabase.from("habit_checks").delete().match({ user_id: userId, date, habit_key: key });
          if (error) {
            applyLocal(date, key, !on); // revierte si falló
            setError(`No se pudo guardar: ${errorES(error.message)}`);
          }
        }
      })();
    },
    [userId, applyLocal, sync],
  );

  const addBonusLocal = useCallback((b: BonusEvent) => setBonuses((prev) => [b, ...prev]), []);

  const markLocal = useCallback((date: string, key: string) => applyLocal(date, key, true), [applyLocal]);

  // Todo lo que suma o resta puntos además de los hábitos: bonus y compras de peseis
  const pointEvents = useMemo<PointEvent[]>(() => [...bonuses, ...spent], [bonuses, spent]);

  return { checks, bonuses, pointEvents, loading, error, setError, reload: load, toggle, addBonusLocal, markLocal, pendingCount };
}
