"use client";
// Evidencia para tachar un hábito de hoy: sin foto no se marca
import { Camera } from "lucide-react";
import { useState } from "react";
import { ErrorBox, Sheet } from "@/components/ui";
import { HABITS } from "@/lib/constants";

export default function HabitPhotoModal({
  habitKey,
  onClose,
  onSave,
}: {
  habitKey: string | null;
  onClose: () => void;
  onSave: (habitKey: string, file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const habit = HABITS.find((h) => h.key === habitKey);
  if (!habitKey || !habit) return null;

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
    setBusy(true);
    setError(null);
    try {
      await onSave(habitKey!, file);
      setFile(null);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={close} title={<div className="text-xl font-semibold">Evidencia: {habit.label}</div>}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <p className="text-fg2">
          {habitKey === "pantalla"
            ? "Sube una captura de pantalla de tu Tiempo de Uso (iPhone: Ajustes > Tiempo de Uso) o Bienestar Digital (Android), mostrando el día de AYER."
            : "Sube una foto que confirme que lo hiciste hoy."}
        </p>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/[0.12] bg-field px-3 py-4 text-fg2 transition-colors duration-150 hover:border-accent">
          <Camera size={16} className="shrink-0 text-accent" />
          <span className={`truncate ${file ? "text-fg" : ""}`}>{file ? file.name : habitKey === "pantalla" ? "Elegir captura" : "Tomar o elegir foto"}</span>
          {/* Sin "capture" para la captura de pantalla (viene de la galería); con "capture" abre la cámara directo */}
          <input
            type="file"
            accept="image/*"
            capture={habitKey === "pantalla" ? undefined : "environment"}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={!file || busy}>
          {busy ? "Guardando" : "Guardar"}
        </button>
      </form>
    </Sheet>
  );
}
