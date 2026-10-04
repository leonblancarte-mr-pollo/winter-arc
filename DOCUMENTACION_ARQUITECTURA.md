# WINTER ARC — DOCUMENTACIÓN DE ARQUITECTURA

> Última actualización: 2026-10-04 (Bonus de cardio por distancia y actividad desde el calendario — `supabase/cardio_distancia.sql`; el 2026-10-03, blindaje del casino — `supabase/casino_blindaje.sql`; antes ese día, hábito "Dieta" — `supabase/dieta.sql`; antes ese día, edición solo de hoy y ayer — `supabase/edicion_hoy_ayer.sql`; antes ese día, Grupos — `supabase/grupos.sql`).
> Versión Word: `DOCUMENTACION_ARQUITECTURA_COMPLETA.docx` (mismo contenido).
> Audiencia: quien necesite continuar el proyecto sin preguntar.

## CHANGELOG

- 2026-10-04 — **Bonus de cardio por distancia** (`supabase/cardio_distancia.sql`). El formulario manual de "Kilómetros" sale de Stats: la actividad (tipo, km, minutos) ahora se registra en el mismo modal de la foto al tachar Cardio. Si llega al umbral (running 5 km+, bici 20 km+, natación 2 km+) la base crea un bonus de +5 en `bonus_events` (`cardio_distance`), aparte del +1 del hábito y del +5 semanal de 3 cardios. Máximo uno por día. Anuncio en el chat ("🏃 X corrió 6km y ganó un bonus de +5 pts"). Ver sección 9.
- 2026-10-03 — **Blindaje del casino** (`supabase/casino_blindaje.sql`). Un usuario consiguió 5,000 peseis "extra"; la causa más probable fue comprar 5,000 peseis con saldo 0 mientras tenía toda su apuesta en una mano de blackjack abierta. Ahora: compra y easter egg exigen quiebra de verdad (sin mano abierta), cada apuesta abre una ronda y el premio solo se paga contra ella con tope por juego, el blackjack cobra antes de repartir (cerraba una carrera que permitía cobrar una mano sin haber pagado la apuesta), límite de 12 apuestas cada 10 s, y auditoría de saldos. Ver sección 10.
- 2026-10-03 — **Hábito nuevo "Dieta"** (10mo, key `dieta`, ícono `Salad`, pide foto). Máximo diario 10 y racha 8/10 desde el 2026-10-03; los días anteriores siguen con 9 y 7/9. Anuncio "🥗 X cuidó su dieta" en el chat.
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
    (app)/calendario          Marcar hábitos, bonus (libro, medio maratón), evidencia fotográfica, km de cardio
    (app)/stats               Selector de grupo + resumen, ranking del grupo, gráficas, km (solo lectura), Hevy
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
| `bonus_events` | Libro (+5), medio maratón (+50), cardio por distancia (+5, lo crea un trigger) | Usuario |
| `activities`, `workout_sets` | Km de cardio (desde el calendario; `from_habit`), sets de Hevy (privados) | Usuario |
| `habit_evidence` | Foto de evidencia por hábito y día | Usuario |
| `custom_habits`, `custom_habit_checks` | Hábitos personales privados, sin puntos | Usuario |
| `leaderboard` (vista) | Total de puntos de cada usuario | Global (la app la filtra por grupo) |
| `casino_*`, `power_log`, `power_unlocks` | Saldo de peseis, movimientos, rondas de juego, auditoría de saldos, poderes | Global |
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
7. **`dieta.sql`** — agrega "dieta" al anuncio automático de evidencia (ver sección 8). Se puede repetir.
8. **`casino_blindaje.sql`** — rondas de juego, topes de premio, quiebra de verdad, límite de velocidad y auditoría (ver sección 10). Se puede repetir. Córrelo y sube el código en seguida: elimina `casino_apply`, que la versión anterior de la app usaba.
9. **`cardio_distancia.sql`** — `activities.from_habit`, bonus `cardio_distance` y sus triggers (ver sección 9). Se puede repetir. Córrelo **antes** de subir el código: la app nueva manda `from_habit` al guardar la actividad.

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

