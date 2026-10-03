# WINTER ARC — DOCUMENTACIÓN DE ARQUITECTURA

> Última actualización: 2026-10-03 (Edición solo de hoy y ayer — `supabase/edicion_hoy_ayer.sql`; antes ese día, Grupos — `supabase/grupos.sql`).
> Versión Word: `DOCUMENTACION_ARQUITECTURA_COMPLETA.docx` (mismo contenido).
> Audiencia: quien necesite continuar el proyecto sin preguntar.

## CHANGELOG

- 2026-10-03 — **Edición solo hoy y ayer**: los hábitos (oficiales y personales) solo se tachan/destachan hoy o ayer; antes de ayer es de solo lectura. Aplica al panel del día, a la importación de Hevy y a la cola offline, y lo refuerza RLS. No cambia ningún dato ya guardado.
- 2026-10-03 — **Grupos**: el ranking de la carrera y el chat pasan a ser por grupo. Casino, ajedrez, hábitos, puntos, racha y evidencia siguen globales/por usuario. Grupo "WINTER ARC ORIGINAL" con todos los usuarios existentes. Solo el admin crea grupos; cualquiera se une con código.
- 2026-10-03 — Primera versión de este documento (antes solo existía el README).

## 1. Qué es

Competencia de hábitos entre amigos del 1 de octubre al 31 de diciembre de 2026. Cada usuario marca sus hábitos diarios en un calendario, gana puntos, compite en un ranking, chatea, y tiene extras: casino con moneda ficticia (peseis) y ajedrez entre usuarios.

## 2. Stack

| Pieza | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, Recharts, lucide-react |
| Backend de datos | Supabase (Postgres + Auth + Storage + Realtime), con RLS en todas las tablas |
| Lógica de servidor | Rutas `src/app/api/*` (casino y ajedrez) con la llave `service_role`; funciones SQL `security definer` |
| Hosting | Vercel |

El navegador solo usa la llave pública (anon). Toda regla de negocio que importe (puntos, apuestas, permisos) se valida en la base de datos o en las rutas del servidor.

## 3. Estructura de carpetas

```
src/
  app/
    login/                    Inicio de sesión / registro
    (app)/layout.tsx          Protege las pantallas con sesión; monta GroupProvider, BottomNav y DailyBanner
    (app)/calendario          Marcar hábitos, bonus (libro, medio maratón), evidencia fotográfica
    (app)/stats               Selector de grupo + resumen, ranking del grupo, gráficas, actividad, Hevy
    (app)/chat                Chat en tiempo real del grupo activo (+ anuncios automáticos)
    (app)/casino/*            Ruleta, blackjack, tragamonedas (GLOBAL)
    (app)/ajedrez/*           Partidas entre usuarios (GLOBAL)
    (app)/perfil/[user_id]    Perfil público de un usuario
    api/casino/*, api/chess/* Lógica del servidor (service_role)
  components/
    AuthProvider.tsx          Sesión + perfil
    GroupProvider.tsx         Grupo activo, mis grupos, miembros, unirse/crear (NUEVO)
    GroupSwitcher.tsx         Botón "GRUPO ▾" y su menú (NUEVO)
    stats/Ranking.tsx         Gráfica de línea de la carrera
    ...
  lib/
    constants.ts              Hábitos, fechas, puntos
    points.ts                 Cálculo de puntos (misma lógica que la vista SQL leaderboard)
    useRanking.ts             Datos del ranking (filtrado por miembros del grupo)
    types.ts                  Tipos de las tablas
supabase/                     Scripts SQL (ver sección 5)
```

## 4. Modelo de datos (resumen)

| Tabla / vista | Para qué | Alcance |
|---|---|---|
| `profiles` | Nombre visible (+ `avatar_override`) | Usuario |
| `habit_checks` | Un hábito cumplido en un día | Usuario |
| `bonus_events` | Libro (+5), medio maratón (+50) | Usuario |
| `activities`, `workout_sets` | Km manuales, sets de Hevy (privados) | Usuario |
| `habit_evidence` | Foto de evidencia por hábito y día | Usuario |
| `custom_habits`, `custom_habit_checks` | Hábitos personales privados, sin puntos | Usuario |
| `leaderboard` (vista) | Total de puntos de cada usuario | Global (la app la filtra por grupo) |
| `casino_*`, `power_log`, `power_unlocks` | Saldo de peseis, movimientos, poderes | Global |
| `chess_*` | Partidas e invitaciones | Global |
| `groups` | Grupos (nombre, código) | **Nuevo** |
| `group_members` | Quién está en qué grupo | **Nuevo** |
| `app_admins` | Usuarios admin de la app (pueden crear grupos) | **Nuevo** |
| `messages` | Chat; ahora con `group_id` | **Por grupo** |

