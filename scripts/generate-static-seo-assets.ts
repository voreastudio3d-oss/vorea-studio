import fs from "node:fs/promises";
import path from "node:path";
import {
  buildDefaultOgSvg,
  buildRobotsTxt,
  buildSitemapSectionXml,
  buildSitemapXml,
} from "../server/seo.ts";

function resolveSiteUrl(): string {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.VOREA_PUBLIC_BASE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    try {
      return new URL(value).toString();
    } catch {
      // ignore invalid candidate and keep searching
    }
  }

  return "https://voreastudio3d.com";
}

async function main(): Promise<void> {
  const siteUrl = resolveSiteUrl();
  const distDir = path.resolve(import.meta.dirname, "..", "dist");
  const ogDir = path.join(distDir, "og");
  const sitemapDir = path.join(distDir, "sitemaps");

  await fs.mkdir(distDir, { recursive: true });
  await fs.mkdir(ogDir, { recursive: true });
  await fs.mkdir(sitemapDir, { recursive: true });

  const [robotsTxt, sitemapXml, coreSitemap, communitySitemap, newsSitemap, defaultOgSvg] = await Promise.all([
    Promise.resolve(buildRobotsTxt(siteUrl)),
    buildSitemapXml(siteUrl),
    buildSitemapSectionXml("core", siteUrl),
    buildSitemapSectionXml("community", siteUrl),
    buildSitemapSectionXml("news", siteUrl),
    Promise.resolve(buildDefaultOgSvg()),
  ]);

  await Promise.all([
    fs.writeFile(path.join(distDir, "robots.txt"), robotsTxt, "utf-8"),
    fs.writeFile(path.join(distDir, "sitemap.xml"), sitemapXml, "utf-8"),
    fs.writeFile(path.join(sitemapDir, "core.xml"), coreSitemap, "utf-8"),
    fs.writeFile(path.join(sitemapDir, "community.xml"), communitySitemap, "utf-8"),
    fs.writeFile(path.join(sitemapDir, "news.xml"), newsSitemap, "utf-8"),
    fs.writeFile(path.join(ogDir, "default.svg"), defaultOgSvg, "utf-8"),
  ]);

  console.log(`[seo-static] generated robots.txt, sitemap.xml, sitemaps/* and og/default.svg for ${siteUrl}`);
}

main().catch((error) => {
  console.error(`[seo-static] generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
