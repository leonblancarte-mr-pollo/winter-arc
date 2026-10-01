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
    <main className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="mb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-ice">Winter Arc</p>
        <h1 className="text-2xl font-black">Chat</h1>
      </header>

      <div className="flex flex-1 flex-col gap-2 pb-20">
        {!messages ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">Nadie ha escrito todavía. ¡Rompe el hielo!</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.user_id === userId;
            const day = dateInMX(m.created_at);
            const prev = messages[i - 1];
            const newDay = !prev || dateInMX(prev.created_at) !== day;
            const sameAuthor = prev && !newDay && prev.user_id === m.user_id;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 text-center text-xs font-medium text-neutral-500">
                    {day === today ? "Hoy" : <span className="capitalize">{longLabel(day)}</span>}
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                      mine ? "rounded-br-md bg-ice text-black" : "rounded-bl-md border border-line bg-card2 text-white"
                    }`}
                  >
                    {!mine && !sameAuthor && <div className="mb-0.5 text-xs font-bold text-ice">{names[m.user_id] ?? "…"}</div>}
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div className={`mt-0.5 text-right text-[10px] ${mine ? "text-black/60" : "text-neutral-500"}`}>{timeInMX(m.created_at)}</div>
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
        className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-black/95 px-4 py-2 backdrop-blur"
      >
        {error && (
          <div className="mx-auto mb-2 max-w-2xl">
            <ErrorBox message={error} />
          </div>
        )}
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            className="input flex-1 rounded-full py-2.5"
            placeholder="Escribe un mensaje…"
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ice text-black transition active:scale-95 disabled:opacity-40"
            aria-label="Enviar"
          >
            <SendHorizontal size={20} />
          </button>
        </div>
      </form>
    </main>
  );
}
