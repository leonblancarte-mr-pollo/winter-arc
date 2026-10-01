"use client";
// Pantalla de inicio de sesión y registro
import { Snowflake } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ConfigMissing from "@/components/ConfigMissing";
import { ErrorBox } from "@/components/ui";
import { errorES, supabase, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Si ya hay sesión, entra directo
  useEffect(() => {
    if (!loading && user) router.replace("/calendario");
  }, [loading, user, router]);

  if (!supabaseConfigured) return <ConfigMissing />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "signup" && name.trim().length < 2) return setError("Escribe un nombre de al menos 2 letras.");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/calendario");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim().slice(0, 30) } },
        });
        if (error) throw error;
        if (data.session) router.replace("/calendario");
        else setInfo("¡Cuenta creada! Revisa tu correo y confirma tu cuenta para poder entrar.");
      }
    } catch (err) {
      setError(errorES((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <Snowflake className="mx-auto mb-3 text-ice" size={44} strokeWidth={1.75} />
        <h1 className="text-4xl font-black tracking-tight">WINTER ARC</h1>
        <p className="mt-2 text-sm text-neutral-400">1 de octubre – 31 de diciembre 2026</p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl border border-line bg-card p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              mode === m ? "bg-card2 text-white" : "text-neutral-500"
            }`}
          >
            {m === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Nombre para mostrar</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Así te verán en el ranking y chat"
              maxLength={30}
              autoComplete="nickname"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">Correo</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-400">Contraseña</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>

        {error && <ErrorBox message={error} />}
        {info && <div className="rounded-xl border border-ice/40 bg-ice/10 p-3 text-sm text-ice">{info}</div>}

        <button className="btn-primary mt-2" disabled={busy}>
          {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta y unirme"}
        </button>
      </form>
    </main>
  );
}
