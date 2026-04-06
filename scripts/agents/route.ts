import { buildCurrentBlockSuggestion, renderRouteRecommendation, routeGovernance, writeCurrentBlock } from "./lib/router.ts";

function parseArgs(args: string[]) {
  const changedPaths: string[] = [];
  let staged = false;
  let since: string | undefined;
  let writeBlock = true;
  let json = false;
  let goal: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--staged") {
      staged = true;
      continue;
    }
    if (value === "--since") {
      since = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--changed") {
      changedPaths.push(...(args[index + 1] ?? "").split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
      continue;
    }
    if (value === "--no-write-block") {
      writeBlock = false;
      continue;
    }
    if (value === "--json") {
      json = true;
      continue;
    }
    if (value === "--goal") {
      goal = args[index + 1];
      index += 1;
      continue;
    }
  }

  return { changedPaths, staged, since, writeBlock, json, goal };
}

const args = parseArgs(process.argv.slice(2));
const route = routeGovernance(process.cwd(), {
  changedPaths: args.changedPaths.length > 0 ? args.changedPaths : undefined,
  staged: args.staged,
  since: args.since,
});

const block = buildCurrentBlockSuggestion(route, args.goal);
let currentBlockPath = "";
if (args.writeBlock) {
  currentBlockPath = writeCurrentBlock(process.cwd(), block);
}

if (args.json) {
  console.log(
    JSON.stringify(
      {
        route,
        currentBlockPath: currentBlockPath || null,
      },
      null,
      2,
    ),
  );
} else {
  console.log(renderRouteRecommendation(route));
  if (currentBlockPath) {
    console.log("");
    console.log(`Current block updated: ${currentBlockPath}`);
  }
}
