"use client";
// Carta de baraja. Entra deslizándose (300 ms) y se voltea (flip) cuando se revela.
import { rankOf, suitOf, type Card } from "@/lib/casino/blackjack";

const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_NAME: Record<string, string> = { S: "picas", H: "corazones", D: "diamantes", C: "tréboles" };

export default function PlayingCard({ card, faceDown }: { card: Card | null; faceDown: boolean }) {
  const red = card ? suitOf(card) === "H" || suitOf(card) === "D" : false;
  const glyph = card ? SUIT_GLYPH[suitOf(card)] : "";
  const label = faceDown || !card ? "Carta boca abajo" : `${rankOf(card)} de ${SUIT_NAME[suitOf(card)]}`;
  return (
    <div className="animate-deal h-[92px] w-[64px] shrink-0 [perspective:600px]" role="img" aria-label={label}>
      <div
        className="relative h-full w-full transition-transform duration-[450ms] ease-out [transform-style:preserve-3d]"
        style={{ transform: faceDown ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Frente */}
        <div
          className={`absolute inset-0 flex flex-col justify-between rounded-lg border border-zinc-300 bg-white p-1.5 [backface-visibility:hidden] ${
            red ? "text-red-600" : "text-zinc-900"
          }`}
        >
          {card && (
            <>
              <div className="text-sm font-semibold leading-none">
                {rankOf(card)}
                <div className="text-xs">{glyph}</div>
              </div>
              <div className="self-center text-2xl leading-none">{glyph}</div>
              <div className="rotate-180 text-sm font-semibold leading-none">
                {rankOf(card)}
                <div className="text-xs">{glyph}</div>
              </div>
            </>
          )}
        </div>
        {/* Reverso */}
        <div
          className="absolute inset-0 rounded-lg border border-sky-300/40 bg-sky-950 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(56,189,248,0.25) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, rgba(56,189,248,0.25) 0 2px, transparent 2px 8px)",
          }}
        />
      </div>
    </div>
  );
}
