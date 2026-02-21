import type { MetadataRoute } from "next"

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://chat-mango.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl.replace(/\/$/, ""),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${baseUrl.replace(/\/$/, "")}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl.replace(/\/$/, "")}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
  ]
}
