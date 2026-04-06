/**
 * Community Models — Minimal development seed data
 *
 * This dataset intentionally stays small and deterministic so local development
 * can reset to a known-good state with:
 * - 1 published parametric model with multi-image gallery
 * - 1 draft from the same owner/title to validate private edit visibility
 * - 1 public foreign relief model to validate copy/fork flows
 */

export type CommunitySeedStatus = "draft" | "published";
export type CommunitySeedModelType = "parametric" | "relief";

export interface CommunitySeedMediaItem {
  id?: string;
  url: string;
  order?: number;
  source?: "auto_capture" | "user_upload";
  isCover?: boolean;
  createdAt?: string;
}

export interface CommunitySeedReliefConfig {
  imageData: string;
  subdivisions: number;
  maxHeight: number;
  smoothing: number;
  imageScale: number;
  imageScaleMode: "clamp" | "wrap";
  imageRepeatX: boolean;
  imageRepeatY: boolean;
  gapFillMode: "edge" | "color-hard" | "color-soft";
  gapFillColor: string;
  plateWidth: number;
  plateDepth: number;
  lockAspect: boolean;
  surfaceMode: "plane" | "cylinder" | "box" | "polygon" | "lampshade" | "geodesic";
  cylinderRadius: number;
  cylinderHeight: number;
  cylinderRepeats: number;
  cylinderFlipH: boolean;
  cylinderFlipV: boolean;
  boxHeight: number;
  boxCapTop: boolean;
  boxCapBottom: boolean;
  polygonSides: number;
  polygonRadius: number;
  polygonHeight: number;
  polygonCapTop: boolean;
  polygonCapBottom: boolean;
  lampshadeOuterRadiusBottom: number;
  lampshadeOuterRadiusTop: number;
  lampshadeHoleRadius: number;
  lampshadeHeight: number;
  lampshadeCap: "top" | "bottom" | "both" | "none";
  lampshadeSides: number;
  geodesicRadius: number;
  threeMfColorMode: "hybrid" | "slic3r-strict" | "split-objects";
  invert: boolean;
  solid: boolean;
  baseThickness: number;
  colorZones: number;
}

export interface CommunityModel {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string | null;
  likes: number;
  downloads: number;
  thumbnailUrl: string;
  media: CommunitySeedMediaItem[];
  tags: string[];
  featured: boolean;
  status: CommunitySeedStatus;
  modelType: CommunitySeedModelType;
  scadSource?: string;
  reliefConfig?: CommunitySeedReliefConfig;
  createdAt: string;
  updatedAt: string;
}

export interface CommunitySeedUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
}

const OWNER_ID = "a1eb2953-9d04-4430-93b7-da956de8889e";

const SHELF_GALLERY = [
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
];

const RELIEF_GALLERY = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80",
];

const RELIEF_SOURCE_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#8b8b8b"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#sky)"/>
  <circle cx="192" cy="58" r="28" fill="#f2f2f2"/>
  <path d="M0 185 58 132 96 168 152 98 210 172 256 138 256 256 0 256Z" fill="#1a1a1a"/>
  <path d="M0 206 42 176 88 194 132 154 180 208 226 178 256 198 256 256 0 256Z" fill="#444"/>
</svg>
`)}`;

