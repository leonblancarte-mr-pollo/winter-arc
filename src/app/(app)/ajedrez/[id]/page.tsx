"use client";
// Una partida de ajedrez: tablero, reloj de 24 horas por turno y lista de jugadas.
// Cada jugada la valida el servidor; si el rival mueve, el tablero se actualiza solo.
import { Chess } from "chess.js";
import { ArrowLeft, Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ChessBoard, { type BoardMove } from "@/components/chess/ChessBoard";
import UserAvatar from "@/components/UserAvatar";
import { ErrorBox, Spinner } from "@/components/ui";
import { casinoPost } from "@/lib/casino/client";
import { colorOf, formatTimeLeft, isMyTurn, resultText, turnOf } from "@/lib/chess/shared";
import { supabase } from "@/lib/supabase";
import { loadPeople, type Person } from "@/lib/people";
import type { ChessGame } from "@/lib/types";

export default function PartidaPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user!.id;
  const [game, setGame] = useState<ChessGame | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    await supabase.rpc("chess_expire_games");
    const { data, error } = await supabase.from("chess_games").select("*").eq("id", id).maybeSingle();
    if (error) return setError(error.message);
    if (!data) return setNotFound(true);
    setGame(data as ChessGame);
    setPeople(await loadPeople([data.white_user_id, data.black_user_id]));
  }, [id]);

  useEffect(() => {
    // Carga al abrir (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Cuando el rival mueve, llega el cambio en tiempo real
    const channel = supabase
      .channel(`ajedrez-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chess_games", filter: `id=eq.${id}` }, (payload) => {
        setGame(payload.new as ChessGame);
      })
      .subscribe();
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(clock);
    };
  }, [id, load]);

  // Si al rival (o a mí) se le acabó el tiempo mientras veo la partida, se cierra
  useEffect(() => {
    if (game?.status === "active" && game.turn_deadline && new Date(game.turn_deadline).getTime() <= now) {
      supabase.rpc("chess_expire_games").then(() => load());
    }
  }, [game, now, load]);

  const pgn = game?.pgn ?? "";
  const history = useMemo(() => {
    if (!pgn) return [];
    try {
      const c = new Chess();
      c.loadPgn(pgn);
      return c.history();
    } catch {
      return [];
    }
  }, [pgn]);

  const inCheck = useMemo(() => (game ? new Chess(game.fen).inCheck() : false), [game]);

  async function move(m: BoardMove) {
    if (!game) return;
    setError(null);
    // Muestra la jugada al instante; el servidor la confirma (o la regresa si no es válida)
    const before = game;
    try {
      const local = new Chess(game.fen);
      local.move(m);
      setGame({ ...game, fen: local.fen(), last_move: m.from + m.to });
    } catch {
      return setError("Esa jugada no es legal.");
    }
    setSending(true);
    try {
      const res = await casinoPost<{ game: ChessGame }>("/api/chess/move", { gameId: game.id, ...m });
      setGame(res.game);
    } catch (e) {
      setGame(before);
      setError((e as Error).message);
      load();
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl">
        <BackLink />
        <p className="mt-12 text-center text-fg3">Esa partida no existe o no juegas en ella.</p>
      </main>
    );
  }
  if (!game) return <Spinner />;

  const me = colorOf(game, userId) ?? "w";
  const rivalId = me === "w" ? game.black_user_id : game.white_user_id;
  const rival = people[rivalId];
  const myTurn = isMyTurn(game, userId);
  const left = formatTimeLeft(game.turn_deadline, now);
  const sideToMove = turnOf(game.fen);

  return (
    <main className="mx-auto max-w-xl">
      <BackLink />

      {/* Rival arriba, yo abajo (como en un tablero real) */}
      <PlayerRow person={rival} color={me === "w" ? "b" : "w"} active={game.status === "active" && sideToMove !== me} />

      <div className="mt-3">
        <ChessBoard
          key={game.fen}
          fen={game.fen}
          orientation={me}
          interactive={myTurn && !sending}
          lastMove={game.last_move}
          onMove={move}
        />
      </div>

      <PlayerRow person={people[userId]} color={me} active={myTurn} you />

      <div className="mt-4" aria-live="polite">
        {game.status === "active" ? (
          <div className={`card flex items-center gap-3 ${myTurn ? "border-accent/40" : ""}`}>
            {inCheck ? <TriangleAlert size={20} className="shrink-0 text-danger" /> : <Clock size={20} className="shrink-0 text-fg2" />}
            <div>
              {inCheck && <div className="font-semibold text-danger">{myTurn ? "¡Estás en jaque!" : `${rival?.name ?? "Tu rival"} está en jaque`}</div>}
              <div className={myTurn ? "font-medium" : "text-fg2"}>
                {myTurn ? `Te toca. Te quedan ${left} para mover.` : `Le toca a ${rival?.name ?? "tu rival"}. Le quedan ${left}.`}
              </div>
              {myTurn && !inCheck && <div className="text-xs text-fg3">Toca una de tus piezas para ver a dónde puede moverse.</div>}
            </div>
          </div>
        ) : (
          <div className="card text-center">
            <div className="display text-4xl">{resultText(game, userId)}</div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="label mb-2">Jugadas</h2>
          <ol className="card grid grid-cols-[2rem_1fr_1fr] gap-x-2 gap-y-1 text-sm tabular-nums">
            {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
              <li key={i} className="contents">
                <span className="text-fg3">{i + 1}.</span>
                <span>{history[i * 2]}</span>
                <span>{history[i * 2 + 1] ?? ""}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/ajedrez" className="inline-flex items-center gap-2 text-fg2 transition-colors duration-150 hover:text-fg">
      <ArrowLeft size={16} /> Ajedrez
    </Link>
  );
}

function PlayerRow({ person, color, active, you }: { person?: Person; color: "w" | "b"; active: boolean; you?: boolean }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <UserAvatar name={person?.name ?? ""} override={person?.avatar} />
      <span className={`flex-1 truncate ${you ? "font-semibold" : ""}`}>
        {person?.name ?? "…"}
        {you ? " (tú)" : ""}
      </span>
      <span className="flex items-center gap-2 text-xs text-fg2">
        <span className={`h-3 w-3 rounded-full border border-zinc-500 ${color === "w" ? "bg-white" : "bg-black"}`} />
        {color === "w" ? "Blancas" : "Negras"}
      </span>
      {active && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Le toca" />}
    </div>
  );
}
