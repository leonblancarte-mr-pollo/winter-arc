// GIFs del chat (GIPHY). Un mensaje de GIF se guarda en la columna "content" de messages
// como "gif:https://media.giphy.com/...", así no hace falta cambiar la base de datos.

export const GIF_PREFIX = "gif:";

// Llave de GIPHY. Si no está configurada se usa la llave pública de demo (ya no funciona
// en la mayoría de los casos: hay que crear una gratis en developers.giphy.com).
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "dc6zaTOxFJmzC";
export const usingDemoGiphyKey = !process.env.NEXT_PUBLIC_GIPHY_API_KEY;

export function toGifMessage(url: string) {
  return GIF_PREFIX + url;
}

// Si el mensaje es un GIF válido de GIPHY regresa su URL; si no, null.
// Solo acepta imágenes de giphy.com por https (nadie puede meter cualquier imagen).
export function gifUrlFrom(content: string): string | null {
  if (!content.startsWith(GIF_PREFIX)) return null;
  try {
    const u = new URL(content.slice(GIF_PREFIX.length));
    const okHost = u.hostname === "giphy.com" || u.hostname.endsWith(".giphy.com");
    return u.protocol === "https:" && okHost ? u.toString() : null;
  } catch {
    return null;
  }
}

export type GifResult = { id: string; title: string; preview: string; url: string; width: number; height: number };

type GiphyImage = { url: string; width: string; height: string };
type GiphyItem = { id: string; title: string; images: { fixed_width: GiphyImage; fixed_width_small?: GiphyImage } };

// Busca GIFs (o los más populares si no hay texto)
export async function searchGifs(query: string, signal?: AbortSignal): Promise<GifResult[]> {
  const q = query.trim();
  const params = new URLSearchParams({ api_key: GIPHY_KEY, limit: "24", rating: "pg-13", lang: "es" });
  if (q) params.set("q", q);
  const endpoint = q ? "search" : "trending";
  const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`, { signal });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403 || res.status === 429
        ? "GIPHY rechazó la llave. Configura NEXT_PUBLIC_GIPHY_API_KEY con tu propia llave."
        : "No se pudo buscar en GIPHY. Intenta de nuevo.",
    );
  }
  const json = (await res.json()) as { data: GiphyItem[] };
  return json.data
    .filter((g) => g.images?.fixed_width?.url)
    .map((g) => ({
      id: g.id,
      title: g.title,
      preview: (g.images.fixed_width_small ?? g.images.fixed_width).url,
      url: g.images.fixed_width.url,
      width: Number(g.images.fixed_width.width),
      height: Number(g.images.fixed_width.height),
    }));
}
