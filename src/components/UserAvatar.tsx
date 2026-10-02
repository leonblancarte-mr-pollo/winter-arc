// Avatar de un usuario: círculo con sus iniciales, o un burro 🫏 si alguien
// le aplicó el poder de 100,000 peseis (avatar_override = "burro").
import type { AvatarOverride } from "@/lib/types";

export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function UserAvatar({ name, override, size = 28 }: { name: string; override?: AvatarOverride; size?: number }) {
  if (override === "burro") {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-amber-400/15"
        style={{ width: size, height: size, fontSize: size * 0.6 }}
        role="img"
        aria-label={`${name} (convertido en burro)`}
        title="Alguien le puso avatar de burro"
      >
        🫏
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-medium text-fg2"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
