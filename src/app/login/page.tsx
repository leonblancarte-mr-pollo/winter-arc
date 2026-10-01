"use client";
// Pantalla de inicio de sesión y registro
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ConfigMissing from "@/components/ConfigMissing";
import { ErrorBox, Notice, Wordmark } from "@/components/ui";
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
        else setInfo("Cuenta creada. Confirma tu correo desde el enlace que te enviamos y luego entra.");
      }
    } catch (err) {
      setError(errorES((err as Error).message));
    } finally {
      setBusy(false);
    }
  }


  const switchMode = (m: "login" | "signup") => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-12 text-center">
        <Wordmark size="lg" />
        <p className="mt-3 text-fg2">1 de octubre al 31 de diciembre</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <Field label="Nombre para mostrar" hint="Así te verán en el ranking y en el chat">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoComplete="nickname"
            />
          </Field>
        )}
        <Field label="Correo">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Contraseña">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Mínimo 6 caracteres" : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </Field>

        {error && <ErrorBox message={error} />}
        {info && <Notice>{info}</Notice>}

        <button className="btn-primary mt-2" disabled={busy}>
          {busy ? "Un momento" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-fg2">
        {mode === "login" ? "¿Primera vez aquí? " : "¿Ya tienes cuenta? "}
        <button
          type="button"
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          className="font-medium text-fg underline decoration-fg3 underline-offset-4 transition-colors duration-150 hover:decoration-fg"
        >
          {mode === "login" ? "Crea tu cuenta" : "Entra"}
        </button>
      </p>

      <p className="mt-16 text-center text-xs text-zinc-500">La disciplina no se negocia.</p>
    </main>
  );
}

// Campo con etiqueta pequeña arriba
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-fg3">{hint}</span>}
    </label>
  );
}
