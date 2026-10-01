// Aviso cuando faltan las llaves de Supabase en .env.local
import { Wordmark } from "./ui";

export default function ConfigMissing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <Wordmark />
      <h1 className="text-xl font-semibold">Falta conectar Supabase</h1>
      <p className="text-fg2">
        Abre el archivo <code className="text-accent">.env.local</code> y pega tu Project URL y tu anon key de Supabase. Después
        detén la app con Ctrl + C y vuelve a correr <code className="text-accent">npm run dev</code>.
      </p>
    </main>
  );
}
