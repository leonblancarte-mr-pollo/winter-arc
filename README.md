# WINTER ARC

Competencia de hábitos entre amigos · 1 oct – 31 dic 2026.

- `supabase/migracion.sql` → pegar en Supabase > SQL Editor y correr (una sola vez).
- `.env.local` → poner `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `npm run dev` → abre http://localhost:3000

Archivos clave:
- `src/lib/constants.ts` → hábitos, fechas, puntos y bonus (cámbialos aquí).
- `src/lib/points.ts` → cálculo de puntos, rachas y bonus semanales.
- `src/lib/hevy.ts` → lector del CSV de Hevy.
- `src/app/(app)/calendario | stats | chat` → las 3 pantallas.
