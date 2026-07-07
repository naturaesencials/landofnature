import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

export const revalidate = 3600;
const SITE = "https://www.landofnature.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("active", true);

  const products: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
    url: `${SITE}/producto/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/contacto`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [...statics, ...products];
}
