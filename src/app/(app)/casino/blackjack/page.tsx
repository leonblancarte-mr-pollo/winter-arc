"use client";
// BLACKJACK: 1 baraja, el dealer se planta en 17 suave, blackjack paga 3 a 2.
// El servidor reparte y guarda la carta oculta; aquí las cartas se muestran una por una.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import AnimatedNumber from "@/components/casino/AnimatedNumber";
import { ChipPicker } from "@/components/casino/Chips";
import PlayingCard from "@/components/casino/PlayingCard";
import { ErrorBox, Spinner } from "@/components/ui";
import { handValue, RESULT_TEXT, type BlackjackPublicHand, type Card } from "@/lib/casino/blackjack";
import { casinoPost, formatPeseis, useCasinoBalance } from "@/lib/casino/client";

type BJResponse = { hand: BlackjackPublicHand | null; shoeLeft: number; balance: number };
type Shown = { player: Card[]; dealer: (Card | null)[] };

const DEAL_MS = 300;
const FLIP_MS = 450;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BlackjackPage() {
  const { user } = useAuth();
  const { balance, setBalance, error: balanceError } = useCasinoBalance(user!.id);
  const [stack, setStack] = useState<number[]>([]);
  const [hand, setHand] = useState<BlackjackPublicHand | null>(null);
  const [shown, setShown] = useState<Shown>({ player: [], dealer: [] });
  const [shoeLeft, setShoeLeft] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownRef = useRef<Shown>({ player: [], dealer: [] });

  const bet = stack.reduce((s, v) => s + v, 0);

  const show = (next: Shown) => {
    shownRef.current = next;
    setShown(next);
  };

  // Muestra las cartas nuevas una por una (y voltea la del dealer) hasta igualar al servidor
  const reveal = useCallback(async (target: BlackjackPublicHand, fresh: boolean) => {
    setAnimating(true);
    let cur: Shown = fresh ? { player: [], dealer: [] } : shownRef.current;
    if (fresh) show(cur);
    const steps: (() => Shown)[] = [];
    if (fresh) {
      // Orden real de reparto: jugador, dealer, jugador, dealer (boca abajo)
      steps.push(() => ({ ...cur, player: [target.player[0]] }));
      steps.push(() => ({ ...cur, dealer: [target.dealer[0]] }));
      steps.push(() => ({ ...cur, player: target.player.slice(0, 2) }));
      steps.push(() => ({ ...cur, dealer: [target.dealer[0], null] }));
    }
    const base = fresh ? 2 : cur.player.length;
    for (let i = base; i < target.player.length; i++) steps.push(() => ({ ...cur, player: target.player.slice(0, i + 1) }));
    for (const step of steps) {
      cur = step();
      show(cur);
      await wait(DEAL_MS);
    }
    // Voltea la carta oculta del dealer y luego reparte sus cartas extra
    if (target.dealer[1] != null && cur.dealer[1] == null) {
      cur = { ...cur, dealer: [target.dealer[0], target.dealer[1]] };
      show(cur);
      await wait(FLIP_MS);
    }
    for (let i = Math.max(2, cur.dealer.length); i < target.dealer.length; i++) {
      cur = { ...cur, dealer: target.dealer.slice(0, i + 1) };
      show(cur);
      await wait(DEAL_MS);
    }
    setAnimating(false);
  }, []);

  const act = useCallback(
    async (action: "deal" | "hit" | "stand" | "double" | "state", fresh = false) => {
      setError(null);
      setBusy(true);
      try {
        const res = await casinoPost<BJResponse>("/api/casino/blackjack", action === "deal" ? { action, bet } : { action });
        setShoeLeft(res.shoeLeft);
        if (res.hand) {
          setHand({ ...res.hand, status: "player", result: undefined }); // el resultado se muestra al terminar la animación
          if (action === "state") show({ player: res.hand.player, dealer: res.hand.dealer });
          else await reveal(res.hand, fresh);
          setHand(res.hand);
        } else {
          setHand(null);
        }
        setBalance(res.balance);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [bet, reveal, setBalance],
  );

  // Al abrir: si había una mano a medias, la retoma
  useEffect(() => {
    // Carga la mano en curso (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    act("state");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playing = hand?.status === "player";
  const locked = busy || animating;
  const playerValue = handValue(shown.player);
  const dealerVisible = shown.dealer.filter((c): c is Card => c != null);
  const dealerValue = handValue(dealerVisible);
  const done = hand?.status === "done" && !animating;
  const net = done ? (hand!.payout ?? 0) - hand!.bet : 0;

  return (
    <main className="mx-auto max-w-xl">
      <Link href="/casino" className="inline-flex items-center gap-2 text-fg2 transition-colors duration-150 hover:text-fg">
        <ArrowLeft size={16} /> Casino
      </Link>
      <div className="mt-4 flex items-end justify-between gap-4">
        <h1 className="display text-5xl">Blackjack</h1>
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

      {/* Mesa */}
      <section className="card mt-6 flex min-h-[340px] flex-col justify-between gap-6 bg-gradient-to-b from-emerald-950/40 to-surface">
        <Hand title="Dealer" cards={shown.dealer} value={dealerVisible.length ? dealerValue : null} hiddenCard={shown.dealer[1] === null} />
        <div className="min-h-10 text-center" aria-live="polite">
          {done && hand?.result && (
            <div>
              <div className={`display text-3xl ${net > 0 ? "text-done" : net < 0 ? "text-danger" : "text-fg"}`}>{RESULT_TEXT[hand.result]}</div>
              <div className="text-sm text-fg2">
                {net > 0 ? `+${formatPeseis(net)} peseis` : net < 0 ? `−${formatPeseis(-net)} peseis` : "Recuperas tu apuesta"}
              </div>
            </div>
          )}
          {playing && !animating && <div className="text-sm text-fg2">Apuesta: {formatPeseis(hand!.bet)} peseis</div>}
        </div>
        <Hand title="Tú" cards={shown.player} value={shown.player.length ? playerValue : null} />
      </section>

      {shoeLeft != null && <p className="mt-2 text-right text-xs text-fg3">Quedan {shoeLeft} cartas en el mazo</p>}

      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}

      {balance == null ? (
        <Spinner />
      ) : playing ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className="btn-primary" onClick={() => act("hit")} disabled={locked}>
            Pedir
          </button>
          <button className="btn-secondary justify-center py-3" onClick={() => act("stand")} disabled={locked}>
            Plantarse
          </button>
          <button
            className="btn-secondary justify-center py-3"
            onClick={() => act("double")}
            disabled={locked || !hand?.canDouble || balance < hand.bet}
            title="Dobla tu apuesta y recibe exactamente una carta más"
          >
            Doblar
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <ChipPicker stack={stack} onChange={setStack} max={balance} disabled={locked} />
          <button className="btn-primary" onClick={() => act("deal", true)} disabled={locked || bet < 1 || bet > balance}>
            {bet ? `Repartir con ${formatPeseis(bet)}` : "Arma tu apuesta para repartir"}
          </button>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-fg3">
        El dealer se planta en 17, incluso suave. Blackjack paga 3 a 2. Puedes doblar con tus primeras 2 cartas. Por ahora no hay dividir
        (split) ni seguro.
      </p>
    </main>
  );
}

function Hand({ title, cards, value, hiddenCard }: { title: string; cards: (Card | null)[]; value: { total: number; soft: boolean } | null; hiddenCard?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="label">{title}</span>
        {value && (
          <span className={`rounded-full border px-2 text-xs tabular-nums ${value.total > 21 ? "border-red-500/40 text-danger" : "border-line text-fg"}`}>
            {value.soft && value.total < 21 ? `${value.total - 10} / ${value.total}` : value.total}
            {hiddenCard ? " + ?" : ""}
          </span>
        )}
      </div>
      <div className="flex min-h-[92px] flex-wrap gap-2">
        {cards.map((c, i) => (
          <PlayingCard key={i} card={c} faceDown={c == null} />
        ))}
      </div>
    </div>
  );
}
