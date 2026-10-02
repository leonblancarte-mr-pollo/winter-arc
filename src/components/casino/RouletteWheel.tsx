"use client";
// Rueda de ruleta americana en SVG. La rueda gira hacia un lado, la bolita hacia el otro,
// ambas frenan poco a poco (ease-out) y la bolita cae en el casillero del resultado.
// El resultado lo decide el SERVIDOR; aquí solo se anima hacia ese número.
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { colorOf, labelOf, WHEEL_ORDER } from "@/lib/casino/roulette";

const SIZE = 300;
const C = SIZE / 2;
const N = WHEEL_ORDER.length;
const STEP = 360 / N;
const SPIN_MS = 3800; // duración total del giro
const DROP_AT_MS = 2700; // cuándo la bolita baja del carril al casillero
const R_OUT = 146;
const R_TRACK = 136; // carril por donde rueda la bolita
const R_POCKET_OUT = 126;
const R_POCKET_IN = 94;
const R_BALL_REST = 112; // dónde queda la bolita dentro del casillero

const FILL = { red: "#dc2626", black: "#18181b", green: "#059669" };

// Punto en coordenadas del SVG: ángulo en grados medido desde arriba, en sentido horario.
// Se redondea a 2 decimales para que servidor y navegador dibujen exactamente lo mismo.
const r2 = (n: number) => Math.round(n * 100) / 100;
function pt(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [r2(C + r * Math.sin(a)), r2(C - r * Math.cos(a))] as const;
}

function wedge(i: number) {
  const a0 = i * STEP - STEP / 2;
  const a1 = i * STEP + STEP / 2;
  const [x0, y0] = pt(R_POCKET_OUT, a0);
  const [x1, y1] = pt(R_POCKET_OUT, a1);
  const [x2, y2] = pt(R_POCKET_IN, a1);
  const [x3, y3] = pt(R_POCKET_IN, a0);
  return `M${x0},${y0} A${R_POCKET_OUT},${R_POCKET_OUT} 0 0 1 ${x1},${y1} L${x2},${y2} A${R_POCKET_IN},${R_POCKET_IN} 0 0 0 ${x3},${y3} Z`;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

export type RouletteWheelHandle = { spin: (result: number) => Promise<void> };

const RouletteWheel = forwardRef<RouletteWheelHandle>(function RouletteWheel(_, ref) {
  const [wheelDeg, setWheelDeg] = useState(0);
  const [ballDeg, setBallDeg] = useState(0);
  const [dropped, setDropped] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const angles = useRef({ wheel: 0, ball: 0 });

  useImperativeHandle(ref, () => ({
    spin(result: number) {
      const i = WHEEL_ORDER.indexOf(result);
      const newWheel = angles.current.wheel + 360 * 3 + 47;
      // Ángulo final del casillero ganador, ya con la rueda girada
      const target = i * STEP + newWheel;
      // La bolita da ~6 vueltas en sentido contrario y termina justo en ese casillero
      const base = angles.current.ball - 360 * 6;
      const newBall = base - mod(base - target, 360);
      angles.current = { wheel: newWheel, ball: newBall };

      setDropped(false);
      setSpinning(true);
      // Un cuadro después para que el navegador aplique la transición
      requestAnimationFrame(() => {
        setWheelDeg(newWheel);
        setBallDeg(newBall);
      });
      return new Promise<void>((resolve) => {
        setTimeout(() => setDropped(true), DROP_AT_MS);
        setTimeout(() => {
          setSpinning(false);
          resolve();
        }, SPIN_MS + 150);
      });
    },
  }));

  const rot = (deg: number, ms: number, easing: string): React.CSSProperties => ({
    transform: `rotate(${deg}deg)`,
    transformOrigin: `${C}px ${C}px`,
    transformBox: "view-box",
    transition: spinning ? `transform ${ms}ms ${easing}` : "none",
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[300px]" role="img" aria-label="Ruleta">
      {/* Borde de madera y carril de la bolita */}
      <circle cx={C} cy={C} r={R_OUT} fill="#1c1917" stroke="rgba(255,255,255,0.08)" />
      <circle cx={C} cy={C} r={R_TRACK + 6} fill="#0c0a09" />
      <circle cx={C} cy={C} r={R_POCKET_OUT + 1} fill="#27272a" />

      {/* Rueda (casilleros con sus números) */}
      <g style={rot(wheelDeg, SPIN_MS, "cubic-bezier(0.17, 0.67, 0.12, 1)")}>
        {WHEEL_ORDER.map((n, i) => {
          const [tx, ty] = pt((R_POCKET_OUT + R_POCKET_IN) / 2 + 4, i * STEP);
          return (
            <g key={n}>
              <path d={wedge(i)} fill={FILL[colorOf(n)]} stroke="#d4d4d8" strokeOpacity={0.35} strokeWidth={0.6} />
              <text
                x={tx}
                y={ty}
                fill="#fafafa"
                fontSize={9}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${r2(i * STEP)} ${tx} ${ty})`}
              >
                {labelOf(n)}
              </text>
            </g>
          );
        })}
        {/* Centro de la rueda */}
        <circle cx={C} cy={C} r={R_POCKET_IN} fill="#1c1917" stroke="rgba(255,255,255,0.1)" />
        <circle cx={C} cy={C} r={58} fill="#292524" />
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = pt(52, a);
          return <line key={a} x1={C} y1={C} x2={x} y2={y} stroke="#a8a29e" strokeWidth={4} strokeLinecap="round" />;
        })}
        <circle cx={C} cy={C} r={10} fill="#a8a29e" />
      </g>

      {/* Bolita: gira en su carril y luego cae hacia el casillero */}
      <g style={rot(ballDeg, SPIN_MS, "cubic-bezier(0.12, 0.7, 0.15, 1)")}>
        <g
          style={{
            transform: `translateY(${dropped ? R_TRACK - R_BALL_REST : 0}px)`,
            transition: dropped ? "transform 700ms cubic-bezier(0.5, 0, 0.75, 0)" : "transform 300ms ease-out",
          }}
        >
          <circle cx={C} cy={C - R_TRACK} r={5.5} fill="#fafafa" stroke="#a1a1aa" strokeWidth={1} />
        </g>
      </g>
    </svg>
  );
});

export default RouletteWheel;
