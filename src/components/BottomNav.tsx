"use client";
// Barra de navegación inferior fija con las 5 pestañas
import { BarChart3, CalendarDays, Crown, Dices, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useChessBadge } from "@/lib/chess/useChessBadge";

const TABS = [
  { href: "/calendario", label: "Calendario", Icon: CalendarDays },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
  { href: "/casino", label: "Casino", Icon: Dices },
  { href: "/ajedrez", label: "Ajedrez", Icon: Crown },
];

export default function BottomNav() {
  const path = usePathname();
  const { user } = useAuth();
  // Se vuelve a revisar cada vez que cambias de pantalla
  const chessCount = useChessBadge(user?.id, path);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, Icon }) => {
          // Los perfiles públicos se abren desde el ranking, así que cuentan como Stats
          const active = path.startsWith(href) || (href === "/stats" && path.startsWith("/perfil"));
          const badge = href === "/ajedrez" ? chessCount : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={badge ? `${label} (${badge} pendientes)` : label}
                className={`flex h-16 flex-col items-center justify-center gap-1 transition-colors duration-150 ease-out ${
                  active ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                  {badge > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-black tabular-nums">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.08em]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
