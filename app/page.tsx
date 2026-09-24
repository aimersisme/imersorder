import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicCatalog } from "@/components/public-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_catalog");
  if (error || !data?.enabled) redirect("/dashboard");
  return <PublicCatalog data={data} />;
}
