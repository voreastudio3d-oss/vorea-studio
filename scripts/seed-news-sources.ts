import "dotenv/config";
import { seedDefaultNewsSources } from "../server/news-service.js";

async function main() {
  await seedDefaultNewsSources();
  console.log("[news:seed-sources] OK");
}

main().catch((error) => {
  console.error("[news:seed-sources] failed", error);
  process.exit(1);
});
