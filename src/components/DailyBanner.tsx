"use client";
// Banner diario: la primera vez que abres la app en un día nuevo (hora de CDMX) dice si ayer
// fuiste el mejor o el peor entre quienes marcaron al menos 1 hábito. Si fuiste el mejor, cae confeti.
import { TrendingDown, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COMPETITION_END, COMPETITION_START } from "@/lib/constants";
import { addDays, todayMX, weekStart } from "@/lib/dates";
import { dailyPoints, groupChecks } from "@/lib/points";
import { fetchAll, supabase } from "@/lib/supabase";
import type { BonusEvent, HabitCheck } from "@/lib/types";

const BEST_MESSAGES = [
  "🔥 Fuiste el más disciplinado ayer. Sigue así, carnal",
  "👑 Ayer te rifaste: nadie sumó más que tú. Hoy toca defender el trono",
  "💪 Mejor del día ayer. Los demás todavía andan buscando los tenis",
  "🚀 Ayer fuiste una máquina. Que no se te suban los humos… o sí, te los ganaste",
];
const WORST_MESSAGES = [
  "📉 Ayer casi no sumaste puntos. Ponte las pilas hoy",
  "🐢 Ayer fuiste el que menos sumó. La tortuga ya te va alcanzando, compa",
  "🛋️ El sillón te ganó ayer. Hoy es buen día para la revancha",
  "😬 Último lugar del día de ayer. Nada que un buen día de hoy no arregle",
];

type Result = { kind: "best" | "worst"; message: string; points: number };

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// Calcula cómo le fue a "userId" ayer, o null si no fue ni el mejor ni el peor
async function resultFor(userId: string, yesterday: string): Promise<Result | null> {
  if (yesterday < COMPETITION_START || yesterday > COMPETITION_END) return null;
  // Se piden los hábitos desde el lunes para que cuente bien el bonus semanal que caiga ayer
  const [checks, bonus] = await Promise.all([
    fetchAll<HabitCheck>((f, t) =>
      supabase.from("habit_checks").select("user_id,date,habit_key").gte("date", weekStart(yesterday)).lte("date", yesterday).order("id").range(f, t),
    ),
    fetchAll<BonusEvent>((f, t) => supabase.from("bonus_events").select("*").eq("date", yesterday).order("id").range(f, t)),
  ]);

  // Solo cuentan quienes marcaron al menos 1 hábito ayer
  const players = [...new Set(checks.filter((c) => c.date === yesterday).map((c) => c.user_id))];
  if (players.length < 2) return null;
  const points = new Map(
    players.map((id) => [
      id,
      dailyPoints(
        groupChecks(checks.filter((c) => c.user_id === id)),
        bonus.filter((b) => b.user_id === id),
      )[yesterday] ?? 0,
    ]),
  );
  const mine = points.get(userId);
  if (mine == null) return null;
  const max = Math.max(...points.values());
  const min = Math.min(...points.values());
  if (max === min) return null; // empate total: nadie destaca
  if (mine === max) return { kind: "best", message: pick(BEST_MESSAGES), points: mine };
  if (mine === min) return { kind: "worst", message: pick(WORST_MESSAGES), points: mine };
  return null;
}

export default function DailyBanner({ userId }: { userId: string }) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const today = todayMX();
    const key = `winterarc:dailyBanner:${userId}`;
    try {
      if (localStorage.getItem(key) === today) return;
    } catch {
      // Sin localStorage se revisa en cada apertura
    }
    let alive = true;
    resultFor(userId, addDays(today, -1))
      .then((r) => {
        if (!alive) return;
        try {
          localStorage.setItem(key, today);
        } catch {
          // Sin localStorage no se puede recordar; se mostrará de nuevo en la próxima carga
        }
        setResult(r);
      })
      .catch(() => {
        // Si falla la consulta no se marca el día: se reintenta en la próxima apertura
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setResult(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  if (!result) return null;
  const best = result.kind === "best";
  const close = () => setResult(null);

  return (
    <>
      {best && <Confetti />}
      <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={close}>
        <div
          role="dialog"
          aria-label={best ? "Mejor del día" : "Peor del día"}
          onClick={(e) => e.stopPropagation()}
          className={`animate-deal relative w-full max-w-sm rounded-2xl border p-6 text-center ${
            best ? "border-amber-300/40 bg-gradient-to-b from-amber-400/20 via-pink-500/10 to-surface" : "border-line bg-surface"
          }`}
        >
          <button onClick={close} className="icon-btn absolute right-3 top-3" aria-label="Cerrar">
            <X size={16} />
          </button>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${best ? "bg-amber-400/20 text-amber-300" : "bg-white/[0.06] text-fg2"}`}>
            {best ? <Trophy size={28} /> : <TrendingDown size={28} />}
          </div>
          <div className="label mb-2">{best ? "Mejor del día" : "Peor del día"}</div>
          <p className={`text-lg font-semibold leading-snug ${best ? "text-fg" : "text-fg"}`}>{result.message}</p>
          <p className="mt-3 text-sm text-fg3">
            Ayer sumaste <span className={`font-semibold tabular-nums ${best ? "text-amber-300" : "text-fg2"}`}>{result.points}</span> pts
          </p>
        </div>
      </div>
    </>
  );
}

// Confeti simple en canvas: cae unos segundos y se detiene solo
const COLORS = ["#fbbf24", "#f472b6", "#38bdf8", "#4ade80", "#a78bfa", "#fb923c"];

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h * 0.6 - 10,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy: 2 + Math.random() * 3,
      vx: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
      vr: -0.2 + Math.random() * 0.4,
      sway: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      let visible = 0;
      for (const p of pieces) {
        p.y += p.vy;
        p.sway += 0.05;
        p.x += p.vx + Math.sin(p.sway) * 0.8;
        p.rot += p.vr;
        if (p.y > h + 20) continue;
        visible++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (visible > 0 && now - start < 7000) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
