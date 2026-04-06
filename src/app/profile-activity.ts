const ACTION_LABELS: Record<string, string> = {
  export_stl: "Export STL",
  download_stl: "Download STL",
  download_obj: "Download OBJ",
  download_3mf: "Download 3MF",
  download_scad: "Download SCAD",
  export_3mf: "Export 3MF",
  export_hybrid: "Export 3MF color",
  ai_generation: "Generación IA",
  organic_deform: "Deformación orgánica",
  makerworld_publish: "MakerWorld publish",
  credit_purchase: "Compra de créditos",
  fork: "Fork de modelo",
  comment_added: "Comentario",
  publish: "Publicación",
  oauth_merge: "Cuenta vinculada",
  community_image_uploaded: "Imagen de comunidad",
  relief_thumbnail_uploaded: "Miniatura de relieve",
  gcode_saved: "GCode guardado",
  ai_recipe_saved: "Recipe IA guardada",
  ai_history_saved: "Historial IA guardado",
};

export const PROFILE_ACTIVITY_ICONS: Record<string, string> = {
  export_stl: "📦",
  download_stl: "📦",
  download_obj: "📦",
  download_3mf: "📦",
  download_scad: "💾",
  export_3mf: "📦",
  export_hybrid: "🎨",
  ai_generation: "🤖",
  organic_deform: "🌊",
  makerworld_publish: "🌐",
  credit_purchase: "💳",
  fork: "🔀",
  comment_added: "💬",
  publish: "🚀",
  oauth_merge: "🔗",
  community_image_uploaded: "🖼️",
  relief_thumbnail_uploaded: "🏔️",
  gcode_saved: "🧵",
  ai_recipe_saved: "🧪",
  ai_history_saved: "🕘",
};

export function getActivityLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return String(action || "actividad")
    .split("_")
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase() === "ai") return "IA";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function getActivityTimestamp(activity: Record<string, unknown> | null | undefined): string | null {
  const candidate = activity?.at || activity?.timestamp || activity?.createdAt;
  if (!candidate) return null;
  const iso = String(candidate);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

export function formatActivityAge(timestamp: string | null | undefined, nowMs = Date.now()): string {
  if (!timestamp) return "—";
  const diff = Math.max(0, nowMs - new Date(timestamp).getTime());
  if (!Number.isFinite(diff)) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "0m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
