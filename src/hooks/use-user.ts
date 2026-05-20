"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { AuthUser as ProfileUser } from "@/types";

export function useUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setUser(authUser);

      if (authUser) {
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setProfile(data);
      }

      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, loading };
}
