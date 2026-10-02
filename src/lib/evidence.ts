"use client";
// Evidencia fotográfica de hábitos: qué foto corresponde a qué (usuario, día, hábito).
// Las fotos viven en el bucket privado "evidencias"; se ven con URLs firmadas temporales.
// Si la tabla aún no existe (no se corrió evidencia_habitos.sql), todo queda vacío sin romper nada.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type HabitEvidence = { date: string; habit_key: string; photo_path: string };

// Regresa la URL temporal de la foto, o el motivo por el que no se pudo
export async function signedPhotoUrl(path: string): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60);
  if (error || !data) {
    console.error("[evidencia] no se pudo firmar", path, error);
    return { error: error?.message ?? "sin respuesta" };
  }
  return { url: data.signedUrl };
}

// Mi evidencia (o la de otra persona) y funciones para guardarla/quitarla
export function useEvidence(userId: string) {
  const [rows, setRows] = useState<HabitEvidence[]>([]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("habit_evidence")
      .select("date,habit_key,photo_path")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (alive && !error) setRows((data ?? []) as HabitEvidence[]);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Sube la foto y guarda la referencia. Lanza un Error con mensaje si algo falla.
  const save = useCallback(
    async (date: string, habitKey: string, file: File) => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/habitos/${date}_${habitKey}_${Date.now()}.${ext}`;
      const up = await supabase.storage.from("evidencias").upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(`No se pudo subir la foto: ${up.error.message}`);
      const { error } = await supabase.from("habit_evidence").insert({ user_id: userId, date, habit_key: habitKey, photo_path: path });
      if (error) {
        await supabase.storage.from("evidencias").remove([path]);
        throw new Error(`No se pudo guardar la evidencia: ${error.message}`);
      }
      setRows((prev) => [...prev.filter((r) => !(r.date === date && r.habit_key === habitKey)), { date, habit_key: habitKey, photo_path: path }]);
    },
    [userId],
  );

  // Al destachar: se borra solo la referencia. La foto se queda en Storage porque el anuncio
  // que ya se publicó en el chat sigue apuntando a ella.
  const remove = useCallback(
    async (date: string, habitKey: string) => {
      const row = rows.find((r) => r.date === date && r.habit_key === habitKey);
      if (!row) return;
      setRows((prev) => prev.filter((r) => r !== row));
      await supabase.from("habit_evidence").delete().match({ user_id: userId, date, habit_key: habitKey });
    },
    [userId, rows],
  );

  return { rows, save, remove };
}

// URLs de las fotos de un día (hábito -> URL firmada), para mostrarlas en el panel del día
export function useDayPhotos(rows: HabitEvidence[], date: string | null) {
  const [urls, setUrls] = useState<{ key: string; map: Record<string, string> }>({ key: "", map: {} });
  const mine = date ? rows.filter((r) => r.date === date) : [];
  const key = date ? `${date}|${mine.map((r) => r.photo_path).join(",")}` : "";

  useEffect(() => {
    if (!key || !mine.length) return;
    let alive = true;
    Promise.all(mine.map(async (r) => [r.habit_key, await signedPhotoUrl(r.photo_path)] as const)).then((pairs) => {
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const [k, u] of pairs) if ("url" in u) map[k] = u.url;
      setUrls({ key, map });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls.key === key ? urls.map : {};
}
