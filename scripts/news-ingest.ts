import "dotenv/config";
import { ingestNews } from "../server/news-service.js";

async function main() {
  const sourceSlug =
    process.argv.find((arg) => arg.startsWith("--source="))?.split("=")[1] ||
    process.argv.find((arg) => arg.startsWith("--sourceSlug="))?.split("=")[1] ||
    process.env.NEWS_SOURCE_SLUG ||
    process.env.npm_config_source ||
    process.env.npm_config_sourceslug;
  const result = await ingestNews({ sourceSlug });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[news:ingest] failed", error);
  process.exit(1);
});
