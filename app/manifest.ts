import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getBranding() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await supabase.rpc("get_public_branding");
    return data && typeof data === "object" ? data as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getBranding();
  const name = String(branding?.name ?? "iMersOrder");
  const logoUrl = String(branding?.logo_url ?? "");
  const faviconUrl = String(branding?.favicon_url ?? "");
  const useLogo = Boolean(branding?.use_logo_as_favicon ?? true);
  const activeIcon = (!useLogo && faviconUrl) ? faviconUrl : logoUrl;
  const iconVersion = activeIcon.match(/[?&]v=([^&]+)/)?.[1] ?? "27";
  const iconQuery = `?size=512&v=${encodeURIComponent(iconVersion)}`;

  return {
    name,
    short_name: name,
    description: "Katalog online, pesanan lebih teratur.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7f4",
    theme_color: "#07864f",
    icons: [
      { src: `/api/pwa/icon?size=192&v=${encodeURIComponent(iconVersion)}`, sizes: "192x192", purpose: "any" },
      { src: `/api/pwa/icon${iconQuery}`, sizes: "512x512", purpose: "maskable any" },
    ],
  };
}
