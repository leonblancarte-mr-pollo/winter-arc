"use client";
// RULETA americana: arma tu ficha, tócala en el tablero (varias veces si quieres) y gira.
// El número lo saca el servidor con un generador aleatorio seguro; aquí solo se anima.
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AnimatedNumber from "@/components/casino/AnimatedNumber";
import { ChipPicker } from "@/components/casino/Chips";
import RouletteBoard from "@/components/casino/RouletteBoard";
import RouletteWheel, { type RouletteWheelHandle } from "@/components/casino/RouletteWheel";
import { ErrorBox, Spinner } from "@/components/ui";
import { casinoPost, formatPeseis, useCasinoBalance } from "@/lib/casino/client";
import { betKey, betLabel, colorOf, labelOf, type BetType, type RouletteBet } from "@/lib/casino/roulette";

type SpinResponse = { result: number; stake: number; payout: number; net: number; balance: number };

export default function RuletaPage() {
  const { user } = useAuth();
  const { balance, setBalance, error: balanceError } = useCasinoBalance(user!.id);
  const [stack, setStack] = useState<number[]>([]);
  const [bets, setBets] = useState<Record<string, RouletteBet>>({});
  const [lastBets, setLastBets] = useState<Record<string, RouletteBet> | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<SpinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wheel = useRef<RouletteWheelHandle>(null);

  const chip = stack.reduce((s, v) => s + v, 0);
  const totalBet = Object.values(bets).reduce((s, b) => s + b.amount, 0);
  const available = (balance ?? 0) - totalBet;

  // Pone la ficha armada en la casilla tocada (se acumula si tocas la misma otra vez)
  function place(bet: { type: BetType; value?: number }) {
    setError(null);
    if (chip <= 0) return setError("Primero arma tu ficha tocando las fichas de abajo.");
    if (chip > available) return setError("No te alcanza para poner esa ficha.");
    const key = betKey(bet);
    setBets((prev) => ({ ...prev, [key]: { ...bet, amount: (prev[key]?.amount ?? 0) + chip } }));
    setOutcome(null);
  }

  async function spin() {
    const list = Object.values(bets);
    if (!list.length) return setError("Pon al menos una ficha en el tablero.");
    setError(null);
    setOutcome(null);
    setSpinning(true);
    try {
      const res = await casinoPost<SpinResponse>("/api/casino/roulette", { bets: list });
      await wheel.current?.spin(res.result); // anima hasta el número que salió
      setOutcome(res);
      setBalance(res.balance); // el saldo cuenta hacia su nuevo valor
      setLastBets(bets);
      setBets({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSpinning(false);
    }
  }

  function repeat() {
    if (!lastBets) return;
    const total = Object.values(lastBets).reduce((s, b) => s + b.amount, 0);
    if (total > (balance ?? 0)) return setError("No te alcanza para repetir la apuesta.");
    setBets(lastBets);
    setOutcome(null);
  }

  return (
    <main className="mx-auto max-w-xl">
      <Link href="/casino" className="inline-flex items-center gap-2 text-fg2 transition-colors duration-150 hover:text-fg">
        <ArrowLeft size={16} /> Casino
      </Link>
      <div className="mt-4 flex items-end justify-between gap-4">
        <h1 className="display text-5xl">Ruleta</h1>
        <div className="text-right">
          <div className="label">Peseis</div>
          <div className="display text-3xl">{balance == null ? "…" : <AnimatedNumber value={balance} />}</div>
        </div>
      </div>
      {balanceError && (
        <div className="mt-4">
          <ErrorBox message={balanceError} />
        </div>
      )}

      {/* Rueda y resultado */}
      <section className="mt-6">
        <RouletteWheel ref={wheel} />
        <div className="mt-4 min-h-16 text-center" aria-live="polite">
          {spinning ? (
            <p className="text-fg2">Girando…</p>
          ) : outcome ? (
            <div>
              <span
                className={`inline-flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-2xl font-semibold text-white ${
                  { red: "bg-red-600", black: "bg-zinc-800", green: "bg-emerald-600" }[colorOf(outcome.result)]
                }`}
              >
                {labelOf(outcome.result)}
              </span>
              <p className={`mt-2 font-medium ${outcome.net > 0 ? "text-done" : outcome.net < 0 ? "text-danger" : "text-fg2"}`}>
                {outcome.net > 0
                  ? `Ganaste ${formatPeseis(outcome.net)} peseis`
                  : outcome.net < 0
                    ? `Perdiste ${formatPeseis(-outcome.net)} peseis`
                    : "Quedaste igual"}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {balance == null ? (
        <Spinner />
      ) : (
        <>
          <ChipPicker stack={stack} onChange={setStack} max={Math.max(0, available)} disabled={spinning} />

          {/* Apuestas puestas */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Object.values(bets).map((b) => (
              <span key={betKey(b)} className="rounded-full border border-line px-3 py-1 text-xs text-fg2">
                {betLabel(b)}: <span className="tabular-nums text-fg">{formatPeseis(b.amount)}</span>
              </span>
            ))}
            {!Object.keys(bets).length && <span className="text-xs text-fg3">Toca una casilla del tablero para poner tu ficha.</span>}
          </div>

          <div className="mt-3">
            <RouletteBoard bets={bets} onPlace={place} disabled={spinning} winner={outcome?.result ?? null} />
          </div>

          {error && (
            <div className="mt-3">
              <ErrorBox message={error} />
            </div>
          )}

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex gap-2 rounded-xl border border-line bg-black/80 p-2 backdrop-blur-xl">
            <button className="btn-secondary" onClick={() => setBets({})} disabled={spinning || !totalBet} aria-label="Quitar apuestas">
              <Trash2 size={16} />
            </button>
            {lastBets && !totalBet && (
              <button className="btn-secondary" onClick={repeat} disabled={spinning}>
                <RotateCcw size={16} /> Repetir
              </button>
            )}
            <button className="btn-primary flex-1" onClick={spin} disabled={spinning || !totalBet}>
              {spinning ? "Girando" : totalBet ? `Girar con ${formatPeseis(totalBet)}` : "Girar"}
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-fg3">Pleno paga 35 a 1. Docenas y columnas 2 a 1. Rojo, negro, par, impar, 1 a 18 y 19 a 36 pagan 1 a 1.</p>
        </>
      )}
    </main>
  );
}
