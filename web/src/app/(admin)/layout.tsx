"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, initialized, initialize } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    if (initialized && (!user || user.user_type !== "admin")) {
      router.push("/");
    }
  }, [initialized, user, router]);

  if (!initialized || !user || user.user_type !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bilinc-bg">
        <div className="w-8 h-8 border-2 border-bilinc-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bilinc-bg">
      <AdminSidebar user={user} />
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
