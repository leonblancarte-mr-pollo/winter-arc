"use client";
// Grupo activo (ranking y chat por grupo). Lo comparten Stats y Chat; se recuerda en el celular.
// Casino, ajedrez, hábitos y puntos NO dependen del grupo.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { errorES, supabase } from "@/lib/supabase";
import type { Group } from "@/lib/types";

const STORAGE_KEY = "winter-arc:grupo-activo";

type GroupState = {
  // false si aún no se corrió supabase/grupos.sql: la app sigue como antes (todos contra todos)
  enabled: boolean;
  loading: boolean;
  groups: Group[];
  active: Group | null;
  // Miembros del grupo activo (null = sin filtro)
  memberIds: string[] | null;
  isAdmin: boolean;
  select: (groupId: string) => void;
  join: (code: string) => Promise<string | null>;
  create: (name: string, code: string) => Promise<{ group: Group } | { error: string }>;
};

const GroupContext = createContext<GroupState>({
  enabled: false,
  loading: true,
  groups: [],
  active: null,
  memberIds: null,
  isAdmin: false,
  select: () => {},
  join: async () => null,
  create: async () => ({ error: "" }),
});

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

// Errores de las funciones SQL (vienen en español desde grupos.sql)
function rpcError(msg: string) {
  if (msg.includes("duplicate key")) return "Ese código ya existe.";
  return errorES(msg);
}

export function GroupProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Mis grupos (los más antiguos primero) y si soy admin
  const load = useCallback(
    async (prefer?: string) => {
      const [mine, admin] = await Promise.all([
        supabase.from("group_members").select("joined_at, groups(*)").eq("user_id", userId).order("joined_at"),
        supabase.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);
      if (mine.error) {
        setEnabled(false);
        setLoading(false);
        return;
      }
      const list = (mine.data ?? []).map((r) => r.groups as unknown as Group).filter(Boolean);
      const wanted = prefer ?? readStored();
      const pick = list.find((g) => g.id === wanted) ?? list[0] ?? null;
      setEnabled(true);
      setGroups(list);
      setIsAdmin(!admin.error && !!admin.data);
      setActiveId(pick?.id ?? null);
      if (pick) store(pick.id);
      setLoading(false);
    },
    [userId],
  );

  useEffect(() => {
    // Carga al iniciar sesión (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Miembros del grupo activo, para filtrar el ranking
  useEffect(() => {
    if (!enabled || !activeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMemberIds(enabled ? [] : null);
      return;
    }
    let alive = true;
    setMemberIds(null);
    supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", activeId)
      .then(({ data, error }) => {
        if (!alive) return;
        setMemberIds(error ? [userId] : (data ?? []).map((r) => r.user_id as string));
      });
    return () => {
      alive = false;
    };
  }, [enabled, activeId, userId]);

  const select = useCallback((groupId: string) => {
    setActiveId(groupId);
    store(groupId);
  }, []);

  // Unirse con código: si funciona, queda como grupo activo. Regresa el error o null.
  const join = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("join_group", { p_code: code.trim().toUpperCase() });
      if (error) return rpcError(error.message);
      await load((data as Group).id);
      return null;
    },
    [load],
  );

  const create = useCallback(
    async (name: string, code: string) => {
      const { data, error } = await supabase.rpc("create_group", { p_name: name.trim(), p_code: code.trim() || null });
      if (error) return { error: rpcError(error.message) };
      await load((data as Group).id);
      return { group: data as Group };
    },
    [load],
  );

  const active = groups.find((g) => g.id === activeId) ?? null;

  return (
    <GroupContext.Provider value={{ enabled, loading, groups, active, memberIds, isAdmin, select, join, create }}>
      {children}
    </GroupContext.Provider>
  );
}

export const useGroups = () => useContext(GroupContext);
