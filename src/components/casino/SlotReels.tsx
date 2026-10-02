"use client";
// Los 3 carretes de la tragamonedas. Giran, frenan poco a poco y paran uno tras otro
// (1, luego 2, luego 3), con un pequeño "tic" cada vez que pasa un símbolo por la línea.
// El resultado ya viene del servidor; aquí solo se anima hasta él.
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { randomInt } from "@/lib/casino/rng";
import { SLOT_SYMBOLS } from "@/lib/casino/slots";

const H = 72; // alto de cada símbolo (px)
const ROWS = 3; // se ven 3 filas; la del centro es la línea de pago
const FILL = [22, 30, 38]; // símbolos de relleno por carrete (más = gira más tiempo)
const DURATION = [1500, 2050, 2600]; // cada carrete para un poco después que el anterior

const rand = () => randomInt(SLOT_SYMBOLS.length);

// Frena suave y al final se pasa un poquito y regresa (como el "clac" de un carrete real)
function easeOutBack(t: number) {
  const s = 0.9;
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export type SlotReelsHandle = { spin: (result: number[]) => Promise<void> };

const SlotReels = forwardRef<SlotReelsHandle, { highlight?: boolean }>(function SlotReels({ highlight }, ref) {
  // Cada carrete es una tira de símbolos; al girar se arma una tira nueva que termina en el resultado
  const [strips, setStrips] = useState<number[][]>(() => [0, 1, 2].map((i) => [i + 2, i, i + 1].map((n) => n % SLOT_SYMBOLS.length)));
  const tracks = useRef<(HTMLDivElement | null)[]>([]);
  const windows = useRef<(HTMLDivElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    spin(result: number[]) {
      // Tira nueva: los 3 visibles de ahora + relleno al azar + [vecino, RESULTADO, vecino]
      const next = strips.map((s, r) => {
        const visible = s.slice(-ROWS);
        const filler = Array.from({ length: FILL[r] }, rand);
        return [...visible, ...filler, rand(), result[r], rand()];
      });
      // Pinta la tira nueva YA (sin esperar) y la pone al inicio, mostrando los mismos 3 símbolos de antes
      flushSync(() => setStrips(next));
      tracks.current.forEach((el) => el && (el.style.transform = "translateY(0px)"));
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      return new Promise<void>((resolve) => {
        const ends = next.map((strip) => (strip.length - ROWS) * H);
        const lastTick = [0, 0, 0];
        const stopped = [false, false, false];
        const t0 = performance.now();
        let finished = false;

        const place = (r: number, y: number) => {
          const el = tracks.current[r];
          if (el) el.style.transform = `translateY(${-y}px)`;
        };
        const tick = (r: number, strong: boolean) => {
          windows.current[r]?.animate(
            [{ transform: "translateY(0)" }, { transform: `translateY(${strong ? 4 : 1.5}px)` }, { transform: "translateY(0)" }],
            { duration: strong ? 160 : 70, easing: "ease-out" },
          );
        };
        const finish = () => {
          if (finished) return;
          finished = true;
          ends.forEach((y, r) => place(r, y));
          resolve();
        };

        if (reduce) return finish();

        const frame = (now: number) => {
          if (finished) return;
          let allDone = true;
          for (let r = 0; r < 3; r++) {
            const t = Math.min(1, Math.max(0, now - t0) / DURATION[r]);
            const y = ends[r] * easeOutBack(t);
            place(r, y);
            const passed = Math.floor(y / H);
            if (passed !== lastTick[r] && t < 1) {
              lastTick[r] = passed;
              tick(r, false);
            }
            if (t >= 1 && !stopped[r]) {
              stopped[r] = true;
              tick(r, true);
            }
            if (t < 1) allDone = false;
          }
          if (allDone) setTimeout(finish, 180);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        // Respaldo FUERA de la animación: si la app se oculta (celular bloqueado) y el navegador
        // pausa la animación, el giro termina igual y muestra el resultado
        setTimeout(finish, DURATION[2] + 1500);
      });
    },
  }));

  return (
    <div className={`relative rounded-xl border p-3 transition-colors duration-300 ${highlight ? "border-done/60 bg-done/[0.06]" : "border-line bg-surface"}`}>
      <div className="grid grid-cols-3 gap-2">
        {strips.map((strip, r) => (
          <div
            key={r}
            ref={(el) => {
              windows.current[r] = el;
            }}
            className="relative overflow-hidden rounded-lg bg-zinc-100"
            style={{ height: H * ROWS }}
          >
            <div
              ref={(el) => {
                tracks.current[r] = el;
              }}
              className="will-change-transform"
              style={{ transform: "translateY(0px)" }}
            >
              {strip.map((s, i) => (
                <div key={i} className="flex items-center justify-center text-[44px] leading-none" style={{ height: H }} aria-hidden>
                  {SLOT_SYMBOLS[s].glyph}
                </div>
              ))}
            </div>
            {/* Sombra arriba y abajo para que se vea como un cilindro */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/45" />
          </div>
        ))}
      </div>
      {/* Línea de pago (fila del centro) */}
      <div className="pointer-events-none absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2 bg-accent/70" />
      <p className="sr-only" aria-live="polite">
        {strips.map((s) => SLOT_SYMBOLS[s[s.length - 2]]?.id).join(", ")}
      </p>
    </div>
  );
});

export default SlotReels;