## 5. Scripts SQL (orden de ejecución)

1. `migracion.sql` — tablas base, RLS, vista leaderboard, bucket de evidencias, realtime del chat.
2. `anuncios_chat.sql` — `messages.is_system` y triggers que anuncian libro, medio maratón y cardio.
3. `casino.sql` → `ajedrez_y_tragamonedas.sql` → `easter_egg.sql`.
4. `habitos_personales.sql`, `evidencia_habitos.sql`.
5. **`grupos.sql`** — grupos, admins, chat por grupo y migración a "WINTER ARC ORIGINAL". Se puede repetir.
6. **`edicion_hoy_ayer.sql`** — reglas RLS de "solo hoy y ayer" (ver sección 7). Se puede repetir.

## 6. Grupos (ranking y chat por grupo)

### 6.1 Qué depende del grupo y qué no

| Por grupo | Global / por usuario (sin cambios) |
|---|---|
| Ranking de la carrera (gráfica de línea en Stats, posición y "participantes" de las tarjetas de resumen) | Hábitos, puntos, racha, bonus, evidencia (son del usuario) |
| Chat (mensajes y anuncios automáticos) | Casino (ruleta, blackjack, tragamonedas, easter egg) |
| | Ajedrez |
| | Perfil público (su posición sigue siendo global) |

Los puntos NO cambian: la vista `leaderboard` sigue calculando el total de cada usuario igual que antes. El grupo solo decide **a quién se muestra** en el ranking.

### 6.2 Base de datos (`supabase/grupos.sql`)

- `groups (id uuid, name, code único [A-Z0-9]{4,12}, created_by, created_at)`
- `group_members (id, group_id, user_id, joined_at, unique(group_id, user_id))`
- `app_admins (user_id)` — se llena una vez buscando `leon.blancarte@gmail.com` en `auth.users`. Más robusto que comparar correos en cada política: el permiso queda atado al `user_id` y nadie puede escribir en la tabla desde la app (no hay políticas de insert/update/delete). Para agregar otro admin: `insert into public.app_admins (user_id) select id from auth.users where email = '...';`
- `messages.group_id` (not null, FK a groups con `on delete cascade`).

Funciones (`security definer`):

| Función | Quién | Qué hace |
|---|---|---|
| `is_app_admin()` | interna | ¿El usuario con sesión es admin? |
| `is_group_member(group_id)` | interna (políticas) | ¿El usuario con sesión es miembro? Evita recursión en las políticas de `group_members`. |
| `create_group(p_name, p_code default null)` | solo admin | Crea el grupo; si no hay código genera uno de 6 caracteres sin letras confusas (sin 0/O/1/I/L). El creador queda como miembro. |
| `join_group(p_code)` | cualquier usuario | Valida el código y agrega al usuario (si ya era miembro no pasa nada). |
| `messages_route_group()` | trigger BEFORE INSERT en messages | Ver 6.3. |

RLS:

- `groups`: SELECT solo si eres miembro. Sin INSERT directo (solo `create_group`).
- `group_members`: SELECT de los miembros de tus grupos; DELETE de tu propia fila (salirte; aún sin botón). Sin INSERT directo (solo `join_group` / `create_group`).
- `messages`: SELECT e INSERT solo si eres miembro del `group_id`; el INSERT además exige `user_id = auth.uid()` e `is_system = false`.
- `app_admins`: cada quien solo puede ver su propia fila (la app la usa para mostrar "Crear grupo nuevo").

Migración: crea "WINTER ARC ORIGINAL" (código `WINTER`), mete a todos los `profiles` existentes y asigna a ese grupo todos los mensajes que ya existían.

### 6.3 Anuncios automáticos en varios grupos

