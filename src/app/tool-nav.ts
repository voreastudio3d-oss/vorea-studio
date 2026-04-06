export function matchesRouteWithSearch(pathname: string, search: string, target: string): boolean {
  const url = new URL(target, "https://vorea.local");
  const currentPath = String(pathname || "/");
  const currentSearch = new URLSearchParams(search || "");
  const targetSearch = new URLSearchParams(url.search || "");

  if (url.pathname !== currentPath) return false;
  for (const [key, value] of targetSearch.entries()) {
    if (currentSearch.get(key) !== value) return false;
  }
  return true;
}
