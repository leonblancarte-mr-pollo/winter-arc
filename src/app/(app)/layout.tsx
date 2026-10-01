"use client";
// Envoltura de las pantallas con sesión: protege las páginas y muestra la barra inferior
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import BottomNav from "@/components/BottomNav";
import ConfigMissing from "@/components/ConfigMissing";
import { Spinner } from "@/components/ui";
import { supabaseConfigured } from "@/lib/supabase";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (supabaseConfigured && !loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (!supabaseConfigured) return <ConfigMissing />;
  if (loading || !user) return <Spinner />;

  return (
    <>
      <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-[calc(1rem+env(safe-area-inset-top))]">{children}</div>
      <BottomNav />
    </>
  );
}
