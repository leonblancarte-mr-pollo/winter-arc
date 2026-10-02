"use client";
// Puntos de hábitos gastados en el casino (comprar 5,000 peseis cuesta 1 punto).
// Se restan del total como si fueran un "bonus" negativo en la fecha de la compra.
// Si la tabla del casino todavía no existe, regresa una lista vacía en lugar de fallar.
import { dateInMX } from "./dates";
import { fetchAll, supabase } from "./supabase";

export type SpentPoint = { user_id: string; date: string; points: number };

export async function fetchSpentPoints(userId?: string): Promise<SpentPoint[]> {
  try {
    const rows = await fetchAll<{ user_id: string; points_cost: number; created_at: string }>((from, to) => {
      let q = supabase.from("casino_transactions").select("user_id,points_cost,created_at").eq("type", "buy_peseis");
      if (userId) q = q.eq("user_id", userId);
      return q.order("id").range(from, to);
    });
    return rows
      .filter((r) => r.points_cost > 0)
      .map((r) => ({ user_id: r.user_id, date: dateInMX(r.created_at), points: -r.points_cost }));
  } catch {
    return [];
  }
}
