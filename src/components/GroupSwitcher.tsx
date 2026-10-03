"use client";
// Botón "NOMBRE DEL GRUPO ▾" + menú: cambiar de grupo, unirse con código y (solo admin) crear grupo.
// Lo usan Stats y Chat; los dos leen el mismo grupo activo de GroupProvider.
import { Check, ChevronDown, Plus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useGroups } from "@/components/GroupProvider";
import { ErrorBox, Sheet } from "@/components/ui";

type Mode = "list" | "join" | "create";

export default function GroupSwitcher() {
  const { enabled, loading, groups, active, isAdmin, select, join, create } = useGroups();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);

  // Sin grupos.sql la app sigue como antes y el selector no aparece
  if (!enabled || loading) return null;

  function show(m: Mode) {
    setMode(m);
    setError(null);
    setCreated(null);
  }

  function close() {
    setOpen(false);
    show("list");
    setCode("");
    setName("");
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await join(code);
    setBusy(false);
    if (err) return setError(err);
    close();
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await create(name, code);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setCreated({ name: res.group.name, code: res.group.code });
    setName("");
    setCode("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-field px-4 py-2 text-sm font-semibold uppercase tracking-[0.05em] text-fg transition-colors duration-150 ease-out hover:bg-white/[0.06]"
        aria-haspopup="dialog"
      >
        <Users size={14} className="shrink-0 text-accent" aria-hidden />
        <span className="truncate">{active?.name ?? "Sin grupo"}</span>
        <ChevronDown size={14} className="shrink-0 text-fg3" aria-hidden />
      </button>

      <Sheet
        open={open}
        onClose={close}
        title={
          <h2 className="text-xl font-semibold tracking-tight">
            {mode === "join" ? "Unirme a un grupo" : mode === "create" ? "Crear grupo nuevo" : "Mis grupos"}
          </h2>
        }
      >
        {mode === "list" && (
          <>
            {groups.length === 0 ? (
              <p className="mb-4 text-sm text-fg2">Todavía no estás en ningún grupo. Pide el código a quien te invitó.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-2">
                {groups.map((g) => {
                  const current = g.id === active?.id;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => {
                          select(g.id);
                          close();
                        }}
                        aria-pressed={current}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors duration-150 ease-out hover:bg-white/[0.04] ${
                          current ? "border-accent/30 bg-white/[0.06]" : "border-line"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-fg">{g.name}</span>
                          <span className="text-xs tabular-nums text-fg3">Código {g.code}</span>
                        </span>
                        {current && <Check size={16} className="shrink-0 text-accent" aria-label="Grupo activo" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => show("join")} className="btn-secondary inline-flex items-center justify-center gap-2">
                <UserPlus size={16} /> Unirme a un grupo
              </button>
              {isAdmin && (
                <button type="button" onClick={() => show("create")} className="btn-secondary inline-flex items-center justify-center gap-2">
                  <Plus size={16} /> Crear grupo nuevo
                </button>
              )}
            </div>
          </>
        )}

        {mode === "join" && (
          <form onSubmit={onJoin} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="label">Código del grupo</span>
              <input
                className="input uppercase tracking-[0.2em]"
                placeholder="X7K2P9"
                value={code}
                maxLength={12}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
            </label>
            {error && <ErrorBox message={error} />}
            <button type="submit" className="btn-primary" disabled={!code.trim() || busy}>
              {busy ? "Validando…" : "Unirme"}
            </button>
            <button type="button" onClick={() => show("list")} className="text-sm text-fg2 underline underline-offset-2">
              Volver
            </button>
          </form>
        )}

        {mode === "create" && (
          <form onSubmit={onCreate} className="flex flex-col gap-3">
            {created && (
              <div className="rounded-lg border border-done/30 bg-done/[0.06] px-3 py-3 text-sm text-fg">
                Grupo <b>{created.name}</b> creado. Comparte este código para que se unan:
                <div className="display mt-2 text-3xl tracking-[0.2em] text-done">{created.code}</div>
              </div>
            )}
            <label className="flex flex-col gap-1">
              <span className="label">Nombre</span>
              <input className="input" placeholder="Los del gym" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label">Código (opcional)</span>
              <input
                className="input uppercase tracking-[0.2em]"
                placeholder="Se genera solo"
                value={code}
                maxLength={12}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
              <span className="text-xs text-fg3">De 4 a 12 letras o números. Déjalo vacío para generar uno.</span>
            </label>
            {error && <ErrorBox message={error} />}
            <button type="submit" className="btn-primary" disabled={!name.trim() || busy}>
              {busy ? "Creando…" : "Crear grupo"}
            </button>
            <button type="button" onClick={() => show("list")} className="text-sm text-fg2 underline underline-offset-2">
              Volver
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}
