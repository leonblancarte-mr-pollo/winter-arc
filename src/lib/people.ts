"use client";
// Nombres y avatares de los usuarios. Si la columna avatar_override aún no existe
// (no se ha corrido casino.sql), pide solo los nombres.
import { supabase } from "./supabase";
import type { AvatarOverride } from "./types";

export type Person = { id: string; name: string; avatar: AvatarOverride };

export async function loadPeople(ids?: string[]): Promise<Record<string, Person>> {
  const query = (cols: string) => {
    const q = supabase.from("profiles").select(cols);
    return ids ? q.in("id", ids) : q;
  };
  let res = await query("id,display_name,avatar_override");
  if (res.error) res = await query("id,display_name");
  const rows = (res.data ?? []) as unknown as { id: string; display_name: string; avatar_override?: AvatarOverride }[];
  return Object.fromEntries(rows.map((p) => [p.id, { id: p.id, name: p.display_name, avatar: p.avatar_override ?? null }]));
}
