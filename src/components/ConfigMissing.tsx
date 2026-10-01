// Aviso cuando faltan las llaves de Supabase en .env.local
export default function ConfigMissing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-black text-ice">Falta conectar Supabase</h1>
      <p className="text-neutral-300">
        Abre el archivo <code className="text-ice">.env.local</code> y pega tu <b>Project URL</b> y tu{" "}
        <b>anon key</b> de Supabase. Después detén la app (Ctrl + C) y vuelve a correr{" "}
        <code className="text-ice">npm run dev</code>.
      </p>
    </main>
  );
}
