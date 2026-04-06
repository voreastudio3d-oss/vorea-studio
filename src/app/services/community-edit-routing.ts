import type { CommunityModelResponse } from "./api-client";

export type CommunityEditorIntent = "edit" | "fork";
export type CommunityPublishMode = "create" | "edit" | "fork";

export interface CommunityRouteContext {
  intent: CommunityEditorIntent;
  modelId: string;
}

export function parseCommunityRouteContext(
  searchParams: URLSearchParams
): CommunityRouteContext | null {
  const intent = searchParams.get("intent");
  const modelId = searchParams.get("modelId");
  if ((intent !== "edit" && intent !== "fork") || !modelId) return null;
  return { intent, modelId };
}

export function getCommunityPublishMode(
  routeContext: CommunityRouteContext | null
): CommunityPublishMode {
  if (!routeContext) return "create";
  return routeContext.intent === "edit" ? "edit" : "fork";
}

export function buildCommunityEditorRoute(
  model: Pick<CommunityModelResponse, "id" | "modelType">,
  intent: CommunityEditorIntent
): string {
  const basePath = model.modelType === "relief" ? "/relief" : "/studio";
  const params = new URLSearchParams();
  params.set("intent", intent);
  params.set("modelId", model.id);
  return `${basePath}?${params.toString()}`;
}
