"use client";
// TRAGAMONEDAS: arma tu apuesta con fichas y jala la palanca.
// El resultado lo decide el servidor con un generador aleatorio seguro; aquí solo se anima.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AnimatedNumber from "@/components/casino/AnimatedNumber";
import { ChipPicker } from "@/components/casino/Chips";
import SlotReels, { type SlotReelsHandle } from "@/components/casino/SlotReels";
import { ErrorBox, Spinner } from "@/components/ui";
import { casinoPost, formatPeseis, useCasinoBalance } from "@/lib/casino/client";
import { PAIR_MULTIPLIER, SLOT_SYMBOLS, theoreticalReturn } from "@/lib/casino/slots";

type SlotResponse = { reels: number[]; kind: "three" | "pair" | "none"; multiplier: number; bet: number; payout: number; net: number; balance: number };

export default function TragamonedasPage() {
  const { user } = useAuth();
  const { balance, setBalance, error: balanceError } = useCasinoBalance(user!.id);
  const [stack, setStack] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<SlotResponse | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reels = useRef<SlotReelsHandle>(null);
  const bet = stack.reduce((s, v) => s + v, 0);

  // Quita el aviso de "¡GANASTE!" después de unos segundos
  useEffect(() => {
    if (burst == null) return;
    const t = setTimeout(() => setBurst(null), 2200);
    return () => clearTimeout(t);
  }, [burst]);

  async function pull() {
    if (bet < 1) return setError("Arma tu apuesta tocando las fichas.");
    if (balance != null && bet > balance) return setError("No te alcanza para esa apuesta.");
    setError(null);
    setLast(null);
    setSpinning(true);
    try {
      const res = await casinoPost<SlotResponse>("/api/casino/slots", { bet });
      await reels.current?.spin(res.reels);
      setLast(res);
      setBalance(res.balance); // el saldo cuenta hacia su nuevo valor
      if (res.net > 0) setBurst(res.net);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSpinning(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl">
      <Link href="/casino" className="inline-flex items-center gap-2 text-fg2 transition-colors duration-150 hover:text-fg">
        <ArrowLeft size={16} /> Casino
      </Link>
      <div className="mt-4 flex items-end justify-between gap-4">
        <h1 className="display text-5xl">Tragamonedas</h1>
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

      <section className="mt-6">
        <SlotReels ref={reels} highlight={!!last && last.net > 0} />
        <div className="mt-3 min-h-12 text-center" aria-live="polite">
          {spinning ? (
            <p className="text-fg2">Girando…</p>
          ) : last ? (
            <p className={`font-medium ${last.net > 0 ? "text-done" : last.net < 0 ? "text-danger" : "text-fg2"}`}>
              {last.kind === "three"
                ? `Tres ${SLOT_SYMBOLS[last.reels[0]].glyph}: ganaste ${formatPeseis(last.net)} peseis`
                : last.kind === "pair"
                  ? last.net > 0
                    ? `Par: ganaste ${formatPeseis(last.net)} peseis`
                    : "Par: recuperas tu apuesta"
                  : `Nada esta vez: perdiste ${formatPeseis(last.bet)} peseis`}
            </p>
          ) : null}
        </div>
      </section>

      {balance == null ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3">
          <ChipPicker stack={stack} onChange={setStack} max={balance} disabled={spinning} />
          <button className="btn-primary py-4 text-base" onClick={pull} disabled={spinning || bet < 1 || bet > balance}>
            {spinning ? "Girando" : bet ? `Jalar la palanca con ${formatPeseis(bet)}` : "Arma tu apuesta para jugar"}
          </button>
          {error && <ErrorBox message={error} />}
        </div>
      )}

      {/* Tabla de pagos */}
      <section className="card mt-8">
        <h2 className="mb-3 font-medium">Tabla de pagos</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {[...SLOT_SYMBOLS].reverse().map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span className="text-xl tracking-widest">{s.glyph.repeat(3)}</span>
              <span className="tabular-nums text-fg2">× {s.three}</span>
            </li>
          ))}
          <li className="mt-1 flex items-center justify-between border-t border-line pt-2">
            <span>Dos iguales, en cualquier lugar</span>
            <span className="tabular-nums text-fg2">× {PAIR_MULTIPLIER}</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-fg3">
          El pago incluye tu apuesta y se redondea hacia abajo. A la larga regresa {(theoreticalReturn() * 100).toFixed(1)}% de lo apostado.
        </p>
      </section>

      {burst != null && (
        <div className="pointer-events-none fixed left-1/2 top-1/3 z-[60] animate-points" role="status">
          <div className="rounded-xl border border-done/30 bg-surface px-8 py-6 text-center">
            <div className="display text-4xl text-fg">¡GANASTE!</div>
            <div className="display mt-1 text-6xl text-done">+{formatPeseis(burst)}</div>
            <div className="label mt-2">peseis</div>
          </div>
        </div>
      )}
    </main>
  );
}
