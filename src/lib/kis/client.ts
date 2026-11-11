import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_KIS_BASE_URL ?? "https://openapi.koreainvestment.com:9443";

// In-memory cache for the session
let cachedToken: string | null = null;

async function getKisToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("beta10")
    .download("tokens/kis_real.json");

  if (error || !data) throw new Error(`KIS token fetch error: ${error?.message}`);

  const json: Record<string, string> = JSON.parse(await data.text());
  cachedToken = json["ACC01"];
  if (!cachedToken) throw new Error("KIS token not found in kis_real.json (ACC01)");

  return cachedToken;
}

export async function kisGet<T>(
  path: string,
  params: Record<string, string>,
  trId: string,
): Promise<T> {
  const token = await getKisToken();
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      tr_id: trId,
    },
  });

  if (!res.ok) throw new Error(`KIS API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}
