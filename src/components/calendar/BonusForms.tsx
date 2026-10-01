"use client";
// Formularios de bonus: "Terminé un libro" (+5) y "Corrí 21 km" (+50)
import { Camera } from "lucide-react";
import { useState } from "react";
import { ErrorBox, Sheet } from "@/components/ui";
import {
  BOOK_BONUS,
  BOOK_REVIEW_MIN_CHARS,
  COMPETITION_END,
  COMPETITION_START,
  HALF_MARATHON_BONUS,
  HALF_MARATHON_MIN_KM,
} from "@/lib/constants";
import { errorES, supabase } from "@/lib/supabase";
import type { BonusEvent } from "@/lib/types";

type Props = { open: boolean; onClose: () => void; userId: string; today: string; onSaved: (b: BonusEvent) => void };

// Fecha que se puede usar hoy dentro de la carrera
const clampToday = (today: string) => (today > COMPETITION_END ? COMPETITION_END : today);

export function BookForm({ open, onClose, userId, today, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewLen = review.trim().length;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Escribe el título del libro.");
    if (reviewLen < BOOK_REVIEW_MIN_CHARS) return setError(`La reseña debe tener al menos ${BOOK_REVIEW_MIN_CHARS} caracteres.`);
    if (today < COMPETITION_START) return setError("La carrera aún no empieza.");
    setBusy(true);
    const { data, error } = await supabase
      .from("bonus_events")
      .insert({
        user_id: userId,
        type: "book",
        points: BOOK_BONUS,
        date: clampToday(today),
        book_title: title.trim(),
        review_text: review.trim(),
      })
      .select()
      .single();
    setBusy(false);
    if (error) return setError(errorES(error.message));
    onSaved(data as BonusEvent);
    setTitle("");
    setReview("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Terminé un libro · +${BOOK_BONUS}`}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">Título del libro</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">Reseña (¿de qué trata?, ¿qué aprendiste?)</span>
          <textarea className="input min-h-32" value={review} onChange={(e) => setReview(e.target.value)} maxLength={2000} />
          <span className={`text-xs ${reviewLen >= BOOK_REVIEW_MIN_CHARS ? "text-done" : "text-neutral-500"}`}>
            {reviewLen}/{BOOK_REVIEW_MIN_CHARS} caracteres mínimo
          </span>
        </label>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Guardando…" : `Guardar y ganar +${BOOK_BONUS}`}
        </button>
      </form>
    </Sheet>
  );
}

export function HalfMarathonForm({ open, onClose, userId, today, onSaved }: Props) {
  const maxDate = clampToday(today);
  const [date, setDate] = useState(maxDate);
  const [km, setKm] = useState("21.1");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const kmNum = Number(km.replace(",", "."));
    if (!date || date < COMPETITION_START || date > maxDate) return setError("La fecha debe estar dentro de la carrera y no puede ser futura.");
    if (!Number.isFinite(kmNum) || kmNum < HALF_MARATHON_MIN_KM) return setError(`Deben ser al menos ${HALF_MARATHON_MIN_KM} km.`);
    if (!file) return setError("Sube una foto como evidencia (captura de Strava, reloj, etc.).");
    if (!file.type.startsWith("image/")) return setError("El archivo debe ser una imagen.");
    if (file.size > 10 * 1024 * 1024) return setError("La foto pesa más de 10 MB. Usa una más ligera.");

    setBusy(true);
    try {
      // 1) Sube la foto a la carpeta del usuario
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("evidencias").upload(path, file, { contentType: file.type });
      if (up.error) throw new Error(`No se pudo subir la foto: ${errorES(up.error.message)}`);

      // 2) Registra el bonus
      const { data, error } = await supabase
        .from("bonus_events")
        .insert({ user_id: userId, type: "half_marathon", points: HALF_MARATHON_BONUS, date, distance_km: kmNum, photo_path: path })
        .select()
        .single();
      if (error) {
        await supabase.storage.from("evidencias").remove([path]);
        throw new Error(errorES(error.message));
      }
      onSaved(data as BonusEvent);
      setFile(null);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Corrí 21 km · +${HALF_MARATHON_BONUS}`}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Fecha</span>
            <input className="input" type="date" value={date} min={COMPETITION_START} max={maxDate} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Kilómetros</span>
            <input className="input" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
          </label>
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-card2 p-5 text-center text-sm text-neutral-400 hover:border-ice">
          <Camera className="text-ice" />
          {file ? <span className="text-white">{file.name}</span> : <span>Toca para subir la foto de evidencia</span>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Subiendo…" : `Guardar y ganar +${HALF_MARATHON_BONUS}`}
        </button>
      </form>
    </Sheet>
  );
}
