"use client";
// Número que "cuenta" de su valor anterior al nuevo (para el saldo de peseis)
import { useEffect, useRef, useState } from "react";
import { formatPeseis } from "@/lib/casino/client";

export default function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (value - start) * eased);
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{formatPeseis(shown)}</>;
}
