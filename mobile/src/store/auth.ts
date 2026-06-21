import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { AuthState, User } from '../types';

// Temporarily disable persistence to debug
export const useAuthStore = create<AuthState>()(
    (set, get) => {
      console.log('🔧 AuthStore: Initializing...');
      return {
        user: null,
        session: null,
        loading: true,

      signIn: async (username: string, password: string) => {
        console.log('🔐 Attempting sign in for:', username);
        set({ loading: true });
        try {
          // For username-based auth, we'll use email format: username@app.com
          // Normalize (trim + lowercase) so casing/whitespace can't fork accounts
          // across platforms — must match web (web/src/store/auth.ts).
          const email = `${username.trim().toLowerCase()}@app.com`;
          console.log('Using email:', email);

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          console.log('Auth response:', { data: !!data, error: !!error });

          if (error) {
            console.error('Auth error:', error);
            throw error;
          }

          console.log('Auth successful, user ID:', data.user?.id);

          // Fetch user profile from users table
          console.log('Fetching user profile...');
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user!.id)
            .single();

          console.log('Profile query result:', { profile: !!profile, error: !!profileError });

          if (profileError) {
            console.error('Profile fetch error:', profileError);
            throw profileError;
          }

          console.log('Sign in successful');
          set({
            user: profile as User,
            session: data.session,
            loading: false
          });
        } catch (error) {
          console.error('Sign in failed:', error);
          set({ loading: false });
          throw error;
        }
      },

      signUp: async (username: string, password: string) => {
        console.log('📝 Attempting sign up for:', username);
        set({ loading: true });
        try {
          const email = `${username.trim().toLowerCase()}@app.com`;
          console.log('Using email:', email);

          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          console.log('Auth signup response:', { data: !!data, error: !!error });

          if (error) {
            console.error('Auth signup error:', error);
            throw error;
          }

          console.log('Auth signup successful, user ID:', data.user?.id);

          // Create user profile with explicit types
          const userData = {
            id: data.user!.id,
            username: username.trim().toLowerCase(),
            user_type: 'consumer',
            reputation_score: 0,
            credibility_level: 'novice',
            is_active: true,
          };

          console.log('Creating user profile with data:', userData);

          const { data: profile, error: profileError } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();

          console.log('Profile creation result:', { profile: !!profile, error: !!profileError });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            console.error('Error details:', JSON.stringify(profileError, null, 2));
            throw profileError;
          }

          console.log('Sign up successful');
          set({
            user: profile as User,
            session: data.session,
            loading: false
          });
        } catch (error) {
          console.error('Sign up failed:', error);
          set({ loading: false });
          throw error;
        }
      },

      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        set({ user: null, session: null, loading: false });
      },

      refreshUser: async () => {
        try {
          console.log('🔄 Checking for existing session...');
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            // Transient/network error — cannot distinguish from "has session" vs "no session".
            // Do NOT clear the existing user/session; preserve prior auth state.
            console.error('Session check error (transient — preserving existing state):', error);
            set({ loading: false });
            return;
          }

          const session = data?.session;
          console.log('Session found:', !!session);

          if (session?.user) {
            console.log('Fetching user profile for:', session.user.id);

            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileError) {
              // Profile DB error is transient — keep the valid session alive.
              // Do NOT log the user out; leave user as-is.
              console.error('Profile fetch error (transient — preserving session):', profileError);
              set({ loading: false });
              return;
            }

            console.log('Profile loaded successfully');
            set({
              user: profile as User,
              session,
              loading: false
            });
          } else {
            // Genuine logout: getSession returned no error AND no session.
            console.log('No active session');
            set({ user: null, session: null, loading: false });
          }
        } catch (error) {
          // Unexpected thrown exception (e.g. network rejection).
          // Preserve existing state — do not log out on network failure.
          console.error('Refresh user failed (unexpected):', error);
          set({ loading: false });
        }
      },
    };
  }
);
