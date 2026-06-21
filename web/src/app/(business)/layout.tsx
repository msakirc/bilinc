"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DatabaseService } from "@/lib/database";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { user, initialized, initialize } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.push("/giris");
      return;
    }
    let on = true;
    DatabaseService.getClaimedListings(user.id)
      .then((claims) => {
        if (!on) return;
        const active = (claims || []).filter(
          (c) => !c.expires_at || new Date(c.expires_at) > new Date(),
        );
        if (active.length === 0) router.replace("/");
        setChecking(false);
      })
      .catch(() => {
        if (on) router.replace("/");
      });
    return () => {
      on = false;
    };
  }, [initialized, user, router]);

  if (!initialized || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bilinc-bg">
        <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bilinc-bg">
      <DashboardSidebar user={user!} />
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
