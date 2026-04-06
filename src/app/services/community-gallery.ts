import { CommunityApi, type CommunityModelMedia } from "./api-client";

export type EditableGallerySource = "auto_capture" | "user_upload";

export interface EditableGalleryItem {
  id: string;
  previewUrl: string;
  source: EditableGallerySource;
  blob?: Blob;
  remoteUrl?: string;
}

export interface SerializedCommunityGallery {
  thumbnailUrl?: string;
  media: Array<{
    url: string;
    source: EditableGallerySource;
    isCover: boolean;
    order: number;
  }>;
}

function createGalleryId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createGalleryItemFromBlob(blob: Blob, source: EditableGallerySource): EditableGalleryItem {
  return {
    id: createGalleryId(),
    previewUrl: URL.createObjectURL(blob),
    blob,
    source,
  };
}

export function createGalleryItemFromUrl(url: string, source: EditableGallerySource = "user_upload"): EditableGalleryItem {
  return {
    id: createGalleryId(),
    previewUrl: url,
    remoteUrl: url,
    source,
  };
}

export function resolveGalleryState(
  media?: CommunityModelMedia[] | null,
  thumbnailUrl?: string | null,
): { items: EditableGalleryItem[]; coverIndex: number } {
  const sortedMedia = (media || [])
    .filter((item) => typeof item?.url === "string" && item.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (sortedMedia.length > 0) {
    const coverIndex = Math.max(0, sortedMedia.findIndex((item) => item.isCover));
    return {
      items: sortedMedia.map((item) => createGalleryItemFromUrl(item.url, item.source ?? "user_upload")),
      coverIndex,
    };
  }

  if (thumbnailUrl) {
    return {
      items: [createGalleryItemFromUrl(thumbnailUrl, "auto_capture")],
      coverIndex: 0,
    };
  }

  return { items: [], coverIndex: 0 };
}

export function moveGalleryItem(items: EditableGalleryItem[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function clampGalleryCoverIndex(items: EditableGalleryItem[], index: number) {
  if (items.length === 0) return 0;
  return Math.max(0, Math.min(index, items.length - 1));
}

async function resolveGalleryItemUrl(item: EditableGalleryItem, isCover: boolean) {
  if (item.blob) {
    return isCover
      ? CommunityApi.uploadThumbnail(item.blob)
      : CommunityApi.uploadCommunityImage(item.blob);
  }
  return item.remoteUrl ?? item.previewUrl;
}

export async function serializeGalleryItems(
  items: EditableGalleryItem[],
  coverIndex: number,
): Promise<SerializedCommunityGallery> {
  const sanitizedItems = items.slice(0, 10);
  const resolvedCoverIndex = sanitizedItems.length > 0 ? clampGalleryCoverIndex(sanitizedItems, coverIndex) : -1;
  const media: SerializedCommunityGallery["media"] = [];
  let thumbnailUrl: string | undefined;

  for (let i = 0; i < sanitizedItems.length; i++) {
    const item = sanitizedItems[i];
    const isCover = i === resolvedCoverIndex;
    const url = await resolveGalleryItemUrl(item, isCover);

    if (isCover) thumbnailUrl = url;

    media.push({
      url,
      source: item.source,
      isCover,
      order: media.length,
    });
  }

  return { thumbnailUrl, media };
}