No aplica a los bonus de libro y medio maratón, que tienen sus propias reglas de fecha. El bonus de cardio por distancia sí sigue la regla (solo hoy o ayer, sección 9).

## 8. Hábitos

Se definen en `HABITS` (`src/lib/constants.ts`); la `key` es lo que se guarda en `habit_checks` y nunca debe cambiar. `habit_checks` no tiene lista de keys permitidas, así que un hábito nuevo no necesita migración de tablas.

| # | key | Hábito | Foto |
|---|---|---|---|
| 1 | `gym` | Ir al gym | Sí |
| 2 | `cardio` | Cardio | Sí |
| 3 | `leer` | Leer 5 páginas | Sí |
| 4 | `dormir` | Dormir 7 horas | No |
| 5 | `pasos` | 10,000 pasos | Sí |
| 6 | `pantalla` | Menos de 5 hrs de pantalla | Sí (captura de Tiempo de Uso) |
| 7 | `proyecto` | 1 hr de proyecto personal | No |
| 8 | `no_pajiza` | No chaketa | No |
| 9 | `agua_3litros` | 3 litros de agua | No |
| 10 | `dieta` | Dieta (desde 2026-10-03) | Sí (macros o una comida) |

Hábitos agregados con la carrera ya empezada:

- `HABIT_SINCE` (constants.ts) guarda la fecha de inicio de cada hábito nuevo (`dieta: "2026-10-03"`).
- `habitsOn(date)` / `maxOn(date)` (points.ts) dan los hábitos y el máximo de ese día: 9 antes de Dieta, 10 después. Los usan los anillos del calendario y del perfil, el panel del día, el mapa de calor, el % de cumplimiento y "Puntos de hoy".
- Cumplimiento por hábito: el % de Dieta se calcula solo con los días desde que existe.
- Racha: `streakMinOn(date)` → 7 antes de Dieta (`STREAK_MIN_HABITS_BEFORE_DIETA`), 8 desde entonces (`STREAK_MIN_HABITS`). Es la misma proporción (~78%, redondeada hacia arriba), y así nadie pierde la racha que ya llevaba.
- Los puntos no cambian: cada hábito marcado vale 1, igual en la app y en la vista `leaderboard`.

Para agregar otro hábito con foto: entrada al final de `HABITS`, su fecha en `HABIT_SINCE`, ícono en `HabitIcon.tsx`, key en `PHOTO_HABITS`, texto en `HabitPhotoModal.tsx`, emoji→ícono en `SYSTEM_ICONS` del chat y un `when` en `announce_habit_evidence()` (SQL). Si cambia el máximo, ajustar la racha con una regla por fecha como la de Dieta.

## 9. Cardio: actividad desde el calendario y bonus por distancia

### 9.1 Flujo

1. En el panel del día (hoy o ayer) se tacha **Cardio** → se abre `HabitPhotoModal`, que en Cardio pide además: tipo (Running / Bici / Natación), km (obligatorio) y minutos (opcional). Muestra en vivo si esa distancia gana el bonus.
2. Al guardar (`saveWithPhoto` en `calendario/page.tsx`): sube la foto (`habit_evidence`), marca el hábito (cola offline de `useMyData`) e inserta la actividad en `activities` con `from_habit = true`. Si la actividad falla, el modal muestra el error y al reintentar no vuelve a subir la foto.
3. La base crea el bonus (si aplica) y lo anuncia en el chat. La app lee el bonus por `activity_id`, lo agrega a "Mis bonus" y muestra la animación de +5.

Stats ya no tiene formulario: la sección "Kilómetros" (`stats/Activities.tsx`) conserva las gráficas (km por tipo, km por semana) y la lista de las últimas 10 con botón de borrar. Las actividades registradas antes desde Stats se quedan igual (`from_habit = false`).

### 9.2 Regla del bonus

