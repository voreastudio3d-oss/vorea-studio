/**
 * PublishDialog – Modal for publishing the current model to the Community.
 * Captures a live thumbnail from the Three.js scene, allows tag entry,
 * and posts to the Community API.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useModel } from "../services/model-context";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { requireLoggedInInteraction } from "../services/protected-auth-interactions";
import { CommunityApi, type CommunityModelMedia, type CommunityModelResponse } from "../services/api-client";
import type { CommunityPublishMode } from "../services/community-edit-routing";
import { captureSnapshot, type ThreeSceneContext } from "../engine/threejs-renderer";
import {
  clampGalleryCoverIndex,
  createGalleryItemFromBlob,
  moveGalleryItem,
  resolveGalleryState,
  serializeGalleryItems,
  type EditableGalleryItem,
} from "../services/community-gallery";
import { trackAnalyticsEvent } from "../services/analytics";
import { fireReward } from "../services/reward-triggers";
import { toast } from "sonner";
import {
  Upload,
  X,
  Tag,
  Loader2,
  CheckCircle2,
  GitFork,
  FileText,
  Shield,
} from "lucide-react";
import { Button } from "./ui/button";
import { AuthDialog } from "./AuthDialog";
import { CommunityGalleryEditor } from "./CommunityGalleryEditor";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneCtx: ThreeSceneContext | null;
  mode: CommunityPublishMode;
  modelId?: string | null;
  forkedFromId?: string;
  forkedFromTitle?: string;
  forkedFromAuthor?: string;
  editModel?: {
    id: string;
    tags?: string[];
    media?: CommunityModelMedia[];
    thumbnailUrl?: string | null;
    status?: string;
  } | null;
  onEditSaved?: (model: CommunityModelResponse) => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  sceneCtx,
  mode,
  modelId,
  forkedFromId,
  forkedFromTitle,
  forkedFromAuthor,
  editModel,
  onEditSaved,
}: PublishDialogProps) {
  const { scadSource, modelName } = useModel();
  const { isLoggedIn } = useAuth();
  const { t } = useI18n();
  const isEditing = mode === "edit";
  const isFork = mode === "fork";

  const [title, setTitle] = useState(modelName || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [galleryItems, setGalleryItems] = useState<EditableGalleryItem[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forkAcknowledged, setForkAcknowledged] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [authOpen, setAuthOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const safeCoverIndex = galleryItems.length > 0 ? Math.max(0, Math.min(coverIndex, galleryItems.length - 1)) : -1;
  const coverItem = safeCoverIndex >= 0 ? galleryItems[safeCoverIndex] : null;
  const thumbnailPreview = coverItem?.previewUrl ?? null;

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle(modelName || "");
      setTags(editModel?.tags || []);
      setTagInput("");
      const existingGallery = resolveGalleryState(editModel?.media, editModel?.thumbnailUrl);
      setGalleryItems(existingGallery.items);
      setCoverIndex(existingGallery.coverIndex);
      setPublishing(false);
      setSaving(false);
      setForkAcknowledged(false);
      setStep("form");
      setAuthOpen(false);
      if (!editModel && existingGallery.items.length === 0) {
        void handleCapture();
      }
    }
  }, [open, modelName, editModel]);

  useEffect(() => {
    setCoverIndex((prev) => clampGalleryCoverIndex(galleryItems, prev));
  }, [galleryItems, coverIndex]);

  const handleCapture = async () => {
    if (!sceneCtx) return;
    const blob = await captureSnapshot(sceneCtx);
    if (blob) {
      const captured = createGalleryItemFromBlob(blob, "auto_capture");
      setGalleryItems((prev) => {
        const withoutAuto = prev.filter((item) => item.source !== "auto_capture");
        return [captured, ...withoutAuto].slice(0, 10);
      });
      setCoverIndex(0);
    }
  };

  const handleAddGalleryImages = useCallback((files: FileList | null) => {
    if (!files) return;
    setGalleryItems((prev) => {
      const next = [...prev];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (next.length >= 10) break;
        next.push(createGalleryItemFromBlob(file, "user_upload"));
      }
      return next.slice(0, 10);
    });
  }, []);

  const handleRemoveGalleryItem = useCallback((index: number) => {
    setGalleryItems((prev) => prev.filter((_, i) => i !== index));
    if (index < coverIndex) {
      setCoverIndex((prev) => Math.max(0, prev - 1));
    } else if (index === coverIndex && coverIndex > 0) {
      setCoverIndex((prev) => Math.max(0, prev - 1));
    }
  }, [coverIndex]);

  const handleSetCover = useCallback((index: number) => {
    setCoverIndex(index);
  }, []);

  const handleMoveGalleryItem = useCallback((index: number, direction: -1 | 1) => {
    setGalleryItems((prev) => moveGalleryItem(prev, index, direction));
    setCoverIndex((prev) => {
      const target = index + direction;
      if (prev === index) return target;
      if (prev === target) return index;
      return prev;
    });
  }, []);

  const handleAddTag = () => {
    const tg = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (tg && !tags.includes(tg) && tags.length < 5) {
      setTags([...tags, tg]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((tg) => tg !== tag));
  };

  const handlePublish = async (asDraft = false) => {
    if (!requireLoggedInInteraction({
      isLoggedIn,
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("publish.loginRequired"),
    })) {
      return;
    }
    if (!title.trim()) { toast.error(t("publish.errorNoTitle")); return; }
    if (!scadSource.trim()) { toast.error(t("publish.errorNoScad")); return; }
    if (isFork && !forkAcknowledged && !asDraft) { toast.error(t("publish.errorForkTerms")); return; }
    if (isEditing && !modelId) { toast.error(t("publish.errorMissingModelId")); return; }
    if (isFork && !forkedFromId) { toast.error(t("publish.errorMissingModelId")); return; }

    asDraft ? setSaving(true) : setPublishing(true);
    try {
      const { thumbnailUrl, media } = await serializeGalleryItems(galleryItems, coverIndex);
      const nextStatus = asDraft ? "draft" : "published";

      const savedModel = isEditing
        ? await CommunityApi.updateModel(modelId!, {
          title: title.trim(),
          scadSource,
          tags,
          thumbnailUrl,
          media,
          status: nextStatus,
        })
        : await CommunityApi.publishModel({
          title: title.trim(),
          scadSource,
          tags,
          thumbnailUrl,
          media,
          forkedFromId: isFork ? forkedFromId : undefined,
          status: nextStatus,
        });

      onEditSaved?.(savedModel);

      if (asDraft || isEditing) {
        toast.success(isEditing ? t("publish.modelUpdated") : t("publish.draftSaved"));
        trackAnalyticsEvent("community_draft", { mode });
        onOpenChange(false);
      } else {
        setStep("success");
        toast.success(isFork ? t("publish.forkPublished") : t("publish.modelPublished"));
        fireReward("publish_model");
        trackAnalyticsEvent("community_publish", { mode });
      }
    } catch (e: any) {
      toast.error(e.message || t("publish.publishError"));
    } finally {
      setPublishing(false);
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div
        ref={dialogRef}
        className="bg-[#161b2e] border border-[rgba(168,187,238,0.15)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "vsModalIn 0.3s cubic-bezier(.22,1,.36,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(168,187,238,0.1)]">
          <div className="flex items-center gap-2">
            {isFork ? <GitFork className="w-5 h-5 text-purple-400" /> : <Upload className="w-5 h-5 text-[#C6E36C]" />}
            <h2 className="text-lg font-semibold">
              {isEditing ? t("publish.titleEdit") : isFork ? t("publish.titleFork") : t("publish.titlePublish")}
            </h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(168,187,238,0.08)] transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {step === "form" ? (
          <div className="p-6 space-y-5">
            <CommunityGalleryEditor
              items={galleryItems}
              coverIndex={coverIndex}
              previewUrl={thumbnailPreview}
              onFilesSelected={handleAddGalleryImages}
              onCapture={sceneCtx ? () => void handleCapture() : undefined}
              onSetCover={handleSetCover}
              onMove={handleMoveGalleryItem}
              onRemove={handleRemoveGalleryItem}
            />

            {/* Title */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t("publish.modelTitle")}</label>
              <input
                autoFocus
                className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("publish.titlePlaceholder")}
                maxLength={100}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t("publish.tagsLabel")}</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {tags.map((tg) => (
                  <span key={tg} className="text-[10px] px-2 py-1 rounded-full bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20 flex items-center gap-1">
                    {tg}
                    <button onClick={() => handleRemoveTag(tg)} className="hover:text-red-400 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              {tags.length < 5 && (
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder={t("publish.tagPlaceholder")}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                  />
                  <Button size="sm" variant="secondary" className="text-xs" onClick={handleAddTag}>
                    <Tag className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* SCAD preview */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t("publish.scadCode")}</label>
              <pre className="bg-[#0a0e17] border border-[rgba(168,187,238,0.08)] rounded-lg p-3 text-[10px] text-gray-500 font-mono max-h-24 overflow-auto">
                {scadSource.slice(0, 500)}{scadSource.length > 500 ? "..." : ""}
              </pre>
            </div>

            {/* Fork Attribution Banner */}
            {isFork && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GitFork className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">{t("publish.forkBanner")}</span>
                </div>
                <p className="text-[11px] text-gray-400 mb-1">
                  {t("publish.forkBasedOn", { title: forkedFromTitle || "", author: forkedFromAuthor || "" })}
                </p>
                <p className="text-[10px] text-gray-600">
                  {t("publish.forkAttribution")}
                </p>
              </div>
            )}

            {/* CC-BY-SA License */}
            <div className="flex items-start gap-2 bg-[#0a0e17] border border-[rgba(168,187,238,0.08)] rounded-lg p-3">
              <Shield className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-gray-500">
                {t("publish.ccLicense")}
              </p>
            </div>

            {/* Fork Acknowledgment */}
            {isFork && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forkAcknowledged}
                  onChange={(e) => setForkAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded border-purple-500/30 accent-purple-500"
                />
                <span className="text-[11px] text-gray-400">
                  {t("publish.forkAcknowledge")}
                </span>
              </label>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {/* Save as Draft */}
              <Button
                variant="secondary"
                className="flex-1 gap-2 text-xs"
                onClick={() => handlePublish(true)}
                disabled={saving || publishing || !title.trim()}
              >
                {saving ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("publish.saving")}</>
                ) : (
                  <><FileText className="w-3.5 h-3.5" /> {isEditing ? t("publish.saveChanges") : isFork ? t("publish.saveForkDraft") : t("publish.saveDraft")}</>
                )}
              </Button>
              {/* Publish */}
              <Button
                className="flex-1 gap-2"
                onClick={() => handlePublish(false)}
                disabled={publishing || saving || !title.trim() || (isFork && !forkAcknowledged)}
              >
                {publishing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t("publish.publishing")}</>
                ) : (
                  <>{isFork ? <GitFork className="w-4 h-4" /> : <Upload className="w-4 h-4" />} {isEditing ? t("publish.publishChanges") : isFork ? t("publish.publishFork") : t("publish.publish")}</>
                )}
              </Button>
            </div>
            {!isLoggedIn && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] text-amber-500 text-center">{t("publish.loginRequired")}</p>
                <Button size="sm" variant="secondary" className="text-[11px]" onClick={() => setAuthOpen(true)}>
                  {t("profile.loginButton")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Success view */
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#C6E36C]/15 flex items-center justify-center mb-4" style={{ animation: "vsModalIn 0.4s cubic-bezier(.22,1,.36,1) both" }}>
              <CheckCircle2 className="w-8 h-8 text-[#C6E36C]" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t("publish.successTitle")}</h3>
            <p className="text-sm text-gray-400 mb-6">{t("publish.successDesc")}</p>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vsModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
