"use client";
// Evidencia para tachar un hábito de hoy o de ayer: sin foto no se marca.
// En Cardio también se registra la actividad (tipo, km, minutos), que da el bonus por distancia.
import { Camera } from "lucide-react";
import { useState } from "react";
import { ErrorBox, Sheet } from "@/components/ui";
import { CARDIO_DISTANCE_BONUS, CARDIO_DISTANCE_MIN_KM, HABITS, type CardioType } from "@/lib/constants";

export type CardioActivity = { type: CardioType; km: number; min: number | null };

const CARDIO_TYPES: { key: CardioType; label: string }[] = [
  { key: "running", label: "Running" },
  { key: "bici", label: "Bici" },
  { key: "natacion", label: "Natación" },
];

export default function HabitPhotoModal({
  habitKey,
  isYesterday = false,
  onClose,
  onSave,
}: {
  habitKey: string | null;
  // Se está tachando el día de ayer (cambia el texto de la instrucción)
  isYesterday?: boolean;
  onClose: () => void;
  onSave: (habitKey: string, file: File, activity: CardioActivity | null) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [cardioType, setCardioType] = useState<CardioType>("running");
  const [km, setKm] = useState("");
  const [min, setMin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const habit = HABITS.find((h) => h.key === habitKey);
  if (!habitKey || !habit) return null;
  const isCardio = habitKey === "cardio";
  const minKm = CARDIO_DISTANCE_MIN_KM[cardioType];
  const kmNum = Number(km.replace(",", "."));
  const earnsBonus = isCardio && Number.isFinite(kmNum) && kmNum >= minKm;

  function close() {
    setFile(null);
    setError(null);
    onClose();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) return setError("El archivo debe ser una imagen.");
    if (file.size > 10 * 1024 * 1024) return setError("La foto pesa más de 10 MB. Usa una más ligera.");
    let activity: CardioActivity | null = null;
    if (isCardio) {
      const kmNum = Number(km.replace(",", "."));
      const minNum = min.trim() ? Number(min) : null;
      if (!Number.isFinite(kmNum) || kmNum <= 0 || kmNum >= 1000) return setError("Escribe los km (un número mayor a 0).");
      if (minNum != null && (!Number.isInteger(minNum) || minNum <= 0)) return setError("Los minutos deben ser un número entero.");
      activity = { type: cardioType, km: Math.round(kmNum * 100) / 100, min: minNum };
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(habitKey!, file, activity);
      setFile(null);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open stacked onClose={close} title={<div className="text-xl font-semibold">Evidencia: {habit.label}</div>}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <p className="text-fg2">
          {habitKey === "pantalla"
            ? "Sube una captura de pantalla de tu Tiempo de Uso (iPhone: Ajustes > Tiempo de Uso) o Bienestar Digital (Android), mostrando el día de AYER."
            : habitKey === "dieta"
            ? `Sube una foto de tus macros del día o de alguna de tus comidas de ${isYesterday ? "ayer" : "hoy"}.`
            : `Sube una foto que confirme que lo hiciste ${isYesterday ? "ayer" : "hoy"}.`}
        </p>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/[0.12] bg-field px-3 py-4 text-fg2 transition-colors duration-150 hover:border-accent">
          <Camera size={16} className="shrink-0 text-accent" />
          <span className={`truncate ${file ? "text-fg" : ""}`}>{file ? file.name : habitKey === "pantalla" ? "Elegir captura" : "Tomar o elegir foto"}</span>
          {/* Sin "capture": así Safari y Chrome móvil ofrecen Tomar foto / Fototeca / Examinar */}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {isCardio && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de cardio">
              {CARDIO_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={cardioType === t.key}
                  onClick={() => setCardioType(t.key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    cardioType === t.key ? "border-accent bg-accent/10 text-fg" : "border-line text-fg2 hover:bg-raised"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="label">Km</span>
                <input className="input" inputMode="decimal" placeholder="5.2" value={km} onChange={(e) => setKm(e.target.value)} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="label">Minutos</span>
                <input className="input" inputMode="numeric" placeholder="Opcional" value={min} onChange={(e) => setMin(e.target.value)} />
              </label>
            </div>
            <p className={`text-xs ${earnsBonus ? "text-done" : "text-fg3"}`}>
              {earnsBonus ? `¡Ganas +${CARDIO_DISTANCE_BONUS} pts extra por distancia!` : `+${CARDIO_DISTANCE_BONUS} pts extra desde ${minKm} km.`}
            </p>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={!file || busy || (isCardio && !km.trim())}>
          {busy ? "Guardando" : "Guardar"}
        </button>
      </form>
    </Sheet>
  );
}
