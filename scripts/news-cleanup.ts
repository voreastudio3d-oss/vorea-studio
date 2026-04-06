import "dotenv/config";
import { cleanupNews } from "../server/news-service.js";

async function main() {
  const result = await cleanupNews(new Date());
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[news:cleanup] failed", error);
  process.exit(1);
});
