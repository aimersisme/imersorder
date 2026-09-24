"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function Brand({ compact = false, showTagline = false }: { compact?: boolean; showTagline?: boolean }) {
  const [logo, setLogo] = useState("/icon.png");
  const [name, setName] = useState("iMersOrder");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_single_business_context");
      const business = data && typeof data === "object" ? data as Record<string, unknown> : null;
      if (!active || !business) return;
      if (business.logo_url) setLogo(String(business.logo_url));
      if (business.name) setName(String(business.name));
      const { data: rows } = await supabase.from("business_settings").select("key,value").in("key", ["favicon_url", "use_logo_as_favicon"]);
      const map = new Map((rows ?? []).map((row) => [row.key, row.value as Record<string, unknown>]));
      const custom = String(map.get("favicon_url")?.url ?? "");
      const useLogo = Boolean(map.get("use_logo_as_favicon")?.enabled ?? true);
      const icon = custom || (useLogo && business.logo_url ? String(business.logo_url) : "/icon.png");
      if (icon) {
        document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach((el) => el.remove());
        const link = document.createElement("link"); link.rel = "icon"; link.href = icon; link.type = "image/png"; document.head.appendChild(link);
        const apple = document.createElement("link"); apple.rel = "apple-touch-icon"; apple.href = icon; document.head.appendChild(apple);
      }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("imersorder:branding-updated", refresh);
    return () => { active = false; window.removeEventListener("imersorder:branding-updated", refresh); };
  }, []);

  return (
    <div className={`brand ${showTagline ? "brandWithTagline" : ""}`}>
      <img className="brandLogo" src={logo} width={44} height={44} alt={`Logo ${name}`} />
      {!compact ? <span className="brandCopy"><span className="brandName">{name}</span>{showTagline ? <span className="brandTagline">Katalog online, pesanan lebih teratur.</span> : null}</span> : null}
    </div>
  );
}