export const COMMUNITY_MODELS: CommunityModel[] = [
  {
    id: "cm_mmwk9htxc096q5",
    title: "Parametric Display Shelf",
    authorId: OWNER_ID,
    authorName: "QA Studio Pro",
    authorUsername: "@qa_studiopro",
    authorAvatarUrl: null,
    likes: 18,
    downloads: 42,
    thumbnailUrl: SHELF_GALLERY[0],
    media: SHELF_GALLERY.map((url, index) => ({
      id: `media_shelf_pub_${index + 1}`,
      url,
      order: index,
      source: index === 0 ? "auto_capture" : "user_upload",
      isCover: index === 0,
      createdAt: "2026-03-19T12:00:00.000Z",
    })),
    tags: ["parametric", "shelf", "gallery"],
    featured: true,
    status: "published",
    modelType: "parametric",
    createdAt: "2026-03-18T18:00:00.000Z",
    updatedAt: "2026-03-19T18:30:00.000Z",
    scadSource: `// Parametric Display Shelf
$fn = 48;
width = 160;      // [80:10:240]
depth = 70;       // [40:5:120]
height = 110;     // [60:5:180]
wall = 4;         // [2:1:8]
lip = 12;         // [4:2:20]
divider_count = 2; // [0:1:5]

module shelf_body() {
  difference() {
    cube([width, depth, height]);
    translate([wall, wall, wall])
      cube([width - wall * 2, depth - wall, height - wall]);
  }
}

module front_lip() {
  translate([0, depth - wall, 0])
    cube([width, wall, lip]);
}

module divider(idx) {
  spacing = width / (divider_count + 1);
  translate([spacing * (idx + 1) - wall / 2, wall, wall])
    cube([wall, depth - wall * 2, height - wall * 1.5]);
}

union() {
  shelf_body();
  front_lip();
  for (i = [0:max(divider_count - 1, 0)]) divider(i);
}`,
  },
  {
    id: "cm_dev_gallery_draft_01",
    title: "Parametric Display Shelf",
    authorId: OWNER_ID,
    authorName: "QA Studio Pro",
    authorUsername: "@qa_studiopro",
    authorAvatarUrl: null,
    likes: 0,
    downloads: 0,
    thumbnailUrl: SHELF_GALLERY[1],
    media: [
      {
        id: "media_shelf_draft_1",
        url: SHELF_GALLERY[1],
        order: 0,
        source: "user_upload",
        isCover: true,
        createdAt: "2026-03-19T18:35:00.000Z",
      },
      {
        id: "media_shelf_draft_2",
        url: SHELF_GALLERY[0],
        order: 1,
        source: "user_upload",
        isCover: false,
        createdAt: "2026-03-19T18:35:01.000Z",
      },
      {
        id: "media_shelf_draft_3",
        url: SHELF_GALLERY[2],
        order: 2,
        source: "user_upload",
        isCover: false,
        createdAt: "2026-03-19T18:35:02.000Z",
      },
    ],
    tags: ["parametric", "shelf", "gallery", "draft"],
    featured: false,
    status: "draft",
    modelType: "parametric",
    createdAt: "2026-03-19T18:35:00.000Z",
    updatedAt: "2026-03-19T18:36:00.000Z",
    scadSource: `// Parametric Display Shelf (draft)
$fn = 48;
width = 170;      // [80:10:240]
depth = 72;       // [40:5:120]
height = 118;     // [60:5:180]
wall = 4;         // [2:1:8]
lip = 14;         // [4:2:24]
divider_count = 3; // [0:1:5]

module shelf_body() {
  difference() {
    cube([width, depth, height]);
    translate([wall, wall, wall])
      cube([width - wall * 2, depth - wall, height - wall]);
  }
}

module front_lip() {
  translate([0, depth - wall, 0])
    cube([width, wall, lip]);
}

module divider(idx) {
  spacing = width / (divider_count + 1);
  translate([spacing * (idx + 1) - wall / 2, wall, wall])
    cube([wall, depth - wall * 2, height - wall * 1.5]);
}

union() {
  shelf_body();
  front_lip();
  for (i = [0:max(divider_count - 1, 0)]) divider(i);
}`,
  },
  {
    id: "cm_dev_relief_public_01",
    title: "Mountain Relief Wrap",
    authorId: "u_relief_guest",
    authorName: "Relief Guest",
    authorUsername: "@relief_guest",
    authorAvatarUrl: null,
    likes: 9,
    downloads: 21,
    thumbnailUrl: RELIEF_GALLERY[0],
    media: RELIEF_GALLERY.map((url, index) => ({
      id: `media_relief_${index + 1}`,
      url,
      order: index,
      source: "user_upload",
      isCover: index === 0,
      createdAt: "2026-03-17T14:10:00.000Z",
    })),
    tags: ["relief", "wrap", "landscape"],
    featured: false,
    status: "published",
    modelType: "relief",
    createdAt: "2026-03-17T14:00:00.000Z",
    updatedAt: "2026-03-18T09:30:00.000Z",
    reliefConfig: {
      imageData: RELIEF_SOURCE_IMAGE,
      subdivisions: 720,
      maxHeight: 1.2,
      smoothing: 1,
      imageScale: 1,
      imageScaleMode: "clamp",
      imageRepeatX: true,
      imageRepeatY: true,
      gapFillMode: "color-hard",
      gapFillColor: "#ffffff",
      plateWidth: 100,
      plateDepth: 100,
      lockAspect: true,
      surfaceMode: "cylinder",
      cylinderRadius: 120,
      cylinderHeight: 32,
      cylinderRepeats: 3,
      cylinderFlipH: true,
      cylinderFlipV: true,
      boxHeight: 100,
      boxCapTop: true,
      boxCapBottom: true,
      polygonSides: 6,
      polygonRadius: 40,
      polygonHeight: 100,
      polygonCapTop: true,
      polygonCapBottom: true,
      lampshadeOuterRadiusBottom: 50,
      lampshadeOuterRadiusTop: 35,
      lampshadeHoleRadius: 25,
      lampshadeHeight: 80,
      lampshadeCap: "bottom",
      lampshadeSides: 0,
      geodesicRadius: 50,
      threeMfColorMode: "slic3r-strict",
      invert: true,
      solid: true,
      baseThickness: 2,
      colorZones: 4,
    },
  },
];

/**
 * Derive unique community authors from COMMUNITY_MODELS.
 */
export function getCommunitySeedUsers(
  emailDomain = "vorea.community"
): CommunitySeedUser[] {
  const byId = new Map<string, CommunitySeedUser>();
  for (const model of COMMUNITY_MODELS) {
    if (byId.has(model.authorId)) continue;
    const username = model.authorUsername;
    const emailLocal = username.replace(/^@/, "") || model.authorId;
    byId.set(model.authorId, {
      id: model.authorId,
      displayName: model.authorName,
      username,
      email: `${emailLocal}@${emailDomain}`,
    });
  }
  return [...byId.values()];
}

/**
 * Aggregate tag counters for published models only.
 */
export function getCommunityTagCounts(
  models: CommunityModel[] = COMMUNITY_MODELS
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const model of models) {
    if (model.status !== "published") continue;
    for (const tag of model.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return counts;
}
