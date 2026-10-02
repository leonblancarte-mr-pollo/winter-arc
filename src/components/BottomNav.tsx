"use client";
// Barra de navegación inferior fija con las 4 pestañas
import { BarChart3, CalendarDays, Dices, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/calendario", label: "Calendario", Icon: CalendarDays },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
  { href: "/casino", label: "Casino", Icon: Dices },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-black/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 transition-colors duration-150 ease-out ${
                  active ? "text-accent" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium uppercase tracking-[0.1em]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
