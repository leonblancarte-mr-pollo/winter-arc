"use client";
// 1) Ranking de la carrera: barras horizontales con todos los usuarios
import { Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorBox, SectionTitle, Spinner } from "@/components/ui";
import { CHART_COLORS } from "@/lib/constants";
import { errorES, supabase } from "@/lib/supabase";
import type { LeaderboardRow } from "@/lib/types";
import { tooltipStyle } from "./chartTheme";

export default function Ranking({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("leaderboard")
      .select("*")
      .order("total_points", { ascending: false })
      .order("display_name")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(errorES(error.message));
        else setRows((data ?? []) as LeaderboardRow[]);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <ErrorBox message={`No se pudo cargar el ranking: ${error}`} />;
  if (!rows) return <Spinner label="Cargando ranking…" />;

  const myIdx = rows.findIndex((r) => r.user_id === userId);
  const me = rows[myIdx];
  const ahead = myIdx > 0 ? rows[myIdx - 1] : null;
  const last = rows.length - 1;
  const data = rows.map((r, i) => ({
    name: `${i + 1}. ${r.display_name}${r.user_id === userId ? " (tú)" : ""}`,
    puntos: r.total_points,
    color: i === 0 ? CHART_COLORS.gold : i === last && rows.length > 1 ? CHART_COLORS.red : r.user_id === userId ? CHART_COLORS.cyan : "#4b5563",
    me: r.user_id === userId,
  }));

  return (
    <section>
      <SectionTitle>Ranking de la carrera</SectionTitle>

      {me && (
        <div className="card mb-3 flex items-center gap-4">
          <div className="text-5xl font-black tabular-nums text-ice">#{myIdx + 1}</div>
          <div className="text-sm text-neutral-300">
            {myIdx === 0 ? (
              <span className="flex items-center gap-1.5 font-semibold text-gold">
                <Crown size={16} /> ¡Vas en primer lugar!
                {rows[1] && <span className="text-neutral-400">(+{me.total_points - rows[1].total_points} sobre el #2)</span>}
              </span>
            ) : (
              <>
                Te faltan <b className="text-white">{ahead!.total_points - me.total_points + 1}</b> pts para pasar a{" "}
                <b className="text-white">{ahead!.display_name}</b> (#{myIdx}).
              </>
            )}
            <div className="text-xs text-neutral-500">de {rows.length} participantes</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1"><Crown size={12} className="text-gold" /> Líder</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-ice" /> Tú</span>
          {rows.length > 1 && <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-400" /> Último lugar</span>}
        </div>
        <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 42 + 20)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#ddd", fontSize: 12 }}
              tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
            />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v} pts`, "Puntos"]} />
            <Bar dataKey="puntos" radius={[0, 8, 8, 0]} barSize={24}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} stroke={d.me ? "#fff" : undefined} strokeWidth={d.me ? 2 : 0} />
              ))}
              <LabelList dataKey="puntos" position="right" fill="#fff" fontSize={12} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
