"use client";
// Formularios de bonus: "Terminé un libro" (+5) y "Corrí 21 km" (+50)
import { ImagePlus } from "lucide-react";
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

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  today: string;
  onSaved: (b: BonusEvent) => void;
  defaultDate?: string;
};

// Fecha que se puede usar hoy dentro de la carrera
const clampToday = (today: string) => (today > COMPETITION_END ? COMPETITION_END : today);

function Title({ text, points }: { text: string; points: number }) {
  return (
    <div>
      <div className="text-xl font-semibold">{text}</div>
      <div className="mt-1 text-fg2">+{points} puntos</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label">{label}</span>
      {children}
      {hint}
    </label>
  );
}

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
    <Sheet open={open} onClose={onClose} title={<Title text="Terminé un libro" points={BOOK_BONUS} />}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Título">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        </Field>
        <Field
          label="Reseña"
          hint={
            <span className={`text-xs tabular-nums ${reviewLen >= BOOK_REVIEW_MIN_CHARS ? "text-done" : "text-fg3"}`}>
              {reviewLen} de {BOOK_REVIEW_MIN_CHARS} caracteres mínimos
            </span>
          }
        >
          <textarea
            className="input min-h-32 resize-y"
            placeholder="De qué trata y qué te dejó"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            maxLength={2000}
          />
        </Field>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Guardando" : "Guardar libro"}
        </button>
      </form>
    </Sheet>
  );
}

export function HalfMarathonForm({ open, onClose, userId, today, onSaved, defaultDate }: Props) {
  const maxDate = clampToday(today);
  const [date, setDate] = useState(defaultDate && defaultDate >= COMPETITION_START && defaultDate <= maxDate ? defaultDate : maxDate);
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
    <Sheet open={open} onClose={onClose} title={<Title text="Corrí 21 km" points={HALF_MARATHON_BONUS} />}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input className="input" type="date" value={date} min={COMPETITION_START} max={maxDate} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Kilómetros">
            <input className="input" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
          </Field>
        </div>
        <Field label="Evidencia">
          <span className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/[0.12] bg-field px-3 py-4 text-fg2 transition-colors duration-150 hover:border-accent">
            <ImagePlus size={16} className="shrink-0 text-accent" />
            <span className={`truncate ${file ? "text-fg" : ""}`}>{file ? file.name : "Sube una foto de tu reloj o app"}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </span>
        </Field>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Subiendo" : "Guardar carrera"}
        </button>
      </form>
    </Sheet>
  );
}
