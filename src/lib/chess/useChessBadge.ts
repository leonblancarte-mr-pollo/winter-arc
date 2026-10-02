"use client";
// Número para el globito de la pestaña de Ajedrez: invitaciones pendientes + partidas donde me toca
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ChessGame } from "@/lib/types";
import { isMyTurn } from "./shared";

export function useChessBadge(userId: string | undefined, refreshKey: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const check = async () => {
      const [inv, games] = await Promise.all([
        supabase.from("chess_invitations").select("id", { count: "exact", head: true }).eq("to_user_id", userId).eq("status", "pending"),
        supabase.from("chess_games").select("*").eq("status", "active"),
      ]);
      if (!alive) return;
      // Si las tablas aún no existen, simplemente no se muestra el globito
      const invites = inv.error ? 0 : (inv.count ?? 0);
      const turns = games.error ? 0 : ((games.data ?? []) as ChessGame[]).filter((g) => isMyTurn(g, userId)).length;
      setCount(invites + turns);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [userId, refreshKey]);

  return count;
}
