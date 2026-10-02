"use client";
// PANTALLA 3: Chat grupal en tiempo real
import { ImagePlay, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import GifPicker from "@/components/chat/GifPicker";
import UserAvatar from "@/components/UserAvatar";
import { ErrorBox, Spinner } from "@/components/ui";
import { dateInMX, longLabel, timeInMX, todayMX } from "@/lib/dates";
import { gifUrlFrom, toGifMessage } from "@/lib/gifs";
import { errorES, supabase } from "@/lib/supabase";
import type { AvatarOverride, Message } from "@/lib/types";

const LIMIT = 100;

type Person = { name: string; avatar: AvatarOverride };

export default function ChatPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [gifOpen, setGifOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Nombres conocidos (para saber si hay que recargar perfiles al llegar un mensaje)
  const namesRef = useRef(people);
  useEffect(() => {
    namesRef.current = people;
  }, [people]);

  const loadNames = useCallback(async () => {
    // avatar_override existe después de correr casino.sql; si aún no, se piden solo los nombres
    let { data, error } = await supabase.from("profiles").select("id,display_name,avatar_override");
    if (error) ({ data, error } = await supabase.from("profiles").select("id,display_name"));
    const rows = (data ?? []) as { id: string; display_name: string; avatar_override?: AvatarOverride }[];
    setPeople(Object.fromEntries(rows.map((p) => [p.id, { name: p.display_name, avatar: p.avatar_override ?? null }])));
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

  // Guarda un mensaje (texto o GIF) en Supabase; el resto lo recibe en tiempo real
  async function post(content: string) {
    setSending(true);
    setError(null);
    const { data, error } = await supabase.from("messages").insert({ user_id: userId, content }).select().single();
    setSending(false);
    if (error) {
      setError(`No se envió: ${errorES(error.message)}`);
      return false;
    }
    merge([data as Message]);
    return true;
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    if (await post(content)) setText("");
  }

  async function sendGif(url: string) {
    setGifOpen(false);
    await post(toGifMessage(url));
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
            const person = people[m.user_id];
            const name = person?.name ?? "";
            const gif = gifUrlFrom(m.content);
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
                      {lastOfGroup && <UserAvatar name={name} override={person?.avatar} />}
                    </div>
                  )}
                  <div className={`flex max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && firstOfGroup && <span className="mb-1 px-1 text-xs font-medium text-fg2">{name}</span>}
                    {gif ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={gif}
                        alt="GIF"
                        loading="lazy"
                        className="block h-auto w-full max-w-[250px] rounded-xl bg-zinc-900"
                        style={{ minWidth: 120 }}
                      />
                    ) : (
                      <div
                        className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 ${
                          mine ? "bg-sky-400/15 text-sky-200" : "bg-zinc-900 text-white"
                        }`}
                      >
                        {m.content}
                      </div>
                    )}
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
          <button
            type="button"
            onClick={() => setGifOpen(true)}
            disabled={sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-field text-fg2 transition-colors duration-150 ease-out hover:text-fg disabled:opacity-30"
            aria-label="Enviar un GIF"
            title="Enviar un GIF"
          >
            <ImagePlay size={16} />
          </button>
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
      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={sendGif} />
    </main>
  );
}
