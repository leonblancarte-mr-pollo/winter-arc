"use client";
// PANTALLA 5: Ajedrez por turnos entre amigos (24 horas por jugada)
import { Check, ChevronRight, Clock, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import UserAvatar from "@/components/UserAvatar";
import { ErrorBox, Notice, SectionTitle, Sheet, Spinner } from "@/components/ui";
import { casinoPost } from "@/lib/casino/client";
import { formatTimeLeft, isMyTurn, opponentOf, resultText } from "@/lib/chess/shared";
import { dateInMX, shortLabel } from "@/lib/dates";
import { errorES, supabase } from "@/lib/supabase";
import { loadPeople, type Person } from "@/lib/people";
import type { ChessGame, ChessInvitation } from "@/lib/types";

export default function AjedrezPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const router = useRouter();
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [games, setGames] = useState<ChessGame[] | null>(null);
  const [invites, setInvites] = useState<ChessInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    // Primero cierra las partidas a las que ya se les acabó el tiempo (de cualquiera)
    await supabase.rpc("chess_expire_games");
    setPeople(await loadPeople());

    const [g, i] = await Promise.all([
      supabase.from("chess_games").select("*").order("updated_at", { ascending: false }).limit(50),
      supabase.from("chess_invitations").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    if (g.error) {
      setError(g.error.message.includes("does not exist") ? "Falta correr supabase/ajedrez_y_tragamonedas.sql en Supabase." : errorES(g.error.message));
      setGames([]);
      return;
    }
    setGames((g.data ?? []) as ChessGame[]);
    setInvites((i.data ?? []) as ChessInvitation[]);
  }, []);

  useEffect(() => {
    // Carga al abrir (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Se actualiza sola cuando llega una invitación o alguien mueve
    const channel = supabase
      .channel("ajedrez-lista")
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_invitations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_games" }, () => load())
      .subscribe();
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(clock);
    };
  }, [load]);

  const nameOf = (id: string) => people[id]?.name ?? "…";

  async function invite(to: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("chess_invitations").insert({ from_user_id: userId, to_user_id: to });
    setBusy(false);
    setPicking(false);
    if (error) return setError(error.code === "23505" ? `Ya le mandaste una invitación a ${nameOf(to)}.` : errorES(error.message));
    setInfo(`Invitación enviada a ${nameOf(to)}. La partida empieza cuando acepte.`);
    load();
  }

  async function respond(inv: ChessInvitation, accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await casinoPost<{ gameId?: string }>("/api/chess/respond", { invitationId: inv.id, accept });
      if (accept && res.gameId) return router.push(`/ajedrez/${res.gameId}`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(inv: ChessInvitation) {
    const { error } = await supabase.from("chess_invitations").delete().eq("id", inv.id);
    if (error) return setError(errorES(error.message));
    load();
  }

  const received = invites.filter((i) => i.to_user_id === userId);
  const sent = invites.filter((i) => i.from_user_id === userId);
  const active = (games ?? []).filter((g) => g.status === "active");
  const myTurn = active.filter((g) => isMyTurn(g, userId));
  const theirTurn = active.filter((g) => !isMyTurn(g, userId));
  const finished = (games ?? []).filter((g) => g.status !== "active").slice(0, 10);

  return (
    <main className="mx-auto max-w-xl">
      <div className="flex items-end justify-between gap-4">
        <h1 className="display text-5xl">Ajedrez</h1>
        <button className="btn-primary" onClick={() => setPicking(true)} disabled={busy}>
          <Plus size={16} /> Nueva partida
        </button>
      </div>
      <p className="mt-2 text-fg2">Una jugada a la vez. Tienes 24 horas para mover; si no, pierdes la partida.</p>

      {error && (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      )}
      {info && (
        <div className="mt-4">
          <Notice>{info}</Notice>
        </div>
      )}

      {/* Invitaciones que me mandaron */}
      {received.length > 0 && (
        <>
          <SectionTitle>Te invitaron</SectionTitle>
          <ul className="flex flex-col gap-2">
            {received.map((inv) => (
              <li key={inv.id} className="card flex items-center gap-3">
                <UserAvatar name={nameOf(inv.from_user_id)} override={people[inv.from_user_id]?.avatar} />
                <span className="flex-1">
                  <span className="font-medium">{nameOf(inv.from_user_id)}</span> te reta a una partida
                </span>
                <button className="btn-secondary" onClick={() => respond(inv, false)} disabled={busy} aria-label="Rechazar">
                  <X size={16} />
                </button>
                <button className="btn-primary px-3 py-2" onClick={() => respond(inv, true)} disabled={busy}>
                  <Check size={16} /> Aceptar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {games == null ? (
        <Spinner />
      ) : (
        <>
          <GameList title="Te toca" games={myTurn} userId={userId} nameOf={nameOf} people={people} now={now} />
          <GameList title="Esperando a tu rival" games={theirTurn} userId={userId} nameOf={nameOf} people={people} now={now} />

          {sent.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1 text-sm text-fg3">
              {sent.map((inv) => (
                <li key={inv.id} className="flex items-center gap-2">
                  <Clock size={12} /> Esperando a que {nameOf(inv.to_user_id)} acepte tu invitación.
                  <button className="text-fg2 underline underline-offset-2 hover:text-fg" onClick={() => cancel(inv)}>
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!active.length && !received.length && !sent.length && (
            <p className="mt-12 text-center text-fg3">No tienes partidas en curso. Toca &quot;Nueva partida&quot; para retar a alguien.</p>
          )}

          <GameList title="Terminadas" games={finished} userId={userId} nameOf={nameOf} people={people} now={now} />
        </>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title={<div className="text-xl font-semibold">¿A quién retas?</div>}>
        <p className="mb-3 text-xs text-fg3">El color (blancas o negras) se sortea cuando acepte.</p>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-line">
          {Object.values(people)
            .filter((p) => p.id !== userId)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => invite(p.id)}
                disabled={busy}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-white/[0.04]"
              >
                <UserAvatar name={p.name} override={p.avatar} />
                <span className="flex-1 truncate">{p.name}</span>
                <ChevronRight size={16} className="text-fg3" />
              </button>
            ))}
        </div>
      </Sheet>
    </main>
  );
}

function GameList({
  title,
  games,
  userId,
  nameOf,
  people,
  now,
}: {
  title: string;
  games: ChessGame[];
  userId: string;
  nameOf: (id: string) => string;
  people: Record<string, Person>;
  now: number;
}) {
  if (!games.length) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <ul className="card divide-y divide-white/[0.06] p-0">
        {games.map((g) => {
          const rival = opponentOf(g, userId);
          const mine = isMyTurn(g, userId);
          const left = formatTimeLeft(g.turn_deadline, now);
          return (
            <li key={g.id}>
              <Link href={`/ajedrez/${g.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.04]">
                <UserAvatar name={nameOf(rival)} override={people[rival]?.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    vs {nameOf(rival)}{" "}
                    <span className="text-xs font-normal text-fg3">(juegas con {g.white_user_id === userId ? "blancas" : "negras"})</span>
                  </div>
                  <div className={`text-xs ${g.status === "active" ? (mine ? "text-accent" : "text-fg3") : "text-fg2"}`}>
                    {g.status === "active"
                      ? mine
                        ? `Te quedan ${left} para mover`
                        : `Le quedan ${left} para mover`
                      : `${resultText(g, userId)}, ${shortLabel(dateInMX(g.updated_at))}`}
                  </div>
                </div>
                <ChevronRight size={16} className="text-fg3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
