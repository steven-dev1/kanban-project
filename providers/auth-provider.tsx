"use client";

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (id: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        setProfile(data as Profile | null);
      } catch (error) {
        console.error("[auth] no se pudo cargar el perfil", error);
      }
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: User | null } }) => {
        if (!active) return;
        setUser(data.user);
        if (data.user) loadProfile(data.user.id).finally(() => setLoading(false));
        else setLoading(false);
      })
      .catch((error: unknown) => {
        console.error("[auth] getUser falló", error);
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        if (session?.user) loadProfile(session.user.id);
        else setProfile(null);
        router.refresh();
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile, router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const value = useMemo(
    () => ({ user, profile, loading, signOut }),
    [user, profile, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
