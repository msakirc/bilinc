import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      set({ user: data, initialized: true });
    } else {
      set({ user: null, initialized: true });
    }
  },

  signIn: async (username, password) => {
    set({ loading: true });
    const supabase = createClient();
    const email = `${username.trim().toLowerCase()}@app.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { set({ loading: false }); throw error; }
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      set({ user: data, loading: false });
    }
  },

  signUp: async (username, password) => {
    set({ loading: true });
    const supabase = createClient();
    const email = `${username.trim().toLowerCase()}@app.com`;
    const { data: authData, error } = await supabase.auth.signUp({ email, password });
    if (error) { set({ loading: false }); throw error; }
    if (authData.user) {
      await supabase.from("users").insert({ id: authData.user.id, username: username.trim().toLowerCase() });
      const { data } = await supabase.from("users").select("*").eq("id", authData.user.id).single();
      set({ user: data, loading: false });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
