"use client";
// PANTALLA 3: Chat grupal en tiempo real
import { SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorBox, Spinner } from "@/components/ui";
import { dateInMX, longLabel, timeInMX, todayMX } from "@/lib/dates";
import { errorES, supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";

const LIMIT = 100;

export default function ChatPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Nombres conocidos (para saber si hay que recargar perfiles al llegar un mensaje)
  const namesRef = useRef(names);
  useEffect(() => {
    namesRef.current = names;
  }, [names]);

  const loadNames = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("id,display_name");
    setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name])));
  }, []);

  // Agrega mensajes sin repetir y en orden
  const merge = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const map = new Map((prev ?? []).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.id - b.id).slice(-LIMIT * 2);
    });
  }, []);

  useEffect(() => {
    // Carga datos de Supabase al abrir la pantalla (los setState ocurren después de la respuesta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNames();
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (error) return setError(errorES(error.message));
        setMessages([...(data ?? [])].reverse() as Message[]);
      });

    // Escucha mensajes nuevos en tiempo real
    const channel = supabase
      .channel("chat-grupal")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        merge([m]);
        if (!namesRef.current[m.user_id]) loadNames();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNames, merge]);

  // Baja al mensaje más reciente
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabase.from("messages").insert({ user_id: userId, content }).select().single();
    setSending(false);
    if (error) return setError(`No se envió: ${errorES(error.message)}`);
    setText("");
    merge([data as Message]);
  }

  const today = todayMX();

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col">
      <h1 className="display mb-6 text-5xl">Chat</h1>

      <div className="flex flex-1 flex-col pb-24">
        {!messages ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-fg3">Todavía no hay mensajes. Escribe el primero.</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.user_id === userId;
            const day = dateInMX(m.created_at);
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || dateInMX(prev.created_at) !== day;
            const firstOfGroup = newDay || prev.user_id !== m.user_id;
            const lastOfGroup = !next || next.user_id !== m.user_id || dateInMX(next.created_at) !== day;
            const name = names[m.user_id] ?? "";
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-6 text-center text-xs text-fg3">
                    {day === today ? "Hoy" : <span className="inline-block first-letter:uppercase">{longLabel(day)}</span>}
                  </div>
                )}
                <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${firstOfGroup ? "mt-4" : "mt-1"}`}>
                  {!mine && (
                    <div className="w-7 shrink-0">
                      {lastOfGroup && <Avatar name={name} />}
                    </div>
                  )}
                  <div className={`flex max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && firstOfGroup && <span className="mb-1 px-1 text-xs font-medium text-fg2">{name}</span>}
                    <div
                      className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 ${
                        mine ? "bg-sky-400/15 text-sky-200" : "bg-zinc-900 text-white"
                      }`}
                    >
                      {m.content}
                    </div>
                    {lastOfGroup && <span className="mt-1 px-1 text-[11px] tabular-nums text-zinc-600">{timeInMX(m.created_at)}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Campo de texto fijo arriba de la barra inferior */}
      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-hairline bg-black/80 px-4 py-3 backdrop-blur-xl"
      >
        {error && (
          <div className="mx-auto mb-2 max-w-2xl">
            <ErrorBox message={error} />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            className="input flex-1 py-2"
            placeholder="Escribe un mensaje"
            aria-label="Mensaje"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-black transition-colors duration-150 ease-out hover:bg-zinc-100 disabled:opacity-30"
            aria-label="Enviar"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </form>
    </main>
  );
}

// Círculo con las iniciales del nombre
function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-raised text-[11px] font-medium text-fg2" aria-hidden>
      {initials}
    </div>
  );
}
