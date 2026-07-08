import type { MetadataRoute } from "next";
const SITE = "https://www.landofnature.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/portal", "/checkout", "/acceso", "/admin"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
