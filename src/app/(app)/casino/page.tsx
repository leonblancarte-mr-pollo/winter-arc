"use client";
// PANTALLA 4: Casino (dinero ficticio "peseis", solo para divertirse)
import { Cherry, ChevronRight, CircleDot, Crown, Lock, PenLine, Spade, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AnimatedNumber from "@/components/casino/AnimatedNumber";
import UserAvatar from "@/components/UserAvatar";
import { ErrorBox, Notice, SectionTitle, Sheet, Spinner } from "@/components/ui";
import { BUY_AMOUNT, casinoErrorES, formatPeseis, POWER_COST, useCasinoBalance } from "@/lib/casino/client";
import { shortLabel, timeInMX, dateInMX } from "@/lib/dates";
import { supabase } from "@/lib/supabase";
import type { AvatarOverride, CasinoTransaction, PowerLog, PowerType } from "@/lib/types";

type Person = { id: string; name: string; avatar: AvatarOverride };

const POWERS: { type: PowerType; title: string; text: string }[] = [
  { type: "rename", title: "Cambiar el nombre de otro", text: "Elige a alguien y ponle el nombre que quieras." },
  { type: "burro", title: "Convertir a alguien en burro", text: "Su avatar se vuelve un burro en el chat y en el ranking." },
];

const TX_TEXT: Record<CasinoTransaction["type"], string> = {
  bet: "Apuesta",
  bet_win: "Premio",
  bet_refund: "Apuesta devuelta",
  buy_peseis: "Compra de peseis",
  unlock_power: "Poder desbloqueado",
  admin_grant: "Regalo de peseis",
  easter_egg: "Sorpresa",
};

export default function CasinoPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const { balance, setBalance, error: balanceError, reload: reloadBalance } = useCasinoBalance(userId);
  const [people, setPeople] = useState<Person[]>([]);
  const [top, setTop] = useState<{ user_id: string; balance: number }[] | null>(null);
  const [unlocked, setUnlocked] = useState<Set<PowerType>>(new Set());
  const [log, setLog] = useState<PowerLog[]>([]);
  const [txs, setTxs] = useState<CasinoTransaction[]>([]);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState<PowerType | null>(null);
  const [usePower, setUsePower] = useState<PowerType | null>(null);

  const load = useCallback(async () => {
    let profiles = await supabase.from("profiles").select("id,display_name,avatar_override");
    if (profiles.error) profiles = await supabase.from("profiles").select("id,display_name");
    const rows = (profiles.data ?? []) as { id: string; display_name: string; avatar_override?: AvatarOverride }[];
    setPeople(rows.map((p) => ({ id: p.id, name: p.display_name, avatar: p.avatar_override ?? null })));

    const [t, u, l, x, pts] = await Promise.all([
      supabase.from("casino_balance").select("user_id,balance").order("balance", { ascending: false }).limit(10),
      supabase.from("power_unlocks").select("power_type").eq("user_id", userId),
      supabase.from("power_log").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("casino_transactions").select("*").eq("user_id", userId).order("id", { ascending: false }).limit(10),
      supabase.from("leaderboard").select("total_points").eq("user_id", userId).maybeSingle(),
    ]);
    if (t.error) return setError(casinoErrorES(t.error.message));
    setTop((t.data ?? []).map((r) => ({ user_id: r.user_id, balance: Number(r.balance) })));
    setUnlocked(new Set((u.data ?? []).map((r) => r.power_type as PowerType)));
    setLog((l.data ?? []) as PowerLog[]);
    setTxs((x.data ?? []) as CasinoTransaction[]);
    setMyPoints(pts.data?.total_points ?? 0);
  }, [userId]);

  useEffect(() => {
    // Carga datos al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Alguien";
  const personOf = (id: string) => people.find((p) => p.id === id);

  async function buyPeseis() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("casino_buy_peseis");
    setBusy(false);
    if (error) return setError(casinoErrorES(error.message));
    setBalance(Number(data));
    load();
  }

  async function unlock(power: PowerType) {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("casino_unlock_power", { p_power: power });
    setBusy(false);
    setConfirmUnlock(null);
    if (error) return setError(casinoErrorES(error.message));
    setBalance(Number(data));
    load();
  }

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="display text-5xl">Casino</h1>
      <p className="mt-2 text-fg2">Dinero ficticio. Los peseis no valen nada fuera de aquí.</p>

      {/* Saldo */}
      <section className="card mt-8">
        <div className="label">Mis peseis</div>
        {balanceError ? (
          <div className="mt-2">
            <ErrorBox message={balanceError} onRetry={reloadBalance} />
          </div>
        ) : balance == null ? (
          <Spinner />
        ) : (
          <div className="display mt-1 text-6xl">
            <AnimatedNumber value={balance} />
          </div>
        )}
        {balance === 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <p className="text-fg2">
              Te quedaste sin peseis. Puedes comprar {formatPeseis(BUY_AMOUNT)} a cambio de 1 punto de hábitos, que se resta de tu lugar en
              la carrera. {myPoints != null && `Tienes ${myPoints} puntos.`}
            </p>
            <button className="btn-primary self-start" onClick={buyPeseis} disabled={busy || (myPoints ?? 0) < 1}>
              Comprar {formatPeseis(BUY_AMOUNT)} peseis por 1 punto
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      )}

      {/* Juegos */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GameCard href="/casino/ruleta" icon={<CircleDot size={24} />} title="Ruleta" text="Americana, 0 y 00" />
        <GameCard href="/casino/blackjack" icon={<Spade size={24} />} title="Blackjack" text="Paga 3 a 2" />
        <div className="col-span-2 sm:col-span-1">
          <GameCard href="/casino/tragamonedas" icon={<Cherry size={24} />} title="Tragamonedas" text="3 carretes, hasta ×250" />
        </div>
      </section>

      {/* Poderes */}
      <SectionTitle>Poderes</SectionTitle>
      <div className="flex flex-col gap-3">
        {POWERS.map((p) => {
          const has = unlocked.has(p.type);
          const cost = POWER_COST[p.type];
          return (
            <div key={p.type} className="card flex items-center gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${has ? "border-accent/40 text-accent" : "border-line text-fg3"}`}>
                {has ? p.type === "rename" ? <PenLine size={16} /> : <span aria-hidden>🫏</span> : <Lock size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-fg3">{has ? "Desbloqueado. Úsalo las veces que quieras." : `${p.text} Cuesta ${formatPeseis(cost)} peseis.`}</div>
              </div>
              {has ? (
                <button className="btn-secondary" onClick={() => setUsePower(p.type)}>
                  Usar
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => setConfirmUnlock(p.type)} disabled={busy || (balance ?? 0) < cost}>
                  Desbloquear
                </button>
              )}
            </div>
          );
        })}
      </div>

      {log.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-fg3">
          {log.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <Sparkles size={12} className="shrink-0 text-fg3" />
              <span>
                <span className="text-fg2">{nameOf(l.user_id)}</span>{" "}
                {l.power_type === "rename" ? (
                  <>
                    le cambió el nombre a <span className="text-fg2">{l.detail}</span>
                  </>
                ) : (
                  <>
                    convirtió en burro a <span className="text-fg2">{nameOf(l.target_user_id)}</span>
                  </>
                )}{" "}
                el {shortLabel(dateInMX(l.created_at))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Quién tiene más peseis */}
      <SectionTitle>Más peseis</SectionTitle>
      {!top ? (
        <Spinner />
      ) : (
        <ol className="card divide-y divide-white/[0.06] p-0">
          {top.map((r, i) => {
            const p = personOf(r.user_id);
            return (
              <li key={r.user_id} className={`flex items-center gap-3 px-4 py-3 ${r.user_id === userId ? "bg-white/[0.04]" : ""}`}>
                <span className="w-4 text-xs tabular-nums text-fg3">{i + 1}</span>
                <UserAvatar name={p?.name ?? ""} override={p?.avatar} size={24} />
                <span className={`flex-1 truncate ${r.user_id === userId ? "font-semibold" : ""}`}>{p?.name ?? "…"}</span>
                {i === 0 && <Crown size={12} className="text-accent" aria-label="Más rico" />}
                <span className="tabular-nums text-fg2">{formatPeseis(r.balance)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Mis movimientos */}
      {txs.length > 0 && (
        <>
          <SectionTitle>Mis movimientos</SectionTitle>
          <ul className="card divide-y divide-white/[0.06] p-0">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    {TX_TEXT[t.type]}
                    {t.game ? `, ${t.game}` : ""}
                    {t.type === "buy_peseis" ? `, ${t.points_cost} punto` : ""}
                  </div>
                  <div className="text-xs text-fg3">
                    {shortLabel(dateInMX(t.created_at))}, {timeInMX(t.created_at)}
                  </div>
                </div>
                <span className={`tabular-nums ${t.amount >= 0 ? "text-done" : "text-fg2"}`}>
                  {t.amount >= 0 ? "+" : "−"}
                  {formatPeseis(Math.abs(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Confirmar desbloqueo */}
      <Sheet
        open={confirmUnlock != null}
        onClose={() => setConfirmUnlock(null)}
        title={<div className="text-xl font-semibold">¿Desbloquear este poder?</div>}
      >
        {confirmUnlock && (
          <div className="flex flex-col gap-4">
            <p className="text-fg2">
              Se restan {formatPeseis(POWER_COST[confirmUnlock])} peseis de tu saldo. El poder es tuyo para siempre, aunque después te
              quedes sin peseis.
            </p>
            <button className="btn-primary" onClick={() => unlock(confirmUnlock)} disabled={busy}>
              Pagar {formatPeseis(POWER_COST[confirmUnlock])} peseis
            </button>
          </div>
        )}
      </Sheet>

      {usePower && (
        <UsePowerSheet
          power={usePower}
          people={people.filter((p) => p.id !== userId)}
          onClose={() => setUsePower(null)}
          onDone={() => {
            setUsePower(null);
            load();
          }}
        />
      )}
    </main>
  );
}

function GameCard({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-3 transition-colors duration-150 ease-out hover:bg-raised">
      <span className="flex items-center justify-between text-fg2">
        {icon}
        <ChevronRight size={16} className="text-fg3" />
      </span>
      <span className="display text-3xl">{title}</span>
      <span className="text-xs text-fg3">{text}</span>
    </Link>
  );
}

// Elegir a quién aplicarle un poder (y el nombre nuevo si es "rename")
function UsePowerSheet({
  power,
  people,
  onClose,
  onDone,
}: {
  power: PowerType;
  people: Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function apply() {
    if (!target) return setError("Elige a quién.");
    if (power === "rename" && !name.trim()) return setError("Escribe el nombre nuevo.");
    setBusy(true);
    setError(null);
    const { error } =
      power === "rename"
        ? await supabase.rpc("power_rename_user", { p_target: target, p_name: name.trim() })
        : await supabase.rpc("power_burro_user", { p_target: target });
    setBusy(false);
    if (error) return setError(casinoErrorES(error.message));
    setDone(true);
    setTimeout(onDone, 900);
  }

  return (
    <Sheet open onClose={onClose} title={<div className="text-xl font-semibold">{power === "rename" ? "Cambiar un nombre" : "Convertir en burro"}</div>}>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-fg3">Queda registrado quién usó el poder y con quién. No es anónimo.</p>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
          {people.length === 0 && <p className="p-4 text-fg3">Todavía no hay a quién.</p>}
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setTarget(p.id)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04] ${
                target === p.id ? "bg-white/[0.06]" : ""
              }`}
              aria-pressed={target === p.id}
            >
              <UserAvatar name={p.name} override={p.avatar} size={24} />
              <span className="flex-1 truncate">{p.name}</span>
              {target === p.id && <span className="h-2 w-2 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        {power === "rename" && (
          <label className="flex flex-col gap-2">
            <span className="label">Nombre nuevo</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </label>
        )}
        {error && <ErrorBox message={error} />}
        {done && <Notice>Listo, poder aplicado.</Notice>}
        <button className="btn-primary" onClick={apply} disabled={busy || done}>
          {power === "rename" ? "Cambiar nombre" : "Convertir en burro"}
        </button>
      </div>
    </Sheet>
  );
}
