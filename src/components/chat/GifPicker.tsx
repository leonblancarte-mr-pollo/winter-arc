"use client";
// Buscador de GIFs (GIPHY): escribe, elige uno de la cuadrícula y se envía al chat
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBox, Sheet, Spinner } from "@/components/ui";
import { searchGifs, usingDemoGiphyKey, type GifResult } from "@/lib/gifs";

export default function GifPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Busca 400 ms después de que el usuario deja de escribir
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setError(null);
      setResults(null);
      try {
        setResults(await searchGifs(query, ctrl.signal));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  return (
    <Sheet open={open} onClose={onClose} title={<div className="text-xl font-semibold">GIFs</div>}>
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
        <input
          className="input pl-9"
          placeholder="Buscar en GIPHY"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Buscar GIFs"
        />
      </label>

      <div className="mt-4 min-h-48">
        {error ? (
          <ErrorBox message={error + (usingDemoGiphyKey ? "\nLa app está usando la llave de demo de GIPHY." : "")} />
        ) : !results ? (
          <Spinner label="Buscando" />
        ) : results.length === 0 ? (
          <p className="py-12 text-center text-fg3">No hay GIFs para esa búsqueda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onPick(g.url)}
                className="overflow-hidden rounded-lg bg-raised transition-opacity duration-150 hover:opacity-80"
                aria-label={g.title || "GIF"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt={g.title || "GIF"} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 text-right text-[10px] uppercase tracking-[0.1em] text-fg3">Powered by GIPHY</p>
    </Sheet>
  );
}
