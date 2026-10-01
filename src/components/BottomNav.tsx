"use client";
// Barra de navegación inferior fija con las 3 pestañas
import { BarChart3, CalendarDays, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/calendario", label: "Calendario", Icon: CalendarDays },
  { href: "/stats", label: "Stats", Icon: BarChart3 },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-2xl grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  active ? "text-ice" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