| Tipo | Umbral (inclusive) | Bonus |
|---|---|---|
| Running | 5 km o más | +5 |
| Bici | 20 km o más | +5 |
| Natación | 2 km o más | +5 |

- Se suma al +1 del hábito y al +5 semanal de "3 cardios en la semana"; no reemplaza nada.
- **Máximo uno por usuario y día** (índice único `bonus_cardio_distance_dia`). Decisión: el calendario registra una actividad cada vez que se tacha Cardio (y destachar la borra), así que en la práctica solo hay una por día; el tope evita que alguien sume +5 varias veces insertando actividades por la API.
- Solo hoy o ayer (`is_editable_day`), dentro de la carrera, con `from_habit = true` y con la foto de cardio de ese día ya guardada.
- Los umbrales viven en dos lugares que deben coincidir: `CARDIO_DISTANCE_MIN_KM` (`src/lib/constants.ts`, para la UI) y `cardio_bonus_min_km()` (SQL, el que decide).

### 9.3 Base de datos (`supabase/cardio_distancia.sql`)

- `activities.from_habit boolean default false`.
- `bonus_events`: tipo nuevo `cardio_distance`, columnas `activity_id` (FK a `activities`, `on delete cascade`) y `activity_type`; `distance_km` guarda los km. El check `bonus_valido` exige `points = 5`, `activity_id` y tipo válido.
- La política de INSERT de `bonus_events` solo permite `book` y `half_marathon`: el de distancia lo crea únicamente el trigger.

| Trigger | Tabla / evento | Qué hace |
|---|---|---|
| `activities_cardio_bonus_trigger` → `grant_cardio_distance_bonus()` | `activities` AFTER INSERT | Crea el bonus si cumple la regla 9.2 |
| `habit_checks_cardio_cleanup_trigger` → `remove_cardio_habit_activities()` | `habit_checks` AFTER DELETE | Al destachar Cardio borra las actividades `from_habit` de ese día; su bonus se va por cascade |
| `announce_bonus_trigger` (actualizado) | `bonus_events` AFTER INSERT | "🏃 X corrió 6km…", "🚴 X rodó 25km en bici…" o "🏊 X nadó 2.5km…" + "…y ganó un bonus de +5 pts" |
| `announce_activity_trigger` (actualizado) | `activities` AFTER INSERT | Igual que antes (cardio > 3 km o > 20 min), pero no publica si esa actividad ya ganó el bonus, para no repetir el mensaje |

El trigger del bonus se llama `activities_…` a propósito: Postgres corre los triggers del mismo evento en orden alfabético y debe ir antes que `announce_activity_trigger`.

Los puntos no necesitan más cambios: la vista `leaderboard`, `points.ts`, el banner diario y el ranking ya suman cualquier fila de `bonus_events`. En el perfil público, las actividades con bonus muestran "+5"; en el chat, 🚴 y 🏊 tienen su ícono (`SYSTEM_ICONS`).

### 9.4 UI en el panel del día

Debajo de "Terminé un libro (+5)" y "Corrí 21 km (+50)" hay una nota sin botón: "Cardio: +5 pts extra si corres 5 km+, 20 km+ en bici o 2 km+ nadando. Se suma solo al tachar Cardio con tus km."

## 10. Casino: cómo se mueve el saldo (blindaje)

### 10.1 Regla general

El navegador solo manda **qué quiere apostar** (fichas y casillas en la ruleta, monto en tragamonedas, monto y acción en blackjack). El resultado del juego (número de la ruleta, carretes, cartas) y el premio los calcula **el servidor** con `crypto.getRandomValues`. Ninguna ruta acepta un saldo, un premio ni un resultado del navegador; la ruleta además copia solo `type`, `value` y `amount` de cada apuesta.

### 10.2 Rondas (`casino_rounds`)

Cada apuesta abre una ronda (en blackjack, una por mano). Las funciones (`security definer`, solo `service_role`):