Decisión: **el anuncio aparece en TODOS los grupos del usuario.** Fue lo más simple porque no hubo que tocar ninguno de los triggers existentes (`announce_bonus`, `announce_activity`, `announce_habit_evidence`): siguen insertando el mensaje sin `group_id`, y un solo trigger BEFORE INSERT en `messages` (`messages_route_group`) lo copia a cada grupo del usuario y descarta el original. Además:

- Un mensaje normal sin `group_id` (versión vieja de la app en caché) se manda al primer grupo del usuario.
- Si el usuario no está en ningún grupo, sus anuncios no se publican y no puede escribir.
- La regla de "un anuncio de evidencia por hábito y día" sigue funcionando (busca por `photo_path`).

### 6.4 Frontend

- `GroupProvider` (montado en `(app)/layout.tsx`): carga mis grupos (`group_members` + `groups`), si soy admin (`app_admins`), y los `user_id` del grupo activo. Guarda el grupo activo en `localStorage` (`winter-arc:grupo-activo`); si no hay uno guardado o ya no soy miembro, usa el más antiguo. `join(code)` y `create(name, code)` llaman a las RPC y dejan el grupo nuevo como activo.
- `GroupSwitcher`: botón "NOMBRE ▾" arriba de Stats y de Chat. Menú con: lista de mis grupos (con su código para compartir), "Unirme a un grupo" (pide código) y, solo para el admin, "Crear grupo nuevo" (nombre + código opcional; muestra el código generado).
- `useRanking(userId, today, refreshKey, memberIds, ready)`: pide `leaderboard`, `habit_checks` y `bonus_events` solo de los miembros del grupo activo.
- Chat: carga y escucha en tiempo real (`filter: group_id=eq.<id>`) solo el grupo activo; al enviar incluye `group_id`.
- Compatibilidad: si `grupos.sql` aún no se corrió, `enabled = false`, el selector no aparece y todo funciona como antes (un solo ranking y chat).
- Usuarios nuevos: al registrarse NO entran a ningún grupo; ven un aviso en Stats y Chat para unirse con código.

## 7. Ventana de edición: solo hoy y ayer

| Día | Qué se puede hacer |
|---|---|
| Futuro | Nada (bloqueado, como siempre) |
| Hoy y ayer | Tachar/destachar. Los hábitos con foto (`PHOTO_HABITS`) piden evidencia en ambos días |
| Antes de ayer | Solo lectura: se ve lo marcado y las fotos, con el aviso "Este día ya no se puede editar" |

Dónde vive la regla:

- `isEditableDay(date, today)` en `src/lib/dates.ts` (hora de CDMX vía `todayMX()`).
- `DaySheet` y `CustomHabitsSection`: casillas deshabilitadas (cursor normal, sin hover) y aviso con candado.
- `calendario/page.tsx` → `onToggle` ignora días cerrados; `HabitPhotoModal` guarda la evidencia con la fecha del día que se tacha (hoy o ayer).
- `stats/Gym.tsx` (importación de Hevy): los sets se guardan todos, pero "Ir al gym" solo se marca hoy/ayer.
- `useMyData.sync()`: si una acción offline quedó en cola hasta que su día se cerró, se descarta (si no, la base la rechazaría y atoraría la cola).
- Base de datos (`edicion_hoy_ayer.sql`): función `is_editable_day(date)` usada en las políticas de INSERT y DELETE de `habit_checks`, `habit_evidence` y `custom_habit_checks`.

No aplica a los bonus (libro, medio maratón), que tienen sus propias reglas de fecha.

## 8. Seguridad (resumen)

- RLS en todas las tablas. Escrituras sensibles (puntos del casino, apuestas, ajedrez, grupos) solo por funciones `security definer` o rutas del servidor con `service_role`.
- Los anuncios del chat solo los puede crear la base de datos (triggers); el usuario no puede insertar `is_system = true`.
- El admin se identifica por `user_id` en `app_admins`, nunca por algo que mande el navegador.

## 9. Cómo correr

1. `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (y la `service_role` para las rutas del servidor; ver `.env.example`).
2. Correr los SQL de la sección 5 en Supabase > SQL Editor.
3. `npm install` y `npm run dev` → http://localhost:3000
