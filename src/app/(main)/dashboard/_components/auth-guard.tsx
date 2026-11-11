"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/auth/v1/login");
      } else {
        setChecked(true);
      }
    });
  }, [router]);

  if (!checked) return null;

  return <>{children}</>;
}
