"use client";
// Llamadas del navegador al casino. Las apuestas van a las rutas del servidor (/api/casino/...)
// con el token de sesión; el saldo solo se LEE desde aquí, nunca se escribe.
import { useCallback, useEffect, useState } from "react";
import { errorES, supabase } from "@/lib/supabase";

export const STARTING_BALANCE = 10000;
export const CHIP_VALUES = [1, 2, 5, 10, 20, 50, 100] as const;
export const POWER_COST = { rename: 50000, burro: 100000 } as const;
export const BUY_AMOUNT = 5000;

export async function casinoPost<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Sin conexión. El casino necesita internet.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Ocurrió un error en el casino.");
  return json as T;
}

// Mensajes de error de las funciones SQL (comprar peseis, poderes) en español claro
export function casinoErrorES(msg: string) {
  if (msg.includes("Could not find the function") || msg.includes("does not exist")) {
    return "Falta crear las tablas del casino: corre supabase/casino.sql en Supabase.";
  }
  return errorES(msg);
}

// Mi saldo de peseis
export function useCasinoBalance(userId: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("casino_balance").select("balance").eq("user_id", userId).maybeSingle();
    if (error) return setError(casinoErrorES(error.message));
    setError(null);
    setBalance(Number(data?.balance ?? STARTING_BALANCE));
  }, [userId]);

  useEffect(() => {
    // Carga el saldo al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { balance, setBalance, error, reload };
}

export const formatPeseis = (n: number) => n.toLocaleString("es-MX");
