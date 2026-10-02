// TEMPORAL: muestra qué llave está leyendo el servidor, SIN revelarla completa.
// Solo enseña los primeros 14 caracteres (el tipo de llave + 4 letras) y su tamaño,
// y qué deploy de Vercel está respondiendo. BORRAR cuando el casino funcione.
export const dynamic = "force-dynamic";

export function GET() {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = raw?.trim() ?? "";
  const tipo = !key
    ? "NO HAY LLAVE"
    : key.startsWith("sb_secret_")
      ? "Secret key (correcta)"
      : key.startsWith("sb_publishable_")
        ? "Publishable key (INCORRECTA: es la pública)"
        : key.startsWith("eyJ")
          ? "Llave JWT antigua (revisar si es service_role o anon)"
          : "Formato desconocido";

  return Response.json({
    llave_tipo: tipo,
    llave_inicio: key ? key.slice(0, 14) + "…" : null,
    llave_largo: key.length,
    llave_tiene_espacios_o_comillas: raw ? raw !== key || /["'\s]/.test(key) : false,
    vercel_ambiente: process.env.VERCEL_ENV ?? "local",
    vercel_deploy: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    vercel_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    vercel_proyecto: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    hora_servidor: new Date().toISOString(),
  });
}