| Función | Qué hace |
|---|---|
| `casino_place_bet(user, game, stake, source, meta)` | Bloquea el saldo del usuario, aplica el límite de velocidad, cobra y abre la ronda. Regresa `{round_id, balance}`. |
| `casino_raise_bet(user, round, extra, source)` | Blackjack: doblar. Solo una vez por mano y solo por el monto original. |
| `casino_settle(user, round, payout, source, meta)` | Cierra la ronda y paga. Falla si la ronda no es del usuario, ya se cerró, o si el premio pasa de `apuesta × multiplicador máximo` (ruleta 36, tragamonedas 250, blackjack 2.5). |
| `casino_refund(user, round, source)` | Si la jugada no se pudo guardar, regresa exactamente lo apostado (`bet_refund`). |

La función genérica `casino_apply` (que sumaba cualquier monto) se eliminó. En el servidor se usan con `placeBet`, `settleRound`, `raiseBet` y `refundRound` de `src/lib/server/casino.ts`. La mano de blackjack guarda su `roundId` (nunca se manda al navegador).

### 10.3 Quiebra de verdad

`casino_is_broke(user)`: saldo 0 **y** sin ronda de blackjack abierta (últimas 24 h) ni otra ronda abierta en los últimos 5 minutos. Lo exigen `casino_buy_peseis` (5,000 peseis por 1 punto) y `casino_easter_egg` (50 peseis). Antes bastaba con saldo 0, así que se podía apostar todo en blackjack, comprar 5,000 con la mano abierta y luego plantarse.

### 10.4 Carreras y repeticiones

- Blackjack cobra **antes** de repartir. Antes repartía, guardaba y luego cobraba: en ese hueco otra petición podía plantarse y cobrar la mano; si el cobro después fallaba, la mano no se deshacía y el premio ya estaba pagado.
- Al doblar, primero se guarda la jugada (con `version`) y luego se cobra; si no alcanza, se deshace.
- Cada ronda se paga una sola vez (candado `for update` y `status = 'open'`), aunque lleguen dos peticiones iguales.
- Límite: 12 apuestas por usuario cada 10 segundos (`demasiado rápido` → HTTP 429).
- Compra y easter egg bloquean la fila del saldo (`for update`), así que dos llamadas a la vez no cobran dos veces.

### 10.5 Auditoría

- `casino_transactions` ahora guarda `source` (ruta o función: `api/casino/roulette`, `rpc:casino_buy_peseis`, …), `round_id` y `balance_after`. Tipos: `bet`, `bet_win`, `bet_refund`, `buy_peseis`, `unlock_power`, `admin_grant`, `easter_egg`.
- `casino_balance_audit` (trigger en `casino_balance`): cada cambio de saldo con saldo anterior, nuevo, diferencia, rol de base de datos y hora, aunque se haga a mano en el SQL Editor. Sin políticas RLS: solo se consulta desde Supabase.
- Para cuadrar a un usuario: saldo actual = 10,000 + suma de `amount` de sus movimientos. Una diferencia indica un cambio de saldo que no pasó por las funciones del casino; `casino_balance_audit` dice cuándo.

### 10.6 Pendiente fuera del casino

`habit_checks` acepta cualquier `habit_key` (ver sección 8), así que alguien podría insertar claves inventadas por la API y sumar puntos, y con ellos comprar peseis. No se cambió en este blindaje porque es lógica de hábitos.

## 11. Seguridad (resumen)

- RLS en todas las tablas. Escrituras sensibles (puntos del casino, apuestas, ajedrez, grupos) solo por funciones `security definer` o rutas del servidor con `service_role`.
- Casino: resultados y premios solo en el servidor, pagos atados a rondas con tope por juego, auditoría de saldos (sección 10).
- Los anuncios del chat solo los puede crear la base de datos (triggers); el usuario no puede insertar `is_system = true`.
- El admin se identifica por `user_id` en `app_admins`, nunca por algo que mande el navegador.

## 12. Cómo correr

1. `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (y la `service_role` para las rutas del servidor; ver `.env.example`).
2. Correr los SQL de la sección 5 en Supabase > SQL Editor.
3. `npm install` y `npm run dev` → http://localhost:3000
